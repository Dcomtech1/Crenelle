'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils/slug'



export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const eventType = (formData.get('event_type') as string) || 'closed'
  const name = formData.get('name') as string

  const { data, error } = await supabase
    .from('events')
    .insert({
      organizer_id: user.id,
      name,
      date: formData.get('date') as string,
      time: (formData.get('time') as string) || null,
      timezone: (formData.get('timezone') as string) || 'Africa/Lagos',
      venue: formData.get('venue') as string,
      description: (formData.get('description') as string) || null,
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      event_type: eventType,
      registration_slug: eventType === 'open' ? generateSlug(name) : null,
      max_registrations: formData.get('max_registrations') ? Number(formData.get('max_registrations')) : null,
      banner_url: (formData.get('banner_url') as string) || null,
      sender_profile_id: (formData.get('sender_profile_id') as string) || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/events')
  redirect(`/events/${data.id}`)
}

function getStorageFilename(url: string | null | undefined): string | null {
  if (!url) return null
  if (!url.includes('/storage/v1/object/public/banners/')) return null
  try {
    const parts = url.split('/storage/v1/object/public/banners/')
    if (parts.length < 2) return null
    const filename = parts[1].split('?')[0].split('#')[0]
    return filename || null
  } catch {
    return null
  }
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient()

  // Fetch current event to check the current banner_url before updating
  const { data: currentEvent } = await supabase
    .from('events')
    .select('banner_url')
    .eq('id', id)
    .single()

  const eventType = (formData.get('event_type') as string) || 'closed'
  const name = formData.get('name') as string
  const newBannerUrl = (formData.get('banner_url') as string) || null

  // If switching to open and no slug exists, generate one
  let registrationSlug: string | null = (formData.get('registration_slug') as string) || null
  if (eventType === 'open' && !registrationSlug) {
    registrationSlug = generateSlug(name)
  }
  if (eventType === 'closed') {
    registrationSlug = null
  }

  const { error } = await supabase
    .from('events')
    .update({
      name,
      date: formData.get('date') as string,
      time: (formData.get('time') as string) || null,
      timezone: (formData.get('timezone') as string) || 'Africa/Lagos',
      venue: formData.get('venue') as string,
      description: (formData.get('description') as string) || null,
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      status: formData.get('status') as string,
      event_type: eventType,
      registration_slug: registrationSlug,
      max_registrations: formData.get('max_registrations') ? Number(formData.get('max_registrations')) : null,
      banner_url: newBannerUrl,
      sender_profile_id: (formData.get('sender_profile_id') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Clean up old banner from storage if it has changed
  if (currentEvent && currentEvent.banner_url !== newBannerUrl) {
    const oldFilename = getStorageFilename(currentEvent.banner_url)
    if (oldFilename) {
      await supabase.storage.from('banners').remove([oldFilename])
    }
  }

  revalidatePath(`/events/${id}`)
  return { success: true }
}

export async function deleteEvent(id: string) {
  const supabase = await createClient()

  // Fetch current event to check for banner_url before deletion
  const { data: currentEvent } = await supabase
    .from('events')
    .select('banner_url')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('events').delete().eq('id', id)

  if (error) return { error: error.message }

  // Clean up physical banner file if it exists in Supabase Storage
  if (currentEvent?.banner_url) {
    const filename = getStorageFilename(currentEvent.banner_url)
    if (filename) {
      await supabase.storage.from('banners').remove([filename])
    }
  }

  revalidatePath('/events')
  redirect('/events')
}

/** Lightweight status-only update — used from the quick-change status pill on event cards */
export async function updateEventStatus(id: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return { success: true }
}
