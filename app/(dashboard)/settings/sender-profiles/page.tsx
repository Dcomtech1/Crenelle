import { redirect } from 'next/navigation'
import { Mail, Star, Pencil, Trash2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { SenderProfile } from '@/lib/types'
import {
  deleteSenderProfile,
  setDefaultSenderProfile,
} from '@/app/actions/sender-profiles'
import { ProfileForm } from './profile-form'
import { ProfileActions } from './profile-actions'

export const metadata = {
  title: 'Sender Profiles — Crenelle',
}

export default async function SenderProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiles } = await supabase
    .from('sender_profiles')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const list = (profiles ?? []) as SenderProfile[]

  return (
    <div className="max-w-2xl">
      {/* ── Page header ── */}
      <div className="mb-10 pb-8 border-b border-border">
        <h1
          className="font-display font-semibold text-foreground leading-[0.95] tracking-tight mb-2"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          Sender profiles
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Create branded email identities for different organisations or sub-brands.
          Assign one to each event so guests instantly recognise who is contacting them.
        </p>
      </div>

      {/* ── How it works callout ── */}
      <div className="mb-8 p-4 border border-border bg-card">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-copper mb-2">How it works</p>
        <p className="font-sans text-xs text-muted-foreground leading-relaxed">
          When you send invitations or reminders for an event, the email{' '}
          <span className="text-foreground font-medium">From:</span> field shows the profile&apos;s
          display name, and replies go to its reply-to address — not your account email.
          The sending domain stays fixed (configured by your admin).
        </p>
        <div className="mt-3 p-3 bg-muted/50 font-mono text-[10px] text-muted-foreground">
          From: <span className="text-foreground">Acme Foundation &lt;noreply@yourdomain.com&gt;</span>
          <br />
          Reply-To: <span className="text-foreground">events@acmefoundation.org</span>
        </div>
      </div>

      {/* ── Profile list ── */}
      {list.length > 0 && (
        <div className="mb-8 flex flex-col divide-y divide-border border border-border" role="list">
          {list.map((profile) => (
            <ProfileActions
              key={profile.id}
              profile={profile}
              deleteAction={deleteSenderProfile}
              setDefaultAction={setDefaultSenderProfile}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {list.length === 0 && (
        <div className="mb-8 py-12 text-center border border-dashed border-border">
          <Mail className="size-6 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="font-sans text-sm text-muted-foreground">No sender profiles yet</p>
          <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mt-1">
            Create one below to get started
          </p>
        </div>
      )}

      {/* ── Create new profile ── */}
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-1 h-4 bg-copper shrink-0" aria-hidden="true" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            New profile
          </h2>
        </div>
        <div className="px-6 py-6">
          <ProfileForm />
        </div>
      </div>
    </div>
  )
}
