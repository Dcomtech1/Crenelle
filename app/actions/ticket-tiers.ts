'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createTier(
  eventId: string,
  name: string,
  price: number, // in kobo (NGN)
  capacity: number | null,
  isPublic: boolean
) {
  const supabase = await createClient()

  const { error } = await supabase.from('ticket_tiers').insert({
    event_id: eventId,
    name,
    price,
    capacity,
    is_public: isPublic,
    currency: 'NGN',
  })

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function updateTier(
  tierId: string,
  eventId: string,
  name: string,
  price: number, // in kobo (NGN)
  capacity: number | null,
  isPublic: boolean
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tiers')
    .update({ name, price, capacity, is_public: isPublic })
    .eq('id', tierId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function softDeleteTier(tierId: string, eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_tiers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tierId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function fetchTiers(eventId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_tiers')
    .select('*, tier_perks(*)')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function fetchPerks(tierId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tier_perks')
    .select('*')
    .eq('tier_id', tierId)
    .order('sort_order', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}
