import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/scan/counter?token=<scannerToken>
 *
 * Returns live entry counts for this gate (scanner link) and the event overall.
 * Polled every 15s by the ScannerClient to power the live usher counter.
 *
 * Security: token validates the usher — no organiser session required.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Validate scanner token → get scanner_link_id + event_id
  const { data: link } = await supabase
    .from('scanner_links')
    .select('id, event_id, label, is_active')
    .eq('token', token)
    .single()

  if (!link || !link.is_active) {
    return NextResponse.json({ error: 'Invalid or inactive scanner link' }, { status: 403 })
  }

  // Total seats for this event (sum of party_size across all non-cancelled invitations)
  const { data: invitations } = await supabase
    .from('invitations')
    .select('party_size')
    .eq('event_id', link.event_id)
    .neq('status', 'cancelled')

  const totalSeats = (invitations ?? []).reduce((sum, i) => sum + (i.party_size ?? 1), 0)

  // Total entries for this event
  const { count: totalEntries } = await supabase
    .from('entry_logs')
    .select('*', { count: 'exact', head: true })
    .in(
      'invitation_id',
      (invitations ?? []).map((_, idx) => idx), // need invitation IDs — re-query
    )

  // Simpler: count all entry_logs for the event via scanner_links join
  // Get all scanner_link IDs for this event
  const { data: allLinks } = await supabase
    .from('scanner_links')
    .select('id')
    .eq('event_id', link.event_id)

  const allLinkIds = (allLinks ?? []).map((l) => l.id)

  // Count ALL entries for the event
  const { count: eventTotal } = await supabase
    .from('entry_logs')
    .select('*', { count: 'exact', head: true })
    .in('scanner_link_id', allLinkIds)

  // Count entries through THIS gate only
  const { count: gateTotal } = await supabase
    .from('entry_logs')
    .select('*', { count: 'exact', head: true })
    .eq('scanner_link_id', link.id)

  return NextResponse.json({
    gateLabel: link.label,
    gateTotal: gateTotal ?? 0,
    eventTotal: eventTotal ?? 0,
    totalSeats,
  })
}
