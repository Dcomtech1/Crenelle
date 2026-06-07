'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvitationEmail, sendReminderEmailsDirect } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendInvitationWhatsApp } from '@/lib/whatsapp'
import * as Sentry from '@sentry/nextjs'

/**
 * Public registration — called from the public registration form.
 * Uses admin client to bypass RLS (no user session exists for public visitors).
 */
export async function submitRegistration(eventId: string, formData: FormData) {
  const supabase = createAdminClient()

  // ── Rate limiting (CAN-SPAM / anti-spam) ──────────────────────
  const headerStore = await headers()
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    'unknown'

  const email = (formData.get('email') as string)?.trim().toLowerCase() ?? ''

  const ipLimit = checkRateLimit({ key: `reg_ip:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 })
  if (!ipLimit.allowed) {
    return { error: 'Too many registration attempts from your network. Please try again later.' }
  }

  const emailLimit = checkRateLimit({ key: `reg_email:${email}`, limit: 3, windowMs: 60 * 60 * 1000 })
  if (!emailLimit.allowed) {
    return { error: 'Too many registrations for this email address. Please wait before trying again.' }
  }

  // 1. Verify the event exists, is open, and is published
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_type, status, max_registrations')
    .eq('id', eventId)
    .single()

  if (eventError || !event) return { error: 'Event not found' }
  if (event.event_type !== 'open') return { error: 'This event does not accept public registrations' }
  if (event.status === 'draft') return { error: 'Registration is not yet open for this event' }
  if (event.status === 'ended') return { error: 'This event has ended' }

  // 2. Check registration cap — route to waitlist if full
  let routeToWaitlist = false
  if (event.max_registrations) {
    const { count } = await supabase
      .from('attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('source', 'public_registration')
      .not('registration_status', 'in', '(rejected,waitlist)')

    if ((count ?? 0) >= event.max_registrations) {
      routeToWaitlist = true
    }
  }

  // 3. Check unsubscribe list
  const { data: unsub } = await supabase
    .from('email_unsubscribes')
    .select('id')
    .ilike('email', email)
    .not('unsubscribed_at', 'is', null)
    .maybeSingle()

  if (unsub) {
    return { success: true }
  }

  // 4. Insert attendee with source = 'public_registration'
  const name = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const ticketTierId = (formData.get('ticket_tier_id') as string) || null

  if (!email || !name) return { error: 'Name and email are required' }

  const { error: insertError } = await supabase
    .from('attendees')
    .insert({
      event_id: eventId,
      name,
      email,
      phone,
      source: 'public_registration',
      registration_status: routeToWaitlist ? 'waitlist' : 'pending',
      ticket_tier_id: ticketTierId,
    })

  if (insertError) {
    if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
      return { error: 'You have already registered for this event with this email' }
    }
    // DB trigger fired — cap was hit between our check and the insert
    if (insertError.code === 'P0001' && insertError.message?.includes('REGISTRATION_CAP_REACHED')) {
      routeToWaitlist = true
      const { error: waitlistError } = await supabase
        .from('attendees')
        .insert({
          event_id: eventId,
          name,
          email,
          phone,
          source: 'public_registration',
          registration_status: 'waitlist',
          ticket_tier_id: ticketTierId,
        })
      if (waitlistError) {
        Sentry.captureException(waitlistError, { extra: { eventId, context: 'waitlist_insert_after_cap' } })
        return { error: waitlistError.message }
      }
    } else {
      Sentry.captureException(insertError, { extra: { eventId, context: 'submit_registration_insert' } })
      return { error: insertError.message }
    }
  }

  return { success: true, waitlisted: routeToWaitlist }
}

/**
 * Accept a registration — marks the attendee as accepted, creates an active invitation,
 * and triggers the invitation email with QR code.
 */
export async function acceptRegistration(attendeeId: string, eventId: string, selectedTierId?: string | null) {
  const supabase = await createClient()

  // 1. Get the attendee
  const { data: attendee, error: attendeeError } = await supabase
    .from('attendees')
    .select('*')
    .eq('id', attendeeId)
    .single()

  if (attendeeError || !attendee) return { error: 'Registrant not found' }
  if (attendee.registration_status === 'accepted') return { error: 'Already accepted' }

  // 2. Mark the attendee as accepted
  const { error: updateError } = await supabase
    .from('attendees')
    .update({ registration_status: 'accepted' })
    .eq('id', attendeeId)

  if (updateError) return { error: updateError.message }

  // 3. Create invitation for accepted attendee (party_size = 1 for open events)
  const tierIdToUse = selectedTierId !== undefined ? selectedTierId : attendee.ticket_tier_id

  const { data: invitation, error: invError } = await supabase
    .from('invitations')
    .insert({
      event_id: eventId,
      attendee_id: attendeeId,
      party_size: 1,
      status: 'active',
      ticket_tier_id: tierIdToUse ?? null,
    })
    .select()
    .single()

  if (invError) return { error: invError.message }

  // 4. Get event details for the email
  const { data: event } = await supabase
    .from('events')
    .select('name, date, time, venue, description, banner_url')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Event not found' }

  // 5. Trigger invitation email and WhatsApp
  let emailWarning: string | undefined = undefined
  if (attendee.email) {
    try {
      const emailResult = await sendInvitationEmail({
        eventId,
        recipientEmail: attendee.email,
        recipientName: attendee.name,
        invitationId: invitation.id,
        event,
      })
      if (emailResult && 'error' in emailResult && emailResult.error) {
        console.error('Failed to send invitation email:', emailResult.error)
        emailWarning = emailResult.error
      }
    } catch (e: any) {
      console.error('Failed to send invitation email:', e)
      Sentry.captureException(e, { extra: { attendeeId, eventId, context: 'accept_registration_email' } })
      emailWarning = e.message || 'Unknown email dispatch error'
    }
  }

  let whatsappWarning: string | undefined = undefined
  if (attendee.phone) {
    try {
      const whatsappResult = await sendInvitationWhatsApp({
        eventId,
        recipientPhone: attendee.phone,
        recipientName: attendee.name,
        invitationId: invitation.id,
        event,
      })
      if (whatsappResult && 'error' in whatsappResult && whatsappResult.error) {
        console.error('Failed to send WhatsApp invitation:', whatsappResult.error)
        whatsappWarning = whatsappResult.error
      }
    } catch (e: any) {
      console.error('Failed to send WhatsApp invitation:', e)
      Sentry.captureException(e, { extra: { attendeeId, eventId, context: 'accept_registration_whatsapp' } })
      whatsappWarning = e.message || 'Unknown WhatsApp dispatch error'
    }
  }

  revalidatePath(`/events/${eventId}/registrations`)
  revalidatePath(`/events/${eventId}/guests`)

  const warnings: string[] = []
  if (emailWarning) {
    warnings.push(`Email failed: ${emailWarning}`)
  }
  if (whatsappWarning) {
    warnings.push(`WhatsApp failed: ${whatsappWarning}`)
  }

  if (warnings.length > 0) {
    return {
      success: true,
      warning: `Registrant accepted, but some notifications failed to send: ${warnings.join('; ')}.`,
    }
  }

  return { success: true }
}

/**
 * Reject a registration — and auto-promote the next waitlisted person if one exists.
 */
export async function rejectRegistration(attendeeId: string, eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('attendees')
    .update({ registration_status: 'rejected' })
    .eq('id', attendeeId)

  if (error) return { error: error.message }

  // Auto-promote first waitlist entry if event has a cap and a spot just opened
  const { data: event } = await supabase
    .from('events')
    .select('max_registrations')
    .eq('id', eventId)
    .single()

  if (event?.max_registrations) {
    const { data: next } = await supabase
      .from('attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('source', 'public_registration')
      .eq('registration_status', 'waitlist')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (next) {
      await supabase
        .from('attendees')
        .update({ registration_status: 'pending' })
        .eq('id', next.id)
    }
  }

  revalidatePath(`/events/${eventId}/registrations`)
  return { success: true }
}

/**
 * Manually promote a waitlisted registration to pending for organiser review.
 */
export async function promoteFromWaitlist(attendeeId: string, eventId: string) {
  const supabase = await createClient()

  // Verify there is capacity before promoting
  const { data: event } = await supabase
    .from('events')
    .select('max_registrations')
    .eq('id', eventId)
    .single()

  if (event?.max_registrations) {
    const { count } = await supabase
      .from('attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('source', 'public_registration')
      .not('registration_status', 'in', '(rejected,waitlist)')

    if ((count ?? 0) >= event.max_registrations) {
      return { error: 'No capacity available — reject or accept another registration first.' }
    }
  }

  const { error } = await supabase
    .from('attendees')
    .update({ registration_status: 'pending' })
    .eq('id', attendeeId)
    .eq('registration_status', 'waitlist') // safety guard

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/registrations`)
  return { success: true }
}

/**
 * Send reminder emails to all accepted registrants / confirmed guests.
 */
export async function sendReminderEmails(eventId: string, customMessage: string) {
  const supabase = await createClient()

  // Get event
  const { data: event } = await supabase
    .from('events')
    .select('name, date, time, venue, event_type, banner_url')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Event not found' }

  // Get all non-cancelled invitations with attendee details
  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, status, attendee:attendees(email, name)')
    .eq('event_id', eventId)
    .neq('status', 'cancelled')

  const recipients = ((invitations ?? []) as any[])
    .map(inv => {
      const attendee = Array.isArray(inv.attendee) ? inv.attendee[0] : inv.attendee
      return { email: attendee?.email, name: attendee?.name, invitationId: inv.id }
    })
    .filter(r => r.email)

  if (recipients.length === 0) return { error: 'No confirmed guests with emails to send to' }

  try {
    const res = await sendReminderEmailsDirect({
      eventId,
      recipients,
      event,
      customMessage,
    })

    revalidatePath(`/events/${eventId}`)

    if (res.sent === 0 && (res as any).skipped > 0 && !res.errors?.length) {
      return { error: 'No emails sent — all guests have unsubscribed from emails.' }
    }

    if (res.sent === 0 && res.errors?.length) {
      return { error: `Failed to send reminders: ${res.errors.join(', ')}` }
    }

    return {
      success: true,
      count: res.sent,
      warning: res.errors?.length
        ? `Sent to ${res.sent} guest(s). Failed for: ${res.errors.join(', ')}`
        : undefined,
    }
  } catch (e: any) {
    Sentry.captureException(e, { extra: { eventId, context: 'send_reminder_emails' } })
    return { error: e.message || 'Failed to send reminder emails' }
  }
}
