import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventAccess } from '@/lib/team-access'

const statusConfig: Record<string, { label: string; cls: string }> = {
  live:      { label: 'Live',      cls: 'status-live' },
  published: { label: 'Published', cls: 'status-published' },
  draft:     { label: 'Draft',     cls: 'status-draft' },
  ended:     { label: 'Ended',     cls: 'status-ended' },
}

const roleLabels: Record<string, string> = {
  viewer:          'CO-HOST // VIEWER',
  scanner_manager: 'CO-HOST // SCANNER MGR',
  co_organiser:    'CO-HOST // CO-ORGANISER',
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, date, status, event_type, organizer_id')
    .eq('id', id)
    .single()

  if (!event) notFound()

  // Resolve current user's role (owner | viewer | scanner_manager | null)
  const access = await getEventAccess(id)
  if (!access.role) notFound() // no access at all

  const statusInfo = statusConfig[event.status] ?? { label: event.status, cls: 'status-draft' }

  // Build tab list based on event type and role
  const baseTabs = [
    { label: 'Overview',       href: '' },
    { label: 'Guests',         href: '/guests' },
    { label: 'Live Dashboard', href: '/dashboard' },
    { label: 'Scanner Links',  href: '/scanner-links' },
    { label: 'Passes',         href: '/cards' },
  ]

  const tabs = [...baseTabs]
  if (event.event_type === 'open') {
    tabs.splice(2, 0, { label: 'Registrations', href: '/registrations' })
  }
  // Team tab only visible to the owner
  if (access.isOwner) {
    tabs.push({ label: 'Team', href: '/team' })
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors mb-8 group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
        All events
      </Link>

      {/* Event heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 pb-6 border-b border-border">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-copper mb-3">
            Event
          </p>
          <h1
            className="font-display font-semibold text-foreground leading-[0.95] tracking-tight"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)' }}
          >
            {event.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="font-sans text-sm text-muted-foreground">
              {new Date(event.date).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
            {event.event_type === 'open' && (
              <span className="font-sans text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 border border-copper/40 text-copper">
                Open event
              </span>
            )}
            {/* Co-host role badge — only shown to non-owners */}
            {!access.isOwner && access.role && (
              <span className="inline-flex items-center gap-1.5 font-sans text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 border border-signal/40 text-signal">
                <Users className="h-2.5 w-2.5" aria-hidden="true" />
                {roleLabels[access.role] ?? 'CO-HOST'}
              </span>
            )}
          </div>
        </div>

        <div className={`inline-flex items-center gap-2 self-start sm:self-end shrink-0 ${statusInfo.cls}`}>
          {event.status === 'live' && (
            <span className="size-1.5 rounded-full bg-current animate-blink shrink-0" aria-hidden="true" />
          )}
          {statusInfo.label}
        </div>
      </div>

      {/* Tab navigation */}
      <nav aria-label="Event sections" className="mb-10">
        <div className="flex gap-0 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={`/events/${id}${tab.href}`}
              className="relative font-sans text-xs font-semibold uppercase tracking-[0.14em] px-5 py-3 whitespace-nowrap text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent -mb-px hover:border-foreground/30 focus-visible:outline-none focus-visible:text-copper focus-visible:border-copper"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      {children}
    </div>
  )
}
