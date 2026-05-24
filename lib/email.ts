import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOptimizedBannerUrl } from './images'

// Lazy init — avoids crash at build time when env var isn't set yet
let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

// The sending address — domain must be verified in your Resend dashboard.
// Set EMAIL_FROM_ADDRESS=noreply@yourdomain.com in .env.local.
// Falls back to the legacy EMAIL_FROM value (address part only) if not set.
const SENDING_ADDRESS = (
  process.env.EMAIL_FROM_ADDRESS ||
  process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
  'onboarding@resend.dev'
)

/** Organisation/organiser identity used to personalise the From header and Reply-To. */
export interface OrganizerDetails {
  /** Display name shown in the From field, e.g. "Acme Events" */
  name: string
  /** Organiser's own email address — used as Reply-To */
  email: string
}

/**
 * Looks up the organiser of an event via the Supabase auth admin client.
 * Tries user_metadata.full_name → user_metadata.name → email prefix as display name.
 * Returns a safe fallback if the user record cannot be retrieved.
 */
async function fetchOrganizerForEvent(eventId: string): Promise<OrganizerDetails> {
  const admin = createAdminClient()

  // Fetch the event together with its linked sender profile in one round-trip
  const { data: event } = await admin
    .from('events')
    .select('organizer_id, sender_profile_id, sender_profiles(display_name, reply_to)')
    .eq('id', eventId)
    .single()

  // ── Tier 1: event has an explicit sender profile linked ────────
  const profile = event?.sender_profiles as
    | { display_name: string; reply_to: string }
    | null
    | undefined
  if (profile?.display_name && profile?.reply_to) {
    return { name: profile.display_name, email: profile.reply_to }
  }

  // ── Tier 2: organizer's default sender profile ─────────────────
  if (event?.organizer_id) {
    const { data: defaultProfile } = await admin
      .from('sender_profiles')
      .select('display_name, reply_to')
      .eq('organizer_id', event.organizer_id)
      .eq('is_default', true)
      .single()

    if (defaultProfile?.display_name && defaultProfile?.reply_to) {
      return { name: defaultProfile.display_name, email: defaultProfile.reply_to }
    }
  }

  // ── Tier 3: auth user metadata (original fallback) ─────────────
  if (!event?.organizer_id) return { name: 'Crenelle', email: '' }

  try {
    const { data: { user } } = await admin.auth.admin.getUserById(event.organizer_id)
    const name =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      'Crenelle'
    return { name, email: user?.email ?? '' }
  } catch {
    return { name: 'Crenelle', email: '' }
  }
}

export interface EventDetails {
  name: string
  date: string
  time: string | null
  venue: string
  description?: string | null
  banner_url?: string | null
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

  // Resolve organiser identity for From header and Reply-To
  const organizer = await fetchOrganizerForEvent(eventId)

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
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    @media (prefers-color-scheme: dark) {
      .bg-body {
        background-color: #0C0B09 !important;
      }
      .bg-card {
        background-color: #171512 !important;
      }
      .border-card {
        border-color: rgba(238, 234, 227, 0.10) !important;
      }
      .text-primary {
        color: #EEEAE3 !important;
      }
      .text-secondary {
        color: #9E9890 !important;
      }
      .text-accent {
        color: #D4A050 !important;
      }
      .qr-wrapper {
        background-color: #EEEAE3 !important;
        border: 2px solid rgba(238, 234, 227, 0.20) !important;
      }
      .rule-accent {
        background: linear-gradient(to right, transparent, rgba(191, 132, 48, 0.6), transparent) !important;
      }
    }
  </style>
</head>
<body class="bg-body" style="margin:0;padding:0;background-color:#F4F1EC;font-family:'Courier New',Courier,monospace;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <!-- Outer Card -->
    <div class="bg-card border-card" style="background-color:#FFFFFF;border:1px solid rgba(12,11,9,0.14);border-radius:2px;padding:40px;box-shadow:0 4px 12px rgba(12,11,9,0.02);">
      
      <!-- Top Branding -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td>
            <span class="text-accent" style="font-size:10px;font-weight:600;letter-spacing:4px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">CRENELLE</span>
          </td>
          <td style="text-align:right;">
            <span class="text-secondary" style="font-size:9px;letter-spacing:1px;color:#5C5850;text-transform:uppercase;">Entry System</span>
          </td>
        </tr>
      </table>

      ${event.banner_url ? `
      <!-- Banner Image -->
      <div style="margin-bottom:24px;border:1px solid rgba(12,11,9,0.08);border-radius:2px;overflow:hidden;background-color:#F4F1EC;">
        <img src="${getOptimizedBannerUrl(event.banner_url, 'email')}" alt="${event.name} Banner" style="width:100%;height:auto;display:block;border:none;" />
      </div>
      ` : ''}

      <!-- Title / Header -->
      <div style="margin-bottom:30px;">
        <p class="text-accent" style="font-size:11px;font-weight:bold;letter-spacing:3px;color:#BF8430;margin:0 0 10px 0;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          CONFIRMED ENTRY PASS
        </p>
        <h1 class="text-primary" style="font-size:32px;line-height:1.2;font-weight:800;color:#0C0B09;margin:0;text-transform:uppercase;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${event.name}
        </h1>
      </div>

      <!-- Accent line -->
      <div class="rule-accent" style="height:1px;background:linear-gradient(to right, transparent, rgba(191,132,48,0.3), transparent);margin-bottom:30px;"></div>

      <!-- Details Table -->
      <div style="margin-bottom:35px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;width:120px;font-weight:600;">DATE</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${eventDate}</td>
          </tr>
          ${event.time ? `
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;">TIME</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${event.time.slice(0, 5)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;">VENUE</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${event.venue}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;">GUEST</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${recipientName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;">ADMITS</td>
            <td class="text-accent" style="padding:10px 0;font-size:15px;color:#BF8430;font-weight:bold;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">1 PERSON</td>
          </tr>
        </table>
      </div>

      <!-- Divider -->
      <div class="rule-accent" style="height:1px;background:linear-gradient(to right, transparent, rgba(191,132,48,0.2), transparent);margin-bottom:35px;"></div>

      <!-- QR Section -->
      <div style="text-align:center;">
        <p class="text-secondary" style="font-size:10px;letter-spacing:3px;color:#5C5850;margin:0 0 20px 0;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          SCAN AT THE GATE FOR ENTRY
        </p>
        <div class="qr-wrapper" style="display:inline-block;border:1px solid rgba(12,11,9,0.08);padding:16px;background-color:#F4F1EC;border-radius:2px;">
          <img src="${qrUrl}" alt="Entry QR Code" width="220" height="220" style="display:block;border:none;" />
        </div>
        <p class="text-secondary" style="font-size:10px;letter-spacing:1px;color:#5C5850;margin:20px 0 0 0;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          This pass is unique to you. Do not replicate or share.
        </p>
      </div>

    </div>

    <!-- Micro Footer -->
    <div style="padding:30px 0 10px 0;text-align:center;">
      <p class="text-secondary" style="font-size:9px;letter-spacing:2.5px;color:#5C5850;margin:0;text-transform:uppercase;">
        CRENELLE // VERIFIED_INVITATION
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const { error: sendError } = await getResend().emails.send({
      from: `${organizer.name} <${SENDING_ADDRESS}>`,
      ...(organizer.email ? { reply_to: organizer.email } : {}),
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

  // Resolve organiser identity once — shared across all recipients in this batch
  const organizer = await fetchOrganizerForEvent(eventId)

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
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    @media (prefers-color-scheme: dark) {
      .bg-body {
        background-color: #0C0B09 !important;
      }
      .bg-card {
        background-color: #171512 !important;
      }
      .border-card {
        border-color: rgba(238, 234, 227, 0.10) !important;
      }
      .text-primary {
        color: #EEEAE3 !important;
      }
      .text-secondary {
        color: #9E9890 !important;
      }
      .text-accent {
        color: #D4A050 !important;
      }
      .qr-wrapper {
        background-color: #EEEAE3 !important;
        border: 2px solid rgba(238, 234, 227, 0.20) !important;
      }
      .rule-accent {
        background: linear-gradient(to right, transparent, rgba(191, 132, 48, 0.6), transparent) !important;
      }
      .message-callout {
        background-color: rgba(191, 132, 48, 0.08) !important;
        border-color: rgba(191, 132, 48, 0.3) !important;
        color: #EEEAE3 !important;
      }
    }
  </style>
</head>
<body class="bg-body" style="margin:0;padding:0;background-color:#F4F1EC;font-family:'Courier New',Courier,monospace;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <!-- Outer Card -->
    <div class="bg-card border-card" style="background-color:#FFFFFF;border:1px solid rgba(12,11,9,0.14);border-radius:2px;padding:40px;box-shadow:0 4px 12px rgba(12,11,9,0.02);">
      
      <!-- Top Branding -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td>
            <span class="text-accent" style="font-size:10px;font-weight:600;letter-spacing:4px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">CRENELLE</span>
          </td>
          <td style="text-align:right;">
            <span class="text-secondary" style="font-size:9px;letter-spacing:1px;color:#5C5850;text-transform:uppercase;">Entry System</span>
          </td>
        </tr>
      </table>

      ${event.banner_url ? `
      <!-- Banner Image -->
      <div style="margin-bottom:24px;border:1px solid rgba(12,11,9,0.08);border-radius:2px;overflow:hidden;background-color:#F4F1EC;">
        <img src="${getOptimizedBannerUrl(event.banner_url, 'email')}" alt="${event.name} Banner" style="width:100%;height:auto;display:block;border:none;" />
      </div>
      ` : ''}

      <!-- Title / Header -->
      <div style="margin-bottom:30px;">
        <p class="text-accent" style="font-size:11px;font-weight:bold;letter-spacing:3px;color:#BF8430;margin:0 0 10px 0;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          EVENT REMINDER & PASS
        </p>
        <h1 class="text-primary" style="font-size:32px;line-height:1.2;font-weight:800;color:#0C0B09;margin:0;text-transform:uppercase;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${event.name}
        </h1>
      </div>

      <!-- Accent line -->
      <div class="rule-accent" style="height:1px;background:linear-gradient(to right, transparent, rgba(191,132,48,0.3), transparent);margin-bottom:30px;"></div>

      <!-- Custom message callout -->
      ${customMessage ? `
      <div class="message-callout" style="background-color:rgba(191,132,48,0.04);border:1px solid rgba(191,132,48,0.2);border-radius:2px;padding:20px;margin-bottom:30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#0C0B09;">
        ${customMessage}
      </div>` : ''}

      <!-- Details Table -->
      <div style="margin-bottom:35px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;width:120px;font-weight:600;">DATE</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${eventDate}</td>
          </tr>
          ${event.time ? `
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;">TIME</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${event.time.slice(0, 5)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:10px 0;font-size:10px;letter-spacing:2.5px;color:#BF8430;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;">VENUE</td>
            <td class="text-primary" style="padding:10px 0;font-size:15px;color:#0C0B09;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${event.venue}</td>
          </tr>
        </table>
      </div>

      <!-- Divider -->
      <div class="rule-accent" style="height:1px;background:linear-gradient(to right, transparent, rgba(191,132,48,0.2), transparent);margin-bottom:35px;"></div>

      <!-- QR Section -->
      <div style="text-align:center;">
        <p class="text-secondary" style="font-size:10px;letter-spacing:3px;color:#5C5850;margin:0 0 20px 0;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          YOUR ENTRY PASS
        </p>
        <div class="qr-wrapper" style="display:inline-block;border:1px solid rgba(12,11,9,0.08);padding:16px;background-color:#F4F1EC;border-radius:2px;">
          <img src="${qrUrl}" alt="Entry QR Code" width="220" height="220" style="display:block;border:none;" />
        </div>
      </div>

    </div>

    <!-- Micro Footer -->
    <div style="padding:30px 0 10px 0;text-align:center;">
      <p class="text-secondary" style="font-size:9px;letter-spacing:2.5px;color:#5C5850;margin:0;text-transform:uppercase;">
        CRENELLE // EVENT_REMINDER
      </p>
    </div>
  </div>
</body>
</html>`

    try {
      const { error: sendError } = await getResend().emails.send({
        from: `${organizer.name} <${SENDING_ADDRESS}>`,
        ...(organizer.email ? { reply_to: organizer.email } : {}),
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

    // Rate-limit throttling: Resend free tier allows 5 requests/second.
    // Sleep 250ms between sequential emails to comfortably stay under this limit.
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return {
    success: errors.length === 0,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  }
}
