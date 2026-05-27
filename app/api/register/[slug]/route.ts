import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public API route to fetch event details by registration slug.
 * No auth required — this powers the public registration page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  // Fetch the event by registration_slug
  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, date, time, venue, description, status, event_type, max_registrations, banner_url')
    .eq('registration_slug', slug)
    .eq('event_type', 'open')
    .single()

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Don't expose draft events
  if (event.status === 'draft') {
    return NextResponse.json({ error: 'Registration not yet open' }, { status: 404 })
  }

  // Count current non-rejected registrations
  const { count } = await supabase
    .from('attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('source', 'public_registration')
    .neq('registration_status', 'rejected')

  // Fetch active public ticket tiers
  const { data: tiers } = await supabase
    .from('ticket_tiers')
    .select('id, name, price, currency')
    .eq('event_id', event.id)
    .is('deleted_at', null)
    .eq('is_public', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    id: event.id,
    name: event.name,
    date: event.date,
    time: event.time,
    venue: event.venue,
    description: event.description,
    status: event.status,
    max_registrations: event.max_registrations,
    registration_count: count ?? 0,
    banner_url: event.banner_url,
    tiers: tiers ?? [],
  })
}
