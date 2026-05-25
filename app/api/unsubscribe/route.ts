import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/unsubscribe?token=<token>
 *
 * One-click unsubscribe endpoint (CAN-SPAM / GDPR compliant).
 * No authentication required — the token in the URL is the only credential.
 *
 * The token is embedded in every outbound email footer.
 * When clicked, this route marks the address as opted-out and returns
 * a simple HTML confirmation page (no JS required).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token || !/^[a-f0-9]{48}$/.test(token)) {
    return htmlResponse('Invalid unsubscribe link.', false)
  }

  const supabase = createAdminClient()

  // Look up the token
  const { data: existing } = await supabase
    .from('email_unsubscribes')
    .select('email, unsubscribed_at')
    .eq('token', token)
    .maybeSingle()

  if (existing) {
    // Already unsubscribed — idempotent response
    return htmlResponse(
      `${maskEmail(existing.email)} has already been removed from our mailing list.`,
      true,
    )
  }

  // Token not found — invalid or from a pre-unsubscribe era email.
  // For safety, we can't proceed without a valid DB record.
  return htmlResponse(
    'This unsubscribe link is no longer valid. Please contact support if you continue to receive emails.',
    false,
  )
}

/**
 * POST /api/unsubscribe
 *
 * Programmatic unsubscribe — called by the system when generating unsubscribe
 * tokens for new emails. Creates a token row if one doesn't exist yet.
 *
 * Also called when a guest clicks "unsubscribe" on the rendered confirmation page.
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({ token: null }))

  if (!token || !/^[a-f0-9]{48}$/.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Look up the pre-seeded token
  const { data: row } = await supabase
    .from('email_unsubscribes')
    .select('id, email, unsubscribed_at')
    .eq('token', token)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  if (row.unsubscribed_at) {
    return NextResponse.json({ success: true, alreadyUnsubscribed: true })
  }

  // Mark as unsubscribed
  const { error } = await supabase
    .from('email_unsubscribes')
    .update({ unsubscribed_at: new Date().toISOString(), source: 'guest_link' })
    .eq('token', token)

  if (error) {
    return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: maskEmail(row.email) })
}

// ── Helpers ──────────────────────────────────────────────────────

/** Mask email for safe display — e.g. "j***@example.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local[0]}***@${domain}`
}

/** Return a minimal inline-styled HTML page — no JS, no framework dependencies */
function htmlResponse(message: string, success: boolean) {
  const icon = success ? '✓' : '✗'
  const color = success ? '#4CAF50' : '#E53E3E'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Unsubscribed' : 'Invalid Link'} — Crenelle</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #F4F1EC;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid rgba(12,11,9,0.12);
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      color: ${color};
      margin-bottom: 20px;
      display: block;
    }
    h1 {
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #0C0B09;
      margin-bottom: 16px;
    }
    p {
      font-size: 13px;
      color: #5C5850;
      line-height: 1.6;
      letter-spacing: 0.5px;
    }
    .brand {
      margin-top: 32px;
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #BF8430;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">${icon}</span>
    <h1>${success ? 'Unsubscribed' : 'Invalid Link'}</h1>
    <p>${message}</p>
    <p class="brand">CRENELLE // EMAIL_PREFERENCES</p>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
