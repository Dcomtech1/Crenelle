import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

// Lazy init — avoids crash at build time when env var isn't set yet
let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

// The "from" address — must be verified in Resend dashboard
const FROM_EMAIL = process.env.EMAIL_FROM || 'GateKeep <onboarding@resend.dev>'

export interface EventDetails {
  name: string
  date: string
  time: string | null
  venue: string
  description?: string | null
}

export interface InvitationEmailOptions {
  eventId: string
  recipientEmail: string
  recipientName: string
  invitationId: string
  event: EventDetails
}

export interface ReminderEmailRecipient {
  email: string
  name: string
  invitationId: string
}

export interface ReminderEmailsOptions {
  eventId: string
  recipients: ReminderEmailRecipient[]
  event: EventDetails
  customMessage: string
}

/**
 * Sends a single unique invitation email containing the entry QR code.
 */
export async function sendInvitationEmail({
  eventId,
  recipientEmail,
  recipientName,
  invitationId,
  event,
}: InvitationEmailOptions) {
  const supabase = createAdminClient()

  // Generate QR code URL using a hosted API (robust for emails)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${invitationId}&color=0A0A0A&bgcolor=F0EDE8`;

  const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:'Courier New',monospace;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <!-- Header -->
    <div style="border:2px solid #F0EDE8;padding:30px;margin-bottom:0;">
      <p style="font-size:10px;letter-spacing:3px;color:#FFD600;margin:0 0 8px 0;text-transform:uppercase;">
        YOU'RE IN — INVITATION CONFIRMED
      </p>
      <h1 style="font-size:36px;color:#F0EDE8;margin:0;text-transform:uppercase;letter-spacing:-1px;">
        ${event.name}
      </h1>
    </div>

    <!-- Event Details -->
    <div style="border:2px solid #F0EDE8;border-top:none;padding:24px 30px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;width:100px;">DATE</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${eventDate}</td>
        </tr>
        ${event.time ? `
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;">TIME</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${event.time.slice(0, 5)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;">VENUE</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${event.venue}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;">GUEST</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${recipientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;">ADMITS</td>
          <td style="padding:8px 0;font-size:14px;color:#FFD600;font-weight:bold;">1 PERSON</td>
        </tr>
      </table>
    </div>

    <!-- QR Code -->
    <div style="border:2px solid #F0EDE8;border-top:none;padding:30px;text-align:center;">
      <p style="font-size:10px;letter-spacing:3px;color:rgba(240,237,232,0.6);margin:0 0 16px 0;text-transform:uppercase;">
        YOUR ENTRY PASS — SCAN AT THE GATE
      </p>
      <div style="display:inline-block;border:2px solid rgba(240,237,232,0.3);padding:8px;background:#F0EDE8;">
        <img src="${qrUrl}" alt="Entry QR Code" width="200" height="200" style="display:block;" />
      </div>
      <p style="font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.4);margin:16px 0 0 0;text-transform:uppercase;">
        This QR code is unique to you. Do not share it.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 0;text-align:center;">
      <p style="font-size:8px;letter-spacing:3px;color:rgba(240,237,232,0.3);margin:0;text-transform:uppercase;">
        GATEKEEP_ENTRY_SYSTEM // VERIFIED_INVITATION
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const { error: sendError } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `You're confirmed — ${event.name}`,
      html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return { error: sendError.message || 'Failed to send email' }
    }

    // Log the email
    await supabase.from('email_logs').insert({
      event_id: eventId,
      recipient_email: recipientEmail,
      email_type: 'invitation',
      subject: `You're confirmed — ${event.name}`,
    })

    return { success: true }
  } catch (e: any) {
    console.error('Email send error:', e)
    return { error: e.message || 'Failed to send email' }
  }
}

/**
 * Sends bulk reminders to a list of recipients sequentially.
 */
export async function sendReminderEmailsDirect({
  eventId,
  recipients,
  event,
  customMessage,
}: ReminderEmailsOptions) {
  const supabase = createAdminClient()

  const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  let sent = 0
  const errors: string[] = []

  for (const recipient of recipients) {
    // Generate QR code URL using a hosted API (robust for emails)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${recipient.invitationId}&color=0A0A0A&bgcolor=F0EDE8`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:'Courier New',monospace;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <!-- Header -->
    <div style="border:2px solid #F0EDE8;padding:30px;margin-bottom:0;">
      <p style="font-size:10px;letter-spacing:3px;color:#FFD600;margin:0 0 8px 0;text-transform:uppercase;">
        EVENT REMINDER
      </p>
      <h1 style="font-size:36px;color:#F0EDE8;margin:0;text-transform:uppercase;letter-spacing:-1px;">
        ${event.name}
      </h1>
    </div>

    <!-- Custom message -->
    ${customMessage ? `
    <div style="border:2px solid #F0EDE8;border-top:none;padding:24px 30px;">
      <p style="font-size:14px;color:#F0EDE8;line-height:1.6;margin:0;white-space:pre-wrap;">${customMessage}</p>
    </div>` : ''}

    <!-- Event Details -->
    <div style="border:2px solid #F0EDE8;border-top:none;padding:24px 30px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;width:100px;">DATE</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${eventDate}</td>
        </tr>
        ${event.time ? `
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;">TIME</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${event.time.slice(0, 5)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;font-size:10px;letter-spacing:2px;color:rgba(240,237,232,0.6);text-transform:uppercase;">VENUE</td>
          <td style="padding:8px 0;font-size:14px;color:#F0EDE8;">${event.venue}</td>
        </tr>
      </table>
    </div>

    <!-- QR Code -->
    <div style="border:2px solid #F0EDE8;border-top:none;padding:30px;text-align:center;">
      <p style="font-size:10px;letter-spacing:3px;color:rgba(240,237,232,0.6);margin:0 0 16px 0;text-transform:uppercase;">
        YOUR ENTRY PASS
      </p>
      <div style="display:inline-block;border:2px solid rgba(240,237,232,0.3);padding:8px;background:#F0EDE8;">
        <img src="${qrUrl}" alt="Entry QR Code" width="200" height="200" style="display:block;" />
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 0;text-align:center;">
      <p style="font-size:8px;letter-spacing:3px;color:rgba(240,237,232,0.3);margin:0;text-transform:uppercase;">
        GATEKEEP_ENTRY_SYSTEM // EVENT_REMINDER
      </p>
    </div>
  </div>
</body>
</html>`

    try {
      const { error: sendError } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: `Reminder — ${event.name}`,
        html,
      })

      if (sendError) {
        console.error(`Resend error for ${recipient.email}:`, sendError)
        errors.push(`${recipient.email}: ${sendError.message || 'unknown error'}`)
      } else {
        sent++
        // Log the email
        await supabase.from('email_logs').insert({
          event_id: eventId,
          recipient_email: recipient.email,
          email_type: 'reminder',
          subject: `Reminder — ${event.name}`,
        })
      }
    } catch (e: any) {
      console.error(`Exception sending reminder to ${recipient.email}:`, e)
      errors.push(`${recipient.email}: ${e.message || 'failed exception'}`)
    }
  }

  return {
    success: errors.length === 0,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  }
}
