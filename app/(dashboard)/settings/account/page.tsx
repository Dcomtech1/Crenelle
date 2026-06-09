import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountSettingsForm } from './account-form'

export const metadata = {
  title: 'Account Settings — Crenelle',
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl">
      {/* ── Page header ── */}
      <div className="mb-10 pb-8 border-b border-border">
        <h1
          className="font-display font-semibold text-foreground leading-[0.95] tracking-tight mb-2"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          Account settings
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Manage your personal details, connected authentication providers, password settings, and account security.
        </p>
      </div>

      <AccountSettingsForm user={user} />
    </div>
  )
}
