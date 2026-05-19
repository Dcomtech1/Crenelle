'use client'

import { useState, useTransition } from 'react'
import { updateEventStatus } from '@/app/actions/events'
import { toast } from 'sonner'

interface StatusChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventName: string
  currentStatus: string
}

const statuses = [
  { value: 'draft',     label: 'Draft',     desc: 'Setup in progress, scanning closed' },
  { value: 'published', label: 'Published', desc: 'Ready to go, scanning not yet open' },
  { value: 'live',      label: 'Live',      desc: 'Scanning open — ushers can admit guests' },
  { value: 'ended',     label: 'Ended',     desc: 'Event over, all scanning blocked' },
]

export function StatusChangeDialog({
  open, onOpenChange, eventId, eventName, currentStatus
}: StatusChangeDialogProps) {
  const [selected, setSelected] = useState(currentStatus)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  function handleConfirm() {
    startTransition(async () => {
      const result = await updateEventStatus(eventId, selected)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Status updated to ${selected}`)
        onOpenChange(false)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/85"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div className="relative z-10 bg-background border border-border w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-copper mb-2">
            Change status
          </p>
          <h2 id="status-dialog-title" className="font-display text-2xl font-semibold text-foreground tracking-tight">
            {eventName}
          </h2>
        </div>

        {/* Status options */}
        <div className="p-6 flex flex-col gap-2">
          {statuses.map(s => {
            const isActive = selected === s.value
            const isCurrent = currentStatus === s.value
            return (
              <button
                key={s.value}
                onClick={() => setSelected(s.value)}
                className={`w-full text-left px-4 py-3.5 border transition-all ${
                  isActive
                    ? 'border-copper bg-copper/[0.08] text-foreground'
                    : 'border-border hover:border-foreground/30 text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm font-semibold">{s.label}</span>
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="font-sans text-[9px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
                        Current
                      </span>
                    )}
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-copper" />
                    )}
                  </div>
                </div>
                <p className="font-sans text-xs text-muted-foreground mt-0.5">{s.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={isPending || selected === currentStatus}
            className="flex-1 bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] py-3 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Updating...' : `Set to ${statuses.find(s => s.value === selected)?.label}`}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-5 py-3 font-sans text-sm text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
