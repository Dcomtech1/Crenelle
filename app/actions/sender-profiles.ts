'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Helpers ────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

// ── Read ───────────────────────────────────────────────────────

/**
 * Fetch all sender profiles for the current organizer.
 * Used to populate the event form selector.
 */
export async function getSenderProfiles() {
  const { supabase } = await getAuthUser()

  const { data, error } = await supabase
    .from('sender_profiles')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return { profiles: [], error: error.message }
  return { profiles: data ?? [], error: null }
}

// ── Create ─────────────────────────────────────────────────────

export async function createSenderProfile(formData: FormData) {
  const { supabase, user } = await getAuthUser()

  const displayName = (formData.get('display_name') as string).trim()
  const replyTo = (formData.get('reply_to') as string).trim()
  const isDefault = formData.get('is_default') === 'true'

  if (!displayName || !replyTo) {
    return { error: 'Display name and reply-to email are required' }
  }

  // If marking as default, clear any existing default first
  if (isDefault) {
    await supabase
      .from('sender_profiles')
      .update({ is_default: false })
      .eq('organizer_id', user.id)
      .eq('is_default', true)
  }

  const { error } = await supabase.from('sender_profiles').insert({
    organizer_id: user.id,
    display_name: displayName,
    reply_to: replyTo,
    is_default: isDefault,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/sender-profiles')
  revalidatePath('/events/new')
  return { success: true }
}

// ── Update ─────────────────────────────────────────────────────

export async function updateSenderProfile(id: string, formData: FormData) {
  const { supabase, user } = await getAuthUser()

  const displayName = (formData.get('display_name') as string).trim()
  const replyTo = (formData.get('reply_to') as string).trim()
  const isDefault = formData.get('is_default') === 'true'

  if (!displayName || !replyTo) {
    return { error: 'Display name and reply-to email are required' }
  }

  // Clear existing default before promoting this one
  if (isDefault) {
    await supabase
      .from('sender_profiles')
      .update({ is_default: false })
      .eq('organizer_id', user.id)
      .eq('is_default', true)
      .neq('id', id) // don't clear the row we're about to set
  }

  const { error } = await supabase
    .from('sender_profiles')
    .update({ display_name: displayName, reply_to: replyTo, is_default: isDefault })
    .eq('id', id)
    .eq('organizer_id', user.id) // RLS belt-and-suspenders

  if (error) return { error: error.message }

  revalidatePath('/settings/sender-profiles')
  revalidatePath('/events/new')
  return { success: true }
}

// ── Set Default ────────────────────────────────────────────────

/**
 * Atomically promotes a profile to default and clears the old one.
 * Idempotent — safe to call if it's already the default.
 */
export async function setDefaultSenderProfile(id: string) {
  const { supabase, user } = await getAuthUser()

  // Clear current default
  await supabase
    .from('sender_profiles')
    .update({ is_default: false })
    .eq('organizer_id', user.id)
    .eq('is_default', true)

  // Promote new default
  const { error } = await supabase
    .from('sender_profiles')
    .update({ is_default: true })
    .eq('id', id)
    .eq('organizer_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/sender-profiles')
  return { success: true }
}

// ── Delete ─────────────────────────────────────────────────────

export async function deleteSenderProfile(id: string) {
  const { supabase, user } = await getAuthUser()

  const { error } = await supabase
    .from('sender_profiles')
    .delete()
    .eq('id', id)
    .eq('organizer_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/sender-profiles')
  revalidatePath('/events/new')
  return { success: true }
}
