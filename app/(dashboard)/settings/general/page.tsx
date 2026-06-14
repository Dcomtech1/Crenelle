import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrganizerSettings } from '@/app/actions/general-settings'
import { GeneralSettingsForm } from './general-form'

export const metadata = {
  title: 'General Settings — Crenelle',
}

export default async function GeneralSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { settings } = await getOrganizerSettings()

  return (
    <div className="max-w-2xl">
      {/* ── Page header ── */}
      <div className="mb-10 pb-8 border-b border-border">
        <h1
          className="font-display font-semibold text-foreground leading-[0.95] tracking-tight mb-2"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          General settings
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Configure your organisation name, regional defaults, and global email preferences
          that apply across all your events.
        </p>
      </div>

      <GeneralSettingsForm settings={settings} />
    </div>
  )
}
