import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/scan/search?token=<scannerToken>&q=<name>
 *
 * Manual name-search fallback for damaged or dead-battery QR codes.
 * Returns up to 10 matching attendees for the event associated with the
 * scanner token, along with their secure qr_tokens (sent under invitationId)
 * so the usher can trigger a normal admission flow.
 *
 * Security: token validates the usher's permission to see this event's
 * guest list. No organiser login required (usher flow).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')?.trim()
  const q = searchParams.get('q')?.trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing scanner token' }, { status: 400 })
  }
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = createAdminClient()

  // Validate scanner token → get event_id
  const { data: link } = await supabase
    .from('scanner_links')
    .select('event_id, is_active')
    .eq('token', token)
    .single()

  if (!link || !link.is_active) {
    return NextResponse.json({ error: 'Invalid or inactive scanner link' }, { status: 403 })
  }

  // Fuzzy search: case-insensitive substring match on attendee name
  // Join through invitations so we only surface attendees who have an active invitation
  const { data: attendees } = await supabase
    .from('attendees')
    .select('id, name, phone, invitations(id, party_size, seat_info, status, qr_token)')
    .eq('event_id', link.event_id)
    .ilike('name', `%${q}%`)
    .limit(10)

  const results = (attendees ?? [])
    .map((a) => {
      const inv = Array.isArray(a.invitations) ? a.invitations[0] : a.invitations
      return {
        guestId: a.id,
        guestName: a.name,
        phone: a.phone,
        // Map the secure qr_token to invitationId so the client sends it to POST /api/scan
        invitationId: inv?.qr_token ?? null,
        partySize: inv?.party_size ?? 1,
        seatInfo: inv?.seat_info ?? null,
        invitationStatus: inv?.status ?? null,
      }
    })
    // Only surface guests who have a valid, non-cancelled invitation
    .filter((r) => r.invitationId && r.invitationStatus !== 'cancelled')

  return NextResponse.json({ results })
}
