'use server'

import { createClient } from '@/lib/supabase/server'
import type { TeamRole } from '@/lib/types'

export interface EventAccess {
  /** The resolved role for the current user on this event. null = no access. */
  role: TeamRole | null
  isOwner: boolean
  canEdit: boolean           // owner only
  canManageTeam: boolean     // owner only
  canManageGuests: boolean   // owner only
  canManageScanners: boolean // owner + scanner_manager
  canSendEmails: boolean     // owner only
}

/**
 * Returns the current user's access level for a given event.
 * Call this at the top of any event sub-page that needs role-gating.
 *
 * Uses the RLS-scoped user client so unauthorized access is blocked at
 * the DB level — this helper just resolves *which* role they have.
 */
export async function getEventAccess(eventId: string): Promise<EventAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return makeAccess(null)
  }

  // Check if the user is the event owner
  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single()

  if (!event) return makeAccess(null)

  if (event.organizer_id === user.id) {
    return makeAccess('owner')
  }

  // Check if they are a co-host member
  const { data: membership } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('member_id', user.id)
    .maybeSingle()

  if (!membership) return makeAccess(null)

  return makeAccess(membership.role as TeamRole)
}

function makeAccess(role: TeamRole | null): EventAccess {
  return {
    role,
    isOwner:             role === 'owner',
    canEdit:             role === 'owner',
    canManageTeam:       role === 'owner',
    canManageGuests:     role === 'owner' || role === 'co_organiser',
    canManageScanners:   role === 'owner' || role === 'scanner_manager' || role === 'co_organiser',
    canSendEmails:       role === 'owner' || role === 'co_organiser',
  }
}
