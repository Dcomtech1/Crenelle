'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendInvitationEmail } from '@/lib/email'
import { validateEmailBlob } from '@/lib/validations/guest-import'

export async function addAttendee(eventId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const phone = (formData.get('phone') as string) || null
  const email = (formData.get('email') as string) || null
  const partySize = Number(formData.get('party_size')) || 1
  const seatInfo = (formData.get('seat_info') as string) || null
  const ticketTierId = (formData.get('ticket_tier_id') as string) || null

  // Insert attendee
  const { data: attendee, error: attendeeError } = await supabase
    .from('attendees')
    .insert({
      event_id: eventId,
      name,
      phone,
      email,
      source: 'manual',
      registration_status: null
    })
    .select()
    .single()

  if (attendeeError) return { error: attendeeError.message }

  // Create invitation (the QR code record)
  const { data: invitation, error: invError } = await supabase
    .from('invitations')
    .insert({
      event_id: eventId,
      attendee_id: attendee.id,
      party_size: partySize,
      seat_info: seatInfo,
      status: 'pending',
      ticket_tier_id: ticketTierId
    })
    .select()
    .single()

  if (invError || !invitation) {
    return { error: invError?.message || 'Failed to generate invitation' }
  }

  // Automatically send the invitation email if email is provided
  let emailWarning: string | undefined = undefined
  if (email) {
    const { data: event } = await supabase
      .from('events')
      .select('name, date, time, venue, description, banner_url')
      .eq('id', eventId)
      .single()

    if (event) {
      try {
        const emailResult = await sendInvitationEmail({
          eventId,
          recipientEmail: email,
          recipientName: name,
          invitationId: invitation.id,
          event,
        })
        if (emailResult && 'error' in emailResult && emailResult.error) {
          console.error('Failed to send automated invitation email:', emailResult.error)
          emailWarning = emailResult.error
        }
      } catch (e: any) {
        console.error('Failed to send automated invitation email:', e)
        emailWarning = e.message || 'Unknown email dispatch error'
      }
    }
  }

  revalidatePath(`/events/${eventId}/guests`)

  if (emailWarning) {
    return {
      success: true,
      warning: `Guest added, but the invitation email failed to send: ${emailWarning}. If you are in sandbox mode, you can only send emails to your own registered email address.`,
    }
  }

  return { success: true }
}

export async function addMultipleAttendees(eventId: string, emailsText: string, partySize: number) {
  const supabase = await createClient()

  // Validate and deduplicate using Zod-backed parser
  const { valid: uniqueEmails, invalid: invalidEntries } = validateEmailBlob(emailsText)

  if (uniqueEmails.length === 0) {
    const hint = invalidEntries.length > 0
      ? ` These entries were invalid: ${invalidEntries.slice(0, 5).join(', ')}${invalidEntries.length > 5 ? ` …and ${invalidEntries.length - 5} more` : ''}`
      : ''
    return { error: `No valid email addresses found in the input.${hint}` }
  }

  // Validate party size explicitly
  const safePartySize = Math.max(1, Math.min(50, Math.floor(partySize) || 1))

  // Fetch event details to send invitation emails
  const { data: event } = await supabase
    .from('events')
    .select('name, date, time, venue, description, banner_url')
    .eq('id', eventId)
    .single()

  let addedCount = 0
  const errors: string[] = []

  // Report invalid entries upfront
  if (invalidEntries.length > 0) {
    errors.push(`Skipped ${invalidEntries.length} invalid entr${invalidEntries.length === 1 ? 'y' : 'ies'}: ${invalidEntries.slice(0, 3).join(', ')}${invalidEntries.length > 3 ? '…' : ''}`)
  }

  for (const email of uniqueEmails) {
    try {
      // Create attendee name from email prefix
      const prefix = email.split('@')[0]
      const name = prefix
        .split(/[-._+]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Guest'

      // Insert attendee
      const { data: attendee, error: attendeeError } = await supabase
        .from('attendees')
        .insert({
          event_id: eventId,
          name,
          email,
          source: 'imported',
          registration_status: null
        })
        .select()
        .single()

      if (attendeeError) {
        errors.push(`${email}: ${attendeeError.message}`)
        continue
      }

      // Create invitation
      const { data: invitation, error: invError } = await supabase
        .from('invitations')
        .insert({
          event_id: eventId,
          attendee_id: attendee.id,
          party_size: safePartySize,
          status: 'pending'
        })
        .select()
        .single()

      if (invError || !invitation) {
        errors.push(`${email}: ${invError?.message || 'Failed to create QR invitation'}`)
        continue
      }

      addedCount++

      // Send email invitation asynchronously
      if (event) {
        sendInvitationEmail({
          eventId,
          recipientEmail: email,
          recipientName: name,
          invitationId: invitation.id,
          event,
        }).catch(err => {
          console.error(`Failed to send bulk invitation to ${email}:`, err)
        })

        // Throttle slightly
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (e: any) {
      console.error(`Bulk import error for ${email}:`, e)
      errors.push(`${email}: ${e.message || 'unknown error'}`)
    }
  }

  revalidatePath(`/events/${eventId}/guests`)

  if (errors.length > 0 && addedCount === 0) {
    return { error: `Failed to import guests: ${errors.join(', ')}` }
  }

  return {
    success: true,
    count: addedCount,
    warning: errors.length > 0 ? `Imported ${addedCount} guests, but encountered errors for: ${errors.join(', ')}` : undefined
  }
}

export async function updateAttendee(attendeeId: string, eventId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const phone = (formData.get('phone') as string) || null
  const email = (formData.get('email') as string) || null

  const { error } = await supabase
    .from('attendees')
    .update({ name, phone, email })
    .eq('id', attendeeId)

  if (error) return { error: error.message }

  // Update invitation
  const partySize = Number(formData.get('party_size')) || 1
  const seatInfo = (formData.get('seat_info') as string) || null
  const ticketTierId = (formData.get('ticket_tier_id') as string) || null

  await supabase
    .from('invitations')
    .update({
      party_size: partySize,
      seat_info: seatInfo,
      ticket_tier_id: ticketTierId
    })
    .eq('attendee_id', attendeeId)

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

export async function cancelAttendeeInvitation(attendeeId: string, eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'cancelled' })
    .eq('attendee_id', attendeeId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

export async function updateAttendeeTicketTier(attendeeId: string, eventId: string, ticketTierId: string | null) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invitations')
    .update({ ticket_tier_id: ticketTierId || null })
    .eq('attendee_id', attendeeId)

  if (error) {
    if (error.message?.includes('tier_capacity_exceeded')) {
      return { error: 'Capacity exceeded for this ticket tier.' }
    }
    return { error: error.message }
  }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

