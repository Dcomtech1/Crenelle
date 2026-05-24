"use client"

import { useState, useTransition } from 'react'
import { Star, Pencil, Trash2, Mail, Loader2, X } from 'lucide-react'
import type { SenderProfile } from '@/lib/types'
import { ProfileForm } from './profile-form'

interface ProfileActionsProps {
  profile: SenderProfile
  deleteAction: (id: string) => Promise<{ error?: string; success?: boolean }>
  setDefaultAction: (id: string) => Promise<{ error?: string; success?: boolean }>
}

export function ProfileActions({
  profile,
  deleteAction,
  setDefaultAction,
}: ProfileActionsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteAction(profile.id)
      setIsConfirmingDelete(false)
    })
  }

  function handleSetDefault() {
    startTransition(async () => {
      await setDefaultAction(profile.id)
    })
  }

  if (isEditing) {
    return (
      <div className="p-6" role="listitem">
        <div className="flex items-center justify-between mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-copper">
            Editing — {profile.display_name}
          </p>
          <button
            onClick={() => setIsEditing(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cancel edit"
          >
            <X className="size-4" />
          </button>
        </div>
        <ProfileForm profile={profile} onDone={() => setIsEditing(false)} />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 gap-4" role="listitem">
      {/* Identity info */}
      <div className="flex items-center gap-3 min-w-0">
        <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans text-sm font-medium text-foreground truncate">
              {profile.display_name}
            </span>
            {profile.is_default && (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.15em] text-copper border border-copper/30 bg-copper/10 px-1.5 py-0.5 shrink-0">
                <Star className="size-2.5" aria-hidden="true" />
                Default
              </span>
            )}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
            {profile.reply_to}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!profile.is_default && (
          <button
            onClick={handleSetDefault}
            disabled={isPending}
            title="Set as default"
            aria-label={`Set ${profile.display_name} as default`}
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:text-copper border border-border hover:border-copper/40 px-2.5 py-1.5 transition-all disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Star className="size-3" />
            )}
            <span className="hidden sm:inline">Default</span>
          </button>
        )}

        <button
          onClick={() => setIsEditing(true)}
          title="Edit profile"
          aria-label={`Edit ${profile.display_name}`}
          className="inline-flex items-center justify-center w-7 h-7 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        >
          <Pencil className="size-3" aria-hidden="true" />
        </button>

        {isConfirmingDelete ? (
          <div className="flex items-center gap-1 border border-denied/40 bg-denied/10 px-2 py-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-denied">Sure?</span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="font-mono text-[9px] uppercase tracking-wider text-denied hover:underline disabled:opacity-40"
              aria-label="Confirm delete"
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Yes'}
            </button>
            <span className="text-denied/40">/</span>
            <button
              onClick={() => setIsConfirmingDelete(false)}
              className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              aria-label="Cancel delete"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsConfirmingDelete(true)}
            title="Delete profile"
            aria-label={`Delete ${profile.display_name}`}
            className="inline-flex items-center justify-center w-7 h-7 border border-border text-muted-foreground hover:text-denied hover:border-denied/40 transition-all"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
