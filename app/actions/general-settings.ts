'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { OrganizerSettings, DateFormat, ClockFormat } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

// ── Read ───────────────────────────────────────────────────────

/**
 * Fetch the current organizer's settings row.
 * If none exists yet, returns safe defaults (row is created on first save).
 * NOTE: This is entirely separate from sender_profiles, which controls
 * email From:/Reply-To headers for branded identities.
 */
export async function getOrganizerSettings(): Promise<{
  settings: OrganizerSettings | null
  error: string | null
}> {
  const { supabase, user } = await getAuthUser()

  const { data, error } = await supabase
    .from('organizer_settings')
    .select('*')
    .eq('organizer_id', user.id)
    .maybeSingle()

  if (error) return { settings: null, error: error.message }
  return { settings: data as OrganizerSettings | null, error: null }
}

// ── Create / Update (Upsert) ────────────────────────────────────

/**
 * Save (upsert) the organizer's general settings.
 * Uses conflict resolution on organizer_id so repeated saves
 * always update the single existing row.
 */
export async function saveOrganizerSettings(formData: FormData): Promise<{
  success?: boolean
  error?: string
}> {
  const { supabase, user } = await getAuthUser()

  const orgName     = (formData.get('org_name') as string | null)?.trim() || null
  const timezone    = (formData.get('default_timezone') as string)?.trim()
  const currency    = (formData.get('default_currency') as string)?.trim()
  const dateFormat  = (formData.get('date_format') as DateFormat)
  const clockFormat = (formData.get('clock_format') as ClockFormat)
  const emailFooter = (formData.get('email_footer') as string | null)?.trim() || null

  // Basic validation
  if (!timezone) return { error: 'Default timezone is required.' }
  if (!currency) return { error: 'Default currency is required.' }

  const validDateFormats: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
  const validClockFormats: ClockFormat[] = ['12h', '24h']

  if (!validDateFormats.includes(dateFormat)) return { error: 'Invalid date format.' }
  if (!validClockFormats.includes(clockFormat)) return { error: 'Invalid clock format.' }

  if (emailFooter && emailFooter.length > 500) {
    return { error: 'Email footer must be 500 characters or fewer.' }
  }

  const { error } = await supabase
    .from('organizer_settings')
    .upsert(
      {
        organizer_id:     user.id,
        org_name:         orgName,
        default_timezone: timezone,
        default_currency: currency,
        date_format:      dateFormat,
        clock_format:     clockFormat,
        email_footer:     emailFooter,
      },
      { onConflict: 'organizer_id' }
    )

  if (error) return { error: error.message }

  revalidatePath('/settings/general')
  return { success: true }
}
