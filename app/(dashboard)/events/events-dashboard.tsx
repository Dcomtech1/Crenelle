"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { EventCard } from "@/components/event-card"
import { DeleteEventDialog } from "@/components/delete-event-dialog"
import { StatusChangeDialog } from "@/components/status-change-dialog"
import { EmptyState } from "@/components/empty-state"
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
}

export function EventsDashboardClient({
  initialEvents,
  initialInvitations,
  initialLogs,
}: EventsDashboardClientProps) {
  const { events, eventStats, stats, remaining, capacityPercent } =
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
                const s = eventStats[event.id] || { checkedIn: 0, totalCapacity: 0 }
                const cardStatus = event.status === "live" ? "LIVE"
                  : event.status === "published" ? "PUBLISHED"
                  : event.status === "ended" ? "CLOSED"
                  : "DRAFT"

                return (
                  <div key={event.id} className="relative group">
                    <Link href={`/events/${event.id}`}>
                      <EventCard
                        name={event.name}
                        date={new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase()}
                        time={event.time?.slice(0, 5) ?? ""}
                        guestCount={s.checkedIn}
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

                    {/* Delete button — bottom-right to avoid status tag overlap */}
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
