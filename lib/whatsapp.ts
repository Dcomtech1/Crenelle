import { createAdminClient } from '@/lib/supabase/admin'

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'crenelle_invite'

export interface EventDetails {
  name: string
  date: string
  time: string | null
  venue: string
}

export interface InvitationWhatsAppOptions {
  eventId: string
  recipientPhone: string
  recipientName: string
  invitationId: string
  event: EventDetails
}

/**
 * Normalises phone numbers to international format required by WhatsApp API (e.g. 2348030000000)
 */
export function normalisePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')

  // If number starts with 0 and has 11 digits (e.g. 08031234567 in Nigeria), prepend 234
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '234' + cleaned.slice(1)
  }

  // Prepend 234 for Nigerian numbers that are typed as 8031234567 (10 digits)
  if (cleaned.length === 10 && (cleaned.startsWith('7') || cleaned.startsWith('8') || cleaned.startsWith('9'))) {
    cleaned = '234' + cleaned
  }

  return cleaned
}

/**
 * Formats a 24-hour time string into a friendly 12-hour format (e.g. "2:30 PM").
 */
function formatTimeTo12Hour(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  if (isNaN(hour)) return timeStr
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${ampm}`
}

/**
 * Dispatches a WhatsApp Ticket/Invitation Template via Meta WhatsApp Cloud API.
 */
export async function sendInvitationWhatsApp({
  eventId,
  recipientPhone,
  recipientName,
  invitationId,
  event,
}: InvitationWhatsAppOptions) {
  if (!WHATSAPP_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[whatsapp] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured. WhatsApp dispatch skipped.')
    return { success: false, skipped: true }
  }

  const supabase = createAdminClient()

  // Fetch invitation with details (to get qr_token, attendee details)
  const { data: invitation, error: invFetchError } = await supabase
    .from('invitations')
    .select('*, attendee:attendees(name, email, phone)')
    .eq('id', invitationId)
    .single()

  if (invFetchError || !invitation) {
    console.error('[whatsapp] Failed to fetch invitation for WhatsApp:', invFetchError)
    return { error: 'Failed to fetch invitation details' }
  }

  const qrToken = invitation.qr_token
  const formattedPhone = normalisePhoneNumber(recipientPhone)

  if (!formattedPhone) {
    console.error('[whatsapp] Empty or invalid recipient phone number')
    return { error: 'Invalid phone number' }
  }

  // Dynamic QR Code URL hosted online
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${qrToken}&color=0A0A0A&bgcolor=F0EDE8`

  const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const eventTime = event.time ? formatTimeTo12Hour(event.time) : 'N/A'
  const guestName = invitation.attendee?.name || recipientName

  // Format payload for Meta's Cloud API Graph API
  // Template parameters mapping:
  // Header: Dynamic image QR Code URL
  // Body parameter {{1}}: Guest Name
  // Body parameter {{2}}: Event Title
  // Body parameter {{3}}: Event Date
  // Body parameter {{4}}: Event Time
  // Body parameter {{5}}: Event Venue
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: {
        code: 'en_US'
      },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: {
                url: qrUrl
              }
            }
          ]
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: guestName },
            { type: 'text', text: event.name },
            { type: 'text', text: eventDate },
            { type: 'text', text: eventTime },
            { type: 'text', text: event.venue }
          ]
        }
      ]
    }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const result = await res.json()

    if (!res.ok || result.error) {
      console.error('[whatsapp] Meta Cloud API error response:', result)
      return { error: result.error?.message || 'Meta WhatsApp Cloud API error' }
    }

    console.log(`[whatsapp] WhatsApp invitation successfully delivered to ${formattedPhone}`)

    // Log the message dispatch in email_logs under a custom type of 'whatsapp_invitation'
    try {
      await supabase.from('email_logs').insert({
        event_id: eventId,
        recipient_email: invitation.attendee?.email || `${formattedPhone}@whatsapp.meta`,
        email_type: 'whatsapp_invitation',
        subject: `WhatsApp Confirmation — ${event.name}`,
      })
    } catch (logErr) {
      console.error('[whatsapp] Non-blocking warning: Failed to insert log in email_logs:', logErr)
    }

    return { success: true }
  } catch (error: any) {
    console.error('[whatsapp] Request exception during WhatsApp Graph API dispatch:', error)
    return { error: error.message || 'Network error sending WhatsApp message via Meta Cloud API' }
  }
}
