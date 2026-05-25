"use client"

/**
 * Renders the current time in the admin's local timezone.
 * Must be a client component — the server has no way to know the browser's timezone.
 * Hydrates instantly on mount; shows nothing during SSR to avoid hydration mismatch.
 */
export function LocalTimestamp() {
  const now = new Date()
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const tzStr = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <span suppressHydrationWarning>
      {timeStr} <span className="opacity-50">({tzStr})</span>
    </span>
  )
}
