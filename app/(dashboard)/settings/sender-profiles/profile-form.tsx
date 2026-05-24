"use client"

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import { createSenderProfile, updateSenderProfile } from '@/app/actions/sender-profiles'
import type { SenderProfile } from '@/lib/types'

interface ProfileFormProps {
  /** If provided, form is in edit mode; otherwise create mode. */
  profile?: SenderProfile
  onDone?: () => void
}

export function ProfileForm({ profile, onDone }: ProfileFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEdit = !!profile

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updateSenderProfile(profile.id, formData)
        : await createSenderProfile(formData)

      if (result?.error) {
        setError(result.error)
      } else {
        onDone?.()
      }
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div role="alert" className="border border-denied/50 bg-denied/10 px-4 py-3 font-mono text-xs text-denied uppercase tracking-wide">
          ⚠ {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${isEdit ? 'edit' : 'new'}-display-name`} className={labelCls}>
          Display name *
        </label>
        <input
          id={`${isEdit ? 'edit' : 'new'}-display-name`}
          name="display_name"
          required
          defaultValue={profile?.display_name ?? ''}
          placeholder="e.g. Acme Foundation, Tech Arm Lagos"
          className={fieldCls}
        />
        <p className={hintCls}>Shown in the "From:" field of every email sent for this identity</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${isEdit ? 'edit' : 'new'}-reply-to`} className={labelCls}>
          Reply-to email *
        </label>
        <input
          id={`${isEdit ? 'edit' : 'new'}-reply-to`}
          name="reply_to"
          type="email"
          required
          defaultValue={profile?.reply_to ?? ''}
          placeholder="e.g. events@acmefoundation.org"
          className={fieldCls}
        />
        <p className={hintCls}>Replies from guests land here — can be any address you control</p>
      </div>

      {/* Hidden field — toggled by the checkbox below */}
      <DefaultToggle defaultChecked={profile?.is_default ?? false} />

      <div className="flex gap-3 pt-2 border-t border-border">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-foreground text-background font-sans text-xs font-semibold uppercase tracking-[0.12em] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {isEdit ? 'Save changes' : 'Create profile'}
        </button>

        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60 hover:text-foreground px-4 py-3 border border-border hover:border-foreground/30 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Default toggle ──────────────────────────────────────────────

function DefaultToggle({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-start gap-3">
      {/* Hidden field carries the actual value */}
      <input type="hidden" name="is_default" value={checked ? 'true' : 'false'} />

      <button
        type="button"
        role="checkbox"
        id="is-default-toggle"
        aria-checked={checked}
        onClick={() => setChecked((v) => !v)}
        className={[
          'mt-0.5 w-4 h-4 shrink-0 border transition-colors',
          checked
            ? 'bg-copper border-copper'
            : 'bg-transparent border-border hover:border-foreground/40',
        ].join(' ')}
        aria-label="Set as default sender profile"
      >
        {checked && (
          <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5" aria-hidden="true">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-background" />
          </svg>
        )}
      </button>

      <div>
        <label
          htmlFor="is-default-toggle"
          className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground cursor-pointer"
        >
          Set as default
        </label>
        <p className={hintCls}>
          Used for events that don&apos;t have a specific profile assigned
        </p>
      </div>
    </div>
  )
}
