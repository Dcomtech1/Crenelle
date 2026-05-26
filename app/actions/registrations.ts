'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvitationEmail, sendReminderEmailsDirect } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Public registration — called from the public registration form.
 * Uses admin client to bypass RLS (no user session exists for public visitors).
 */
export async function submitRegistration(eventId: string, formData: FormData) {
  const supabase = createAdminClient()

  // ── Rate limiting (CAN-SPAM / anti-spam) ──────────────────────
  // Derive a best-effort IP from forwarded headers.
  const headerStore = await headers()
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    'unknown'

  const email = (formData.get('email') as string)?.trim().toLowerCase() ?? ''

  // 10 attempts per IP per 15 minutes
  const ipLimit = checkRateLimit({ key: `reg_ip:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 })
  if (!ipLimit.allowed) {
    return { error: 'Too many registration attempts from your network. Please try again later.' }
  }

  // 3 attempts per email per hour (catches email enumeration)
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
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('status', 'in', '(rejected,waitlist)')

    if ((count ?? 0) >= event.max_registrations) {
      routeToWaitlist = true
    }
  }

  // 3. Check unsubscribe list — don't accept registrations from opted-out emails
  const { data: unsub } = await supabase
    .from('email_unsubscribes')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (unsub) {
    // Silent success — don't leak which emails are on the list
    return { success: true }
  }

  // 4. Insert registration (pending or waitlist)
  const fullName = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!email || !fullName) return { error: 'Name and email are required' }

  const { error: insertError } = await supabase
    .from('registrations')
    .insert({
      event_id: eventId,
      full_name: fullName,
      email,
      phone,
      status: routeToWaitlist ? 'waitlist' : 'pending',
    })

  if (insertError) {
    if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
      return { error: 'You have already registered for this event with this email' }
    }
    // DB trigger fired — cap was hit between our check and the insert
    if (insertError.code === 'P0001' && insertError.message?.includes('REGISTRATION_CAP_REACHED')) {
      routeToWaitlist = true
      // Re-insert as waitlist
      const { error: waitlistError } = await supabase
        .from('registrations')
        .insert({
          event_id: eventId,
          full_name: fullName,
          email,
          phone,
          status: 'waitlist',
        })
      if (waitlistError) return { error: waitlistError.message }
    } else {
      return { error: insertError.message }
    }
  }

  return { success: true, waitlisted: routeToWaitlist }
}

/**
 * Accept a registration — creates a guest + invitation (party_size = 1),
 * and triggers the invitation email with QR code.
 */
export async function acceptRegistration(registrationId: string, eventId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Get the registration
  const { data: reg, error: regError } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .single()

  if (regError || !reg) return { error: 'Registration not found' }
  if (reg.status === 'accepted') return { error: 'Already accepted' }

  // 2. Update status to accepted
  const { error: updateError } = await supabase
    .from('registrations')
    .update({ status: 'accepted' })
    .eq('id', registrationId)

  if (updateError) return { error: updateError.message }

  // 3. Create guest record
  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .insert({
      event_id: eventId,
      name: reg.full_name,
      phone: reg.phone,
      email: reg.email,
    })
    .select()
    .single()

  if (guestError) return { error: guestError.message }

  // 4. Create invitation (party_size = 1 for open events)
  const { data: invitation, error: invError } = await supabase
    .from('invitations')
    .insert({
      event_id: eventId,
      guest_id: guest.id,
      party_size: 1,
    })
    .select()
    .single()

  if (invError) return { error: invError.message }

  // 5. Get event details for the email
  const { data: event } = await supabase
    .from('events')
    .select('name, date, time, venue, description, banner_url')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Event not found' }

  // 6. Trigger invitation email directly
  try {
    await sendInvitationEmail({
      eventId,
      recipientEmail: reg.email,
      recipientName: reg.full_name,
      invitationId: invitation.id,
      event,
    })
  } catch (e) {
    // Email failure shouldn't block the acceptance
    console.error('Failed to send invitation email:', e)
  }

  revalidatePath(`/events/${eventId}/registrations`)
  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

/**
 * Reject a registration — and auto-promote the next waitlisted person if one exists.
 */
export async function rejectRegistration(registrationId: string, eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('registrations')
    .update({ status: 'rejected' })
    .eq('id', registrationId)

  if (error) return { error: error.message }

  // Auto-promote first waitlist entry if event has a cap and a spot just opened
  const { data: event } = await supabase
    .from('events')
    .select('max_registrations')
    .eq('id', eventId)
    .single()

  if (event?.max_registrations) {
    const { data: next } = await supabase
      .from('registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'waitlist')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (next) {
      await supabase
        .from('registrations')
        .update({ status: 'pending' })
        .eq('id', next.id)
    }
  }

  revalidatePath(`/events/${eventId}/registrations`)
  return { success: true }
}

/**
 * Manually promote a waitlisted registration to pending for organiser review.
 */
export async function promoteFromWaitlist(registrationId: string, eventId: string) {
  const supabase = await createClient()

  // Verify there is capacity before promoting
  const { data: event } = await supabase
    .from('events')
    .select('max_registrations')
    .eq('id', eventId)
    .single()

  if (event?.max_registrations) {
    const { count } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('status', 'in', '(rejected,waitlist)')

    if ((count ?? 0) >= event.max_registrations) {
      return { error: 'No capacity available — reject or accept another registration first.' }
    }
  }

  const { error } = await supabase
    .from('registrations')
    .update({ status: 'pending' })
    .eq('id', registrationId)
    .eq('status', 'waitlist') // safety: only promote if still waitlisted

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

  // Get all non-cancelled invitations with guest details (event-type agnostic)
  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, status, guest:guests(email, name)')
    .eq('event_id', eventId)
    .neq('status', 'cancelled')

  const recipients = ((invitations ?? []) as any[])
    .map(inv => {
      const guest = Array.isArray(inv.guest) ? inv.guest[0] : inv.guest
      return { email: guest?.email, name: guest?.name, invitationId: inv.id }
    })
    .filter(r => r.email)

  if (recipients.length === 0) return { error: 'No confirmed guests with emails to send to' }

  // Send directly
  try {
    const res = await sendReminderEmailsDirect({
      eventId,
      recipients,
      event,
      customMessage,
    })

    revalidatePath(`/events/${eventId}`)

    // Surface partial failures as a warning rather than a hard error.
    // res.success is false if ANY recipient failed, but some may have succeeded.
    if (res.sent === 0) {
      return { error: `Failed to send reminders: ${res.errors?.join(', ') || 'Unknown error'}` }
    }

    return {
      success: true,
      count: res.sent,
      warning: res.errors?.length
        ? `Sent to ${res.sent} guest(s). Failed for: ${res.errors.join(', ')}`
        : undefined,
    }
  } catch (e: any) {
    return { error: e.message || 'Failed to send reminder emails' }
  }
}
