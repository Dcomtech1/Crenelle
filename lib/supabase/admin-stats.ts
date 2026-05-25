import { createAdminClient } from './admin'

// ── Types ──────────────────────────────────────────────────────

export interface AdminStats {
  totalEvents: number
  eventsToday: number
  activeEvents: number
  checkInsToday: number
  checkInsAllTime: number
  errorCount: number
  errorsToday: number
  criticalErrors: number
  signupsToday: number
  signupsThisWeek: number
  totalUsers: number
  fetchedAt: string // ISO timestamp of when the server computed this
}

// ── Helpers ────────────────────────────────────────────────────

function todayUTCStart(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function weekUTCStart(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 7)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(query: PromiseLike<{ count: number | null; error: any }>): Promise<number> {
  const { count, error } = await query
  if (error) console.error('[admin-stats] count error:', error)
  return count ?? 0
}

// ── Main fetcher ───────────────────────────────────────────────

/**
 * Fetches all admin dashboard aggregate counts.
 * Uses the service-role admin client — bypasses RLS.
 * Only aggregate counts are returned — no personal data.
 *
 * Called from:
 *   - app/(admin)/admin/page.tsx   — initial SSR load
 *   - app/api/admin/stats/route.ts — live polling by AdminStatsGrid
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  const admin = createAdminClient()
  const todayStart = todayUTCStart()
  const weekStart = weekUTCStart()

  const [
    totalEvents,
    eventsToday,
    activeEvents,
    checkInsToday,
    checkInsAllTime,
    errorCount,
    errorsToday,
    criticalErrors,
  ] = await Promise.all([
    safeCount(admin.from('events').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('events').select('*', { count: 'exact', head: true }).gte('created_at', todayStart)),
    safeCount(admin.from('events').select('*', { count: 'exact', head: true }).eq('status', 'live')),
    safeCount(admin.from('entry_logs').select('*', { count: 'exact', head: true }).gte('scanned_at', todayStart)),
    safeCount(admin.from('entry_logs').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('scan_errors').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('scan_errors').select('*', { count: 'exact', head: true }).gte('created_at', todayStart)),
    safeCount(admin.from('scan_errors').select('*', { count: 'exact', head: true }).eq('severity', 'critical')),
  ])

  let signupsToday = 0
  let signupsThisWeek = 0
  let totalUsers = 0
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const users = authData?.users ?? []
    totalUsers = users.length
    const todayTs = new Date(todayStart)
    const weekTs = new Date(weekStart)
    signupsToday = users.filter((u) => new Date(u.created_at) >= todayTs).length
    signupsThisWeek = users.filter((u) => new Date(u.created_at) >= weekTs).length
  } catch (err) {
    console.error('[admin-stats] auth.admin.listUsers error:', err)
  }

  return {
    totalEvents,
    eventsToday,
    activeEvents,
    checkInsToday,
    checkInsAllTime,
    errorCount,
    errorsToday,
    criticalErrors,
    signupsToday,
    signupsThisWeek,
    totalUsers,
    fetchedAt: new Date().toISOString(),
  }
}
