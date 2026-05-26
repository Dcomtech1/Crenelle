"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Trash2, Users } from "lucide-react"
import { EventCard } from "@/components/event-card"
import { DeleteEventDialog } from "@/components/delete-event-dialog"
import { StatusChangeDialog } from "@/components/status-change-dialog"
import { deleteEvent } from "@/app/actions/events"
import type { Event, Invitation } from "@/lib/types"

import { useDashboardData } from "./hooks/use-dashboard-data"
import { StatsPanel } from "./components/stats-panel"
import { ControlBar } from "./components/control-bar"
import { EventsHeader } from "./components/events-header"

interface EventsDashboardClientProps {
  initialEvents: Event[]
  initialInvitations: Invitation[]
  initialLogs: { invitation_id: string }[]
  coHostedEvents?: Array<Event & { memberRole: string }>
}

const roleLabels: Record<string, string> = {
  viewer: 'Viewer',
  scanner_manager: 'Scanner Manager',
  co_organiser: 'Co-Organiser',
}

export function EventsDashboardClient({
  initialEvents,
  initialInvitations,
  initialLogs,
  coHostedEvents = [],
}: EventsDashboardClientProps) {
  const { events, invitations, logs, eventStats, stats, remaining, capacityPercent } =
    useDashboardData({ initialEvents, initialInvitations, initialLogs })

  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [statusTarget, setStatusTarget] = useState<Event | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"updated" | "created" | "name">("updated")
  const [search, setSearch] = useState("")
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filtered = [...events]
    .filter((e) => {
      if (search) {
        const s = search.toLowerCase()
        return e.name.toLowerCase().includes(s) || e.venue.toLowerCase().includes(s)
      }
      if (filter === "all") return true
      if (filter === "active") return e.status === "live"
      if (filter === "closed") return e.status === "ended"
      return e.status === filter
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      {/* Events list */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <EventsHeader
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          search={search}
          setSearch={setSearch}
        />

        {events.length === 0 ? (
          <div className="py-16 text-center border border-border">
            <p className="font-display text-xl text-muted-foreground italic mb-4">No events yet</p>
            <Link
              href="/events/new"
              className="font-sans text-sm text-copper underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Create your first event →
            </Link>
          </div>
        ) : (
          <>
            <ControlBar filter={filter} setFilter={setFilter} sortBy={sortBy} setSortBy={setSortBy} />

            <div className="flex flex-col gap-4">
              {filtered.map((event) => {
                const s = eventStats[event.id] || { checkedIn: 0, totalInvited: 0, totalCapacity: 0 }
                const cardStatus = event.status === "live" ? "LIVE"
                  : event.status === "published" ? "PUBLISHED"
                  : event.status === "ended" ? "CLOSED"
                  : "DRAFT"

                const isLive = event.status === "live"
                const guestCount = isLive ? s.checkedIn : s.totalInvited
                const guestLabel = isLive ? "Checked in" : "Invited"

                return (
                  <div key={event.id} className="relative group">
                    <Link href={`/events/${event.id}`}>
                      <EventCard
                        name={event.name}
                        date={new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase()}
                        time={event.time?.slice(0, 5) ?? ""}
                        guestCount={guestCount}
                        guestLabel={guestLabel}
                        capacity={event.capacity || 0}
                        eventType={event.event_type || 'closed'}
                        status={cardStatus}
                        onStatusClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setStatusTarget(event)
                        }}
                      />
                    </Link>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDeleteTarget(event)
                      }}
                      className="absolute bottom-3 right-3 z-10 h-8 w-8 flex items-center justify-center border border-border text-muted-foreground bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Delete ${event.name}`}
                      title="Delete event"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            <DeleteEventDialog
              open={!!deleteTarget}
              onOpenChange={(open) => !open && setDeleteTarget(null)}
              eventName={deleteTarget?.name}
              isPending={isPending}
              onConfirm={() => {
                if (!deleteTarget) return
                startTransition(async () => {
                  await deleteEvent(deleteTarget.id)
                  setDeleteTarget(null)
                })
              }}
            />
          </>
        )}

        {/* ── Co-hosting section ── */}
        {coHostedEvents.length > 0 && (
          <div className="mt-8 pt-8 border-t border-border">
            <div className="flex items-center gap-2 mb-5">
              <Users className="h-4 w-4 text-signal" aria-hidden="true" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-signal">
                Co-hosting
              </p>
              <span className="font-sans text-[10px] text-muted-foreground ml-1">
                — events you've been invited to collaborate on
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {coHostedEvents.map(event => {
                const cardStatus = event.status === "live" ? "LIVE"
                  : event.status === "published" ? "PUBLISHED"
                  : event.status === "ended" ? "CLOSED"
                  : "DRAFT"

                // Compute real-time stats for co-hosted event
                const eventInvitations = invitations.filter(
                  (inv) => inv.event_id === event.id && inv.status !== "cancelled"
                )
                const eventLogs = logs.filter((log) => {
                  const inv = invitations.find((i) => i.id === log.invitation_id)
                  return inv?.event_id === event.id
                })
                const totalInvited = eventInvitations.reduce((sum, inv) => sum + inv.party_size, 0)
                const checkedIn = eventLogs.length

                const isLive = event.status === "live"
                const guestCount = isLive ? checkedIn : totalInvited
                const guestLabel = isLive ? "Checked in" : "Invited"

                return (
                  <div key={event.id} className="relative">
                    {/* Role badge overlay */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/90 border border-signal/30 px-2 py-0.5 backdrop-blur-sm">
                      <Users className="h-2.5 w-2.5 text-signal" aria-hidden="true" />
                      <span className="font-sans text-[9px] font-semibold uppercase tracking-widest text-signal">
                        {roleLabels[event.memberRole] ?? 'Co-host'}
                      </span>
                    </div>
                    <Link href={`/events/${event.id}`}>
                      <EventCard
                        name={event.name}
                        date={new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase()}
                        time={event.time?.slice(0, 5) ?? ""}
                        guestCount={guestCount}
                        guestLabel={guestLabel}
                        capacity={event.capacity || 0}
                        eventType={event.event_type || 'closed'}
                        status={cardStatus}
                        onStatusClick={() => {}}
                      />
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stats panel */}
      <div className="lg:col-span-5">
        <StatsPanel stats={stats} remaining={remaining} capacityPercent={capacityPercent} />
      </div>

      {/* Status change dialog */}
      {statusTarget && (
        <StatusChangeDialog
          open={!!statusTarget}
          onOpenChange={(open) => !open && setStatusTarget(null)}
          eventId={statusTarget.id}
          eventName={statusTarget.name}
          currentStatus={statusTarget.status}
        />
      )}
    </div>
  )
}
