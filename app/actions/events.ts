'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Generate a URL-safe slug from the event name + random suffix */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}

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
      venue: formData.get('venue') as string,
      description: (formData.get('description') as string) || null,
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      event_type: eventType,
      registration_slug: eventType === 'open' ? generateSlug(name) : null,
      max_registrations: formData.get('max_registrations') ? Number(formData.get('max_registrations')) : null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/events')
  redirect(`/events/${data.id}`)
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient()

  const eventType = (formData.get('event_type') as string) || 'closed'
  const name = formData.get('name') as string

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
      venue: formData.get('venue') as string,
      description: (formData.get('description') as string) || null,
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      status: formData.get('status') as string,
      event_type: eventType,
      registration_slug: registrationSlug,
      max_registrations: formData.get('max_registrations') ? Number(formData.get('max_registrations')) : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/events/${id}`)
  return { success: true }
}

export async function deleteEvent(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('events').delete().eq('id', id)

  if (error) return { error: error.message }

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
