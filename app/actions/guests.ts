'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendInvitationEmail } from '@/lib/email'

export async function addGuest(eventId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const phone = (formData.get('phone') as string) || null
  const email = (formData.get('email') as string) || null
  const partySize = Number(formData.get('party_size')) || 1
  const seatInfo = (formData.get('seat_info') as string) || null

  // Insert guest
  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .insert({ event_id: eventId, name, phone, email })
    .select()
    .single()

  if (guestError) return { error: guestError.message }

  // Create invitation (the QR code record)
  const { data: invitation, error: invError } = await supabase
    .from('invitations')
    .insert({
      event_id: eventId,
      guest_id: guest.id,
      party_size: partySize,
      seat_info: seatInfo,
    })
    .select()
    .single()

  if (invError || !invitation) return { error: invError?.message || 'Failed to generate invitation' }

  // Automatically send the invitation email if email is provided
  if (email) {
    const { data: event } = await supabase
      .from('events')
      .select('name, date, time, venue, description, banner_url')
      .eq('id', eventId)
      .single()

    if (event) {
      try {
        await sendInvitationEmail({
          eventId,
          recipientEmail: email,
          recipientName: name,
          invitationId: invitation.id,
          event,
        })
      } catch (e) {
        console.error('Failed to send automated invitation email:', e)
      }
    }
  }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

export async function addMultipleGuests(eventId: string, emailsText: string, partySize: number) {
  const supabase = await createClient()

  // Split by newlines, commas, semicolons, or spaces
  const rawEmails = emailsText.split(/[\n,;\s]+/)
  const uniqueEmails = Array.from(
    new Set(
      rawEmails
        .map(e => e.trim().toLowerCase())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  )

  if (uniqueEmails.length === 0) {
    return { error: 'No valid email addresses found in the input.' }
  }

  // Fetch event details to send invitation emails
  const { data: event } = await supabase
    .from('events')
    .select('name, date, time, venue, description, banner_url')
    .eq('id', eventId)
    .single()

  let addedCount = 0
  const errors: string[] = []

  for (const email of uniqueEmails) {
    try {
      // Create guest name from email prefix: e.g. john.doe@email.com -> "John Doe"
      const prefix = email.split('@')[0]
      const name = prefix
        .split(/[-._+]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Guest'

      // Insert guest
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({ event_id: eventId, name, email })
        .select()
        .single()

      if (guestError) {
        errors.push(`${email}: ${guestError.message}`)
        continue
      }

      // Create invitation
      const { data: invitation, error: invError } = await supabase
        .from('invitations')
        .insert({
          event_id: eventId,
          guest_id: guest.id,
          party_size: partySize,
        })
        .select()
        .single()

      if (invError || !invitation) {
        errors.push(`${email}: ${invError?.message || 'Failed to create QR invitation'}`)
        continue
      }

      addedCount++

      // Send email invitation asynchronously (non-blocking so bulk insert doesn't timeout)
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

        // Throttle slightly to respect Resend's free tier rate limits safely
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

export async function updateGuest(guestId: string, eventId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('guests')
    .update({
      name: formData.get('name') as string,
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
    })
    .eq('id', guestId)

  if (error) return { error: error.message }

  // Update invitation
  const partySize = Number(formData.get('party_size')) || 1
  const seatInfo = (formData.get('seat_info') as string) || null

  await supabase
    .from('invitations')
    .update({ party_size: partySize, seat_info: seatInfo })
    .eq('guest_id', guestId)

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

export async function deleteGuest(guestId: string, eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('guests').delete().eq('id', guestId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}
