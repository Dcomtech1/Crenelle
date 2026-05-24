"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Calendar,
  CalendarCheck,
  Radio,
  ScanLine,
  Database,
  AlertTriangle,
  UserPlus,
  Users,
  RefreshCw,
} from 'lucide-react'
import type { AdminStats } from '@/lib/supabase/admin-stats'

// How often to poll in milliseconds
const POLL_INTERVAL_MS = 30_000

// ── Types ──────────────────────────────────────────────────────

interface StatRow {
  label: string
  getValue: (s: AdminStats) => number | string
  icon: React.ReactNode
  sub: string
  accent?: (s: AdminStats) => 'positive' | 'warning' | 'neutral'
}

interface StatSection {
  heading: string
  rows: StatRow[]
}

// ── Stat definitions ───────────────────────────────────────────

const SECTIONS: StatSection[] = [
  {
    heading: 'Platform — Events',
    rows: [
      {
        label: 'Total events on platform',
        getValue: (s) => s.totalEvents,
        icon: <Database className="size-4" />,
        sub: 'all time',
      },
      {
        label: 'Events created today',
        getValue: (s) => s.eventsToday,
        icon: <CalendarCheck className="size-4" />,
        sub: 'since midnight',
      },
      {
        label: 'Active right now',
        getValue: (s) => s.activeEvents,
        icon: <Radio className="size-4" />,
        sub: 'status = live',
        accent: (s) => (s.activeEvents > 0 ? 'positive' : 'neutral'),
      },
    ],
  },
  {
    heading: 'Check-ins',
    rows: [
      {
        label: 'Scans today',
        getValue: (s) => s.checkInsToday,
        icon: <ScanLine className="size-4" />,
        sub: 'since midnight',
      },
      {
        label: 'Total scans all time',
        getValue: (s) => s.checkInsAllTime,
        icon: <ScanLine className="size-4" />,
        sub: 'entry_logs rows',
      },
    ],
  },
  {
    heading: 'Users',
    rows: [
      {
        label: 'Total registered accounts',
        getValue: (s) => s.totalUsers,
        icon: <Users className="size-4" />,
        sub: 'auth.users',
      },
      {
        label: 'New signups today',
        getValue: (s) => s.signupsToday,
        icon: <UserPlus className="size-4" />,
        sub: 'since midnight',
        accent: (s) => (s.signupsToday > 0 ? 'positive' : 'neutral'),
      },
      {
        label: 'New signups this week',
        getValue: (s) => s.signupsThisWeek,
        icon: <Calendar className="size-4" />,
        sub: 'last 7 days',
      },
    ],
  },
  {
    heading: 'Errors',
    rows: [
      {
        label: 'Scan errors all time',
        getValue: (s) => s.errorCount,
        icon: <AlertTriangle className="size-4" />,
        sub: 'scan_errors rows',
        accent: (s) => (s.errorCount > 0 ? 'warning' : 'neutral'),
      },
      {
        label: 'Scan errors today',
        getValue: (s) => s.errorsToday,
        icon: <AlertTriangle className="size-4" />,
        sub: 'since midnight',
        accent: (s) => (s.errorsToday > 0 ? 'warning' : 'neutral'),
      },
      {
        label: 'Critical errors all time',
        getValue: (s) => s.criticalErrors,
        icon: <AlertTriangle className="size-4" />,
        sub: 'severity = critical',
        accent: (s) => (s.criticalErrors > 0 ? 'warning' : 'neutral'),
      },
    ],
  },
]

// ── Elapsed time helper ────────────────────────────────────────

function useElapsed(from: Date | null): string {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!from) return
    const tick = () => {
      setElapsed(Math.floor((Date.now() - from.getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [from])

  if (!from) return ''
  if (elapsed < 5) return 'just now'
  if (elapsed < 60) return `${elapsed}s ago`
  return `${Math.floor(elapsed / 60)}m ago`
}

// ── Component ──────────────────────────────────────────────────

interface AdminStatsGridProps {
  initialStats: AdminStats
}

export function AdminStatsGrid({ initialStats }: AdminStatsGridProps) {
  const [stats, setStats] = useState<AdminStats>(initialStats)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    () => new Date(initialStats.fetchedAt)
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const elapsed = useElapsed(lastUpdated)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(false)
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: AdminStats = await res.json()
      setStats(data)
      setLastUpdated(new Date(data.fetchedAt))
    } catch (err) {
      console.error('[AdminStatsGrid] poll failed:', err)
      setError(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // ── Set up polling ──
  useEffect(() => {
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  // ── Local time label ──
  const localTime = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : ''
  const tzLabel = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div>
      {/* ── Live status bar ── */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          {/* Pulse dot */}
          <span className="relative flex h-2 w-2">
            <span
              className={[
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                error
                  ? 'bg-denied animate-ping'
                  : 'bg-admitted animate-ping',
              ].join(' ')}
            />
            <span
              className={[
                'relative inline-flex rounded-full h-2 w-2',
                error ? 'bg-denied' : 'bg-admitted',
              ].join(' ')}
            />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {error ? 'Poll failed · retrying' : 'Live · auto-refreshes every 30s'}
          </span>
        </div>

        {/* Last updated + manual refresh */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hidden sm:block">
            {lastUpdated ? (
              <>
                Updated {elapsed}{' '}
                <span className="opacity-40">
                  ({localTime} {tzLabel})
                </span>
              </>
            ) : (
              'Loading…'
            )}
          </span>

          <button
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="Refresh stats now"
            title="Refresh now"
            className="flex items-center justify-center w-7 h-7 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={['size-3', isRefreshing ? 'animate-spin' : ''].join(' ')}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* ── Stat sections ── */}
      <div
        className={[
          'grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300',
          isRefreshing ? 'opacity-60' : 'opacity-100',
        ].join(' ')}
      >
        {SECTIONS.map((section) => (
          <section
            key={section.heading}
            className="bg-card border border-border"
            aria-labelledby={`section-${section.heading.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {/* Section header */}
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="w-1 h-4 bg-copper shrink-0" aria-hidden="true" />
              <h2
                id={`section-${section.heading.replace(/\s+/g, '-').toLowerCase()}`}
                className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground"
              >
                {section.heading}
              </h2>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border" role="list">
              {section.rows.map((row) => {
                const value = row.getValue(stats)
                const accentKey = row.accent ? row.accent(stats) : 'neutral'

                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-6 py-4"
                    role="listitem"
                  >
                    {/* Label + icon */}
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <span aria-hidden="true">{row.icon}</span>
                      <span className="font-sans text-xs uppercase tracking-[0.15em]">
                        {row.label}
                      </span>
                    </div>

                    {/* Value */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                      <span
                        className={[
                          'font-display text-3xl font-semibold leading-none tabular-nums',
                          accentKey === 'positive'
                            ? 'text-admitted'
                            : accentKey === 'warning'
                            ? 'text-denied'
                            : 'text-foreground',
                        ].join(' ')}
                        aria-label={`${row.label}: ${value}`}
                      >
                        {value}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-foreground/30">
                        {row.sub}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Footer note ── */}
      <p className="mt-10 font-sans text-[10px] text-foreground/30 uppercase tracking-[0.2em] text-center">
        Admin view · aggregate data only · no personal records · polling every 30s
      </p>
    </div>
  )
}
