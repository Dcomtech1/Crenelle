'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Users, UserCheck, Clock, BarChart3, DoorOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/stat-card'
import { SectionHeader } from '@/components/section-header'
import { Skeleton } from '@/components/ui/skeleton'
import type { EntryLog, Invitation, Attendee } from '@/lib/types'

type EntryWithGuest = {
  id: string
  scanned_at: string
  invitation: {
    party_size: number
    seat_info: string | null
    guest: { name: string }
  }
}

type GuestName = { name: string }

type InvitationRaw = Pick<Invitation, 'id' | 'party_size' | 'seat_info' | 'status'> & {
  guest: GuestName
}

type EntryLogRaw = Pick<EntryLog, 'id' | 'scanned_at'> & {
  invitation: Pick<Invitation, 'id' | 'party_size' | 'seat_info'> & {
    attendee: GuestName | GuestName[]
  }
}

export default function LiveDashboardPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [totalInvited, setTotalInvited] = useState(0)
  const [totalSeats, setTotalSeats] = useState(0)
  const [arrived, setArrived] = useState(0)
  const [arrivedSeats, setArrivedSeats] = useState(0)
  const [entries, setEntries] = useState<EntryWithGuest[]>([])
  const [pending, setPending] = useState<Array<{ name: string; party_size: number; seat_info: string | null }>>([])
  const [entranceStats, setEntranceStats] = useState<Array<{ label: string; count: number }>>([])  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {
      try {
        const { data: invitations } = await supabase
          .from('invitations')
          .select('id, party_size, seat_info, status, attendee:attendees(name)')
          .eq('event_id', eventId)

        const { data: logs } = await supabase
          .from('entry_logs')
          .select('id, scanned_at, invitation:invitations(id, party_size, seat_info, attendee:attendees(name))')
          .in('invitation_id', (invitations ?? []).map(i => i.id))
          .order('scanned_at', { ascending: false })

        const logsArr = (logs ?? []) as any[]
        const invArrRaw = (invitations ?? []) as any[]

        const invArr: InvitationRaw[] = invArrRaw.map(i => {
          const att = Array.isArray(i.attendee) ? i.attendee[0] : i.attendee
          return {
            id: i.id,
            party_size: i.party_size,
            seat_info: i.seat_info,
            status: i.status,
            guest: att ? { name: att.name } : { name: 'Unknown' }
          }
        })

        const logsPerInv = new Map<string, number>()
        logsArr.forEach((l) => {
          const invRaw = Array.isArray(l.invitation) ? l.invitation[0] : l.invitation
          const invId = invRaw?.id
          if (invId) logsPerInv.set(invId, (logsPerInv.get(invId) ?? 0) + 1)
        })

        setTotalInvited(invArr.length)
        setTotalSeats(invArr.reduce((a, i) => a + (i.party_size ?? 1), 0))
        setArrived(logsArr.length)
        setArrivedSeats(logsPerInv.size)
        setEntries(logsArr.map(l => {
          const invRaw = Array.isArray(l.invitation) ? l.invitation[0] : l.invitation
          const attRaw = invRaw ? (Array.isArray(invRaw.attendee) ? invRaw.attendee[0] : invRaw.attendee) : null
          return {
            id: l.id,
            scanned_at: l.scanned_at,
            invitation: {
              party_size: invRaw?.party_size ?? 1,
              seat_info:  invRaw?.seat_info ?? null,
              guest:      attRaw ?? { name: 'Unknown' }
            }
          }
        }))
        setPending(
          invArr
            .map((i) => {
              const arrivedInParty   = logsPerInv.get(i.id) ?? 0
              const remainingInParty = (i.party_size ?? 1) - arrivedInParty
              return { ...i, remainingInParty }
            })
            .filter((i) => i.remainingInParty > 0)
            .map((i) => {
              return {
                name:       i.guest?.name ?? 'Unknown',
                party_size: i.remainingInParty,
                seat_info:  i.seat_info
              }
            })
        )

        // --- Per-entrance breakdown ---
        const { data: scanLinks } = await supabase
          .from('scanner_links')
          .select('id, label')
          .eq('event_id', eventId)

        if (scanLinks && scanLinks.length > 0) {
          const linkIds = scanLinks.map((sl) => sl.id)
          const { data: entranceLogs } = await supabase
            .from('entry_logs')
            .select('scanner_link_id')
            .in('scanner_link_id', linkIds)

          const countByLink = new Map<string, number>()
          ;(entranceLogs ?? []).forEach((el) => {
            if (el.scanner_link_id) {
              countByLink.set(el.scanner_link_id, (countByLink.get(el.scanner_link_id) ?? 0) + 1)
            }
          })

          setEntranceStats(
            scanLinks
              .map((sl) => ({ label: sl.label, count: countByLink.get(sl.id) ?? 0 }))
              .sort((a, b) => b.count - a.count)
          )
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Poll every 5s — guarantees updates even without Supabase Realtime
    const poll = setInterval(loadData, 5000)

    const channel = supabase
      .channel(`entry-logs-${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entry_logs' },  () => loadData())
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'invitations' }, () => loadData())
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [eventId])

  const arrivalRate = totalSeats > 0 ? Math.round((arrived / totalSeats) * 100) : 0

  if (loading) {
    return (
      <div className="flex flex-col gap-8 animate-pulse">
        {/* Section header */}
        <div className="border-b-2 border-foreground/20 pb-6">
          <SectionHeader
            eyebrow="REALTIME_FEED"
            title="Live Attendance"
            subtitle="Loading live dashboard data..."
            live
          />
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-foreground/20">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card p-5 space-y-3 border border-border">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>

        {/* Capacity bar skeleton */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-12" />
          </div>
          <Skeleton className="w-full h-5" />
        </div>

        {/* Recent + Pending columns skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Column 1 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center p-3 border border-border bg-card">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3.5 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-8" />
                </div>
              ))}
            </div>
          </div>
          {/* Column 2 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center p-3 border border-border bg-card">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3.5 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Section header */}
      <div className="border-b-2 border-foreground/20 pb-6">
        <SectionHeader
          eyebrow="REALTIME_FEED"
          title="Live Attendance"
          subtitle="Updates in real-time as guests arrive"
          live
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-foreground/20" role="list" aria-label="Attendance statistics">
        <StatCard
          icon={<Users className="h-5 w-5 text-foreground/60" aria-hidden="true" />}
          label="Total Seats"
          value={totalSeats}
          sub={`${totalInvited} invitations`}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5 text-admitted" aria-hidden="true" />}
          label="People In"
          value={arrived}
          sub={`${arrivedSeats} groups arrived`}
          accent="admitted"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-signal" aria-hidden="true" />}
          label="Pending"
          value={totalSeats - arrived}
          sub={`${totalInvited - arrivedSeats} groups waiting`}
          accent="signal"
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-foreground/60" aria-hidden="true" />}
          label="Arrival Rate"
          value={`${arrivalRate}%`}
          sub="of total seats filled"
        />
      </div>

      {/* Capacity bar */}
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/70">OVERALL_CAPACITY_LOAD</span>
          <span className="font-mono text-xs text-signal uppercase">{arrived} / {totalSeats}</span>
        </div>
        <div
          className="w-full h-5 bg-background border-2 border-foreground/40 relative p-0.5"
          role="progressbar"
          aria-valuenow={arrivalRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Arrival rate: ${arrivalRate}%`}
        >
          <div
            className="h-full bg-signal transition-all duration-1000 ease-out"
            style={{ width: `${arrivalRate}%` }}
          />
        </div>
      </div>

      {/* Per-entrance breakdown */}
      {entranceStats.length > 1 && (
        <div>
          <h3 className="font-display text-2xl uppercase text-foreground mb-4 flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-foreground/50" aria-hidden="true" />
            Per Entrance
          </h3>
          <div className="flex flex-col gap-3">
            {entranceStats.map((gate) => {
              const gatePct = arrived > 0 ? Math.round((gate.count / arrived) * 100) : 0
              return (
                <div key={gate.label}>
                  <div className="flex justify-between items-end mb-1">
                    <span className="font-mono text-xs uppercase tracking-widest text-foreground/70 truncate mr-4">{gate.label}</span>
                    <span className="font-mono text-xs text-signal shrink-0">{gate.count} <span className="text-foreground/30">({gatePct}%)</span></span>
                  </div>
                  <div className="w-full h-3 bg-background border border-foreground/20 relative p-0.5">
                    <div
                      className="h-full bg-signal/60 transition-all duration-700"
                      style={{ width: `${gatePct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent + Pending columns */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent arrivals */}
        <div>
          <h3 className="font-display text-2xl uppercase text-foreground mb-4">Recent Arrivals</h3>
          {entries.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-foreground/20 flex items-center justify-center">
              <p className="font-mono text-xs uppercase tracking-widest text-foreground/50">NO_ARRIVALS_YET</p>
            </div>
          ) : (
            <div className="flex flex-col gap-px max-h-96 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3 bg-admitted/5 border border-admitted/10 hover:border-admitted/20 transition-colors"
                >
                  <div>
                    <p className="font-mono text-sm text-foreground">{entry.invitation.guest.name}</p>
                    <p className="font-mono text-[10px] text-foreground/60 uppercase tracking-widest mt-0.5">
                      {entry.invitation?.seat_info && <span className="mr-3">{entry.invitation.seat_info}</span>}
                      {new Date(entry.scanned_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-admitted/60 border border-admitted/20 px-2 py-1">
                    {entry.invitation?.party_size > 1 ? `+${entry.invitation.party_size}` : 'SOLO'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Still waiting */}
        <div>
          <h3 className="font-display text-2xl uppercase text-foreground mb-4">
            Not Yet Arrived <span className="text-foreground/40">({pending.length})</span>
          </h3>
          {pending.length === 0 ? (
            <div className="py-12 border-2 border-admitted/20 bg-admitted/5 flex items-center justify-center">
              <p className="font-mono text-xs uppercase tracking-widest text-admitted">ALL_GUESTS_ARRIVED</p>
            </div>
          ) : (
            <div className="flex flex-col gap-px max-h-96 overflow-y-auto">
              {pending.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 bg-background border border-foreground/10 hover:border-foreground/20 transition-colors"
                >
                  <div>
                    <p className="font-mono text-sm text-foreground">{p.name}</p>
                    {p.seat_info && (
                      <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mt-0.5">{p.seat_info}</p>
                    )}
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-signal/60 border border-signal/20 px-2 py-1">
                    +{p.party_size}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
