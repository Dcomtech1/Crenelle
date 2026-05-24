import { createClient } from '@/lib/supabase/server'
import type { SenderProfile } from '@/lib/types'
import { NewEventForm } from './new-event-form'

export default async function NewEventPage() {
  const supabase = await createClient()

  // Load the organizer's sender profiles for the identity selector
  const { data: profiles } = await supabase
    .from('sender_profiles')
    .select('id, display_name, reply_to, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  return (
    <NewEventForm
      profiles={(profiles ?? []) as Pick<SenderProfile, 'id' | 'display_name' | 'reply_to' | 'is_default'>[]}
    />
  )
}
