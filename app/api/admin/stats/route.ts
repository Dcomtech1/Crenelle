import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAdminStats } from '@/lib/supabase/admin-stats'

// Always fresh — this is a live polling endpoint
export const dynamic = 'force-dynamic'

export async function GET() {
  // ── Auth guard — same logic as the page layout ──
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Fetch and return aggregate stats ──
  const stats = await fetchAdminStats()
  return NextResponse.json(stats)
}
