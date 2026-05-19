import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EventsDashboardClient } from './events-dashboard'
import type { Event, Invitation } from '@/lib/types'

export default async function EventsPage() {
  const supabase = await createClient()
  
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: false })

  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, event_id, party_size, status')

  const { data: logs } = await supabase
    .from('entry_logs')
    .select('invitation_id')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 pb-8 border-b border-border">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-copper mb-3">
            Your events
          </p>
          <h1
            className="font-display font-semibold text-foreground leading-[0.95] tracking-tight"
            style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}
          >
            Event manifest
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-2">
            {events?.length ?? 0} {events?.length === 1 ? 'event' : 'events'} on record
          </p>
        </div>
        
        <Link href="/events/new">
          {/* Inverted button: foreground bg + background text — correct in both modes */}
          <button className="inline-flex items-center gap-2.5 bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] px-7 py-3.5 hover:opacity-80 transition-opacity cursor-pointer">
            <Plus className="w-4 h-4" />
            New event
          </button>
        </Link>
      </div>

      <EventsDashboardClient 
        initialEvents={(events as Event[]) || []} 
        initialInvitations={(invitations as Invitation[]) || []}
        initialLogs={(logs as { invitation_id: string }[]) || []}
      />
    </div>
  )
}
