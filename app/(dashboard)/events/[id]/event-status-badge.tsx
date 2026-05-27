'use client'

import { useState } from 'react'
import { StatusChangeDialog } from '@/components/status-change-dialog'

const statusConfig: Record<string, { label: string; cls: string }> = {
  live:      { label: 'Live',      cls: 'status-live' },
  published: { label: 'Published', cls: 'status-published' },
  draft:     { label: 'Draft',     cls: 'status-draft' },
  ended:     { label: 'Ended',     cls: 'status-ended' },
}

const statusColors: Record<string, string> = {
  live:      'status-admitted',
  published: 'status-pending',
  draft:     'bg-foreground/10 text-foreground/60 px-4 py-1',
  ended:     'status-denied',
}

export function EventStatusBadge({
  eventId,
  eventName,
  initialStatus,
  canEdit,
  variant,
}: {
  eventId: string
  eventName: string
  initialStatus: string
  canEdit: boolean
  variant: 'header' | 'overview'
}) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)

  const statusInfo = statusConfig[initialStatus] ?? { label: initialStatus, cls: 'status-draft' }

  if (variant === 'header') {
    if (canEdit) {
      return (
        <>
          <button
            type="button"
            onClick={() => setStatusDialogOpen(true)}
            className={`inline-flex items-center gap-2 self-start sm:self-end shrink-0 cursor-pointer hover:opacity-85 transition-opacity border border-transparent ${statusInfo.cls}`}
            aria-label={`Change Status. Current status: ${statusInfo.label}`}
          >
            {initialStatus === 'live' && (
              <span className="size-1.5 rounded-full bg-current animate-blink shrink-0" aria-hidden="true" />
            )}
            {statusInfo.label}
          </button>

          {statusDialogOpen && (
            <StatusChangeDialog
              open={statusDialogOpen}
              onOpenChange={setStatusDialogOpen}
              eventId={eventId}
              eventName={eventName}
              currentStatus={initialStatus}
            />
          )}
        </>
      )
    }

    return (
      <div className={`inline-flex items-center gap-2 self-start sm:self-end shrink-0 ${statusInfo.cls}`}>
        {initialStatus === 'live' && (
          <span className="size-1.5 rounded-full bg-current animate-blink shrink-0" aria-hidden="true" />
        )}
        {statusInfo.label}
      </div>
    )
  }

  // overview variant
  if (canEdit) {
    return (
      <>
        <button
          type="button"
          onClick={() => setStatusDialogOpen(true)}
          className={`inline-block px-4 py-1 font-display text-lg uppercase cursor-pointer hover:opacity-85 transition-opacity border border-transparent ${statusColors[initialStatus] ?? ''}`}
          aria-label={`Change Status. Current status: ${initialStatus}`}
        >
          {initialStatus}
        </button>

        {statusDialogOpen && (
          <StatusChangeDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            eventId={eventId}
            eventName={eventName}
            currentStatus={initialStatus}
          />
        )}
      </>
    )
  }

  return (
    <span
      className={`inline-block px-4 py-1 font-display text-lg uppercase ${statusColors[initialStatus] ?? ''}`}
      aria-label={`Status: ${initialStatus}`}
    >
      {initialStatus}
    </span>
  )
}
