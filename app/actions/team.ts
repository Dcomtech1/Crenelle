'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCoHostInviteEmail } from '@/lib/email'
import type { EventMember, MemberRole } from '@/lib/types'

// ── Auth helper ────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

// ── Read ───────────────────────────────────────────────────────

/**
 * Returns all co-host members for an event.
 * Only the event owner can call this (RLS enforced on organizer_id).
 * Member emails are resolved via the admin client (auth.users is not
 * directly accessible via RLS-scoped queries).
 */
export async function getTeamMembers(eventId: string): Promise<{
  members: EventMember[]
  error: string | null
}> {
  const { supabase } = await getAuthUser()
  const admin = createAdminClient()

  const { data, error } = await supabase
    .from('event_members')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) return { members: [], error: error.message }

  const members = data ?? []

  // Resolve member emails via admin auth API
  const enriched = await Promise.all(
    members.map(async (m) => {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(m.member_id)
        return {
          ...m,
          member_email: user?.email ?? 'Unknown',
          member_name: user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Unknown',
        } as EventMember
      } catch {
        return { ...m, member_email: 'Unknown', member_name: 'Unknown' } as EventMember
      }
    })
  )

  return { members: enriched, error: null }
}

/**
 * Returns all events the current user has been invited to as a co-host.
 * Used to show the "Co-hosting" section on the events dashboard.
 */
export async function getCoHostedEvents(): Promise<{
  memberships: Array<{ event_id: string; role: MemberRole }>
  error: string | null
}> {
  const { supabase, user } = await getAuthUser()

  const { data, error } = await supabase
    .from('event_members')
    .select('event_id, role')
    .eq('member_id', user.id)

  if (error) return { memberships: [], error: error.message }

  return {
    memberships: (data ?? []).map(r => ({
      event_id: r.event_id,
      role: r.role as MemberRole,
    })),
    error: null,
  }
}

// ── Invite ─────────────────────────────────────────────────────

/**
 * Invites a user to co-host an event by email address.
 * The invitee must already have a Crenelle account.
 * Only the event owner can invite (RLS enforced via organizer_id).
 */
export async function inviteTeamMember(
  eventId: string,
  email: string,
  role: MemberRole
): Promise<{ success?: boolean; error?: string }> {
  const { supabase, user } = await getAuthUser()
  const admin = createAdminClient()

  // Verify current user owns this event
  const { data: event } = await supabase
    .from('events')
    .select('organizer_id, name')
    .eq('id', eventId)
    .single()

  if (!event || event.organizer_id !== user.id) {
    return { error: 'Event not found or you are not the owner' }
  }

  // Prevent self-invite
  if (email.toLowerCase() === (user.email ?? '').toLowerCase()) {
    return { error: 'You cannot invite yourself as a co-host' }
  }

  // Look up the invitee in auth.users via admin client
  // Supabase admin.listUsers supports filtering but we paginate to find the email
  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (listError) return { error: 'Failed to look up user: ' + listError.message }

  const invitee = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!invitee) {
    return {
      error: `No Crenelle account found for ${email}. They must sign up first before being added as a co-host.`,
    }
  }

  // Insert membership row
  const { error: insertError } = await supabase
    .from('event_members')
    .insert({
      event_id: eventId,
      organizer_id: user.id,
      member_id: invitee.id,
      role,
      invited_by: user.id,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'This person is already a co-host for this event' }
    }
    return { error: insertError.message }
  }

  // Fetch event name + date to personalise the email
  const { data: eventRow } = await supabase
    .from('events')
    .select('name, date')
    .eq('id', eventId)
    .single()

  // Resolve inviter display name
  const inviterName = (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Your co-organiser'
  )

  // Send notification email — fire-and-forget (errors logged, not surfaced)
  if (eventRow) {
    void sendCoHostInviteEmail({
      inviteeEmail: invitee.email!,
      inviteeName: invitee.user_metadata?.full_name ?? invitee.user_metadata?.name ?? invitee.email?.split('@')[0] ?? 'there',
      inviterName,
      inviterEmail: user.email ?? '',
      eventName: eventRow.name,
      eventDate: eventRow.date,
      eventId,
      role,
    })
  }

  revalidatePath(`/events/${eventId}/team`)
  return { success: true }
}

// ── Update Role ────────────────────────────────────────────────

/**
 * Updates the role of an existing co-host.
 * Only the event owner can do this.
 */
export async function updateTeamMemberRole(
  memberId: string,
  eventId: string,
  role: MemberRole
): Promise<{ success?: boolean; error?: string }> {
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('event_members')
    .update({ role })
    .eq('id', memberId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/team`)
  return { success: true }
}

// ── Remove ─────────────────────────────────────────────────────

/**
 * Removes a co-host from an event.
 * Only the event owner can remove members (RLS: organizer_id = auth.uid()).
 */
export async function removeTeamMember(
  memberId: string,
  eventId: string
): Promise<{ success?: boolean; error?: string }> {
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('event_members')
    .delete()
    .eq('id', memberId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/team`)
  return { success: true }
}
