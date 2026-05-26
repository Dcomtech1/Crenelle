'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface EventBreadcrumbsProps {
  id: string
  eventName: string
}

export function EventBreadcrumbs({ id, eventName }: EventBreadcrumbsProps) {
  const pathname = usePathname()

  // Map sub-paths to readable labels
  const getSubPageLabel = () => {
    if (pathname === `/events/${id}`) return 'Overview'
    if (pathname.startsWith(`/events/${id}/guests`)) return 'Guests'
    if (pathname.startsWith(`/events/${id}/dashboard`)) return 'Live Dashboard'
    if (pathname.startsWith(`/events/${id}/scanner-links`)) return 'Scanner Links'
    if (pathname.startsWith(`/events/${id}/cards`)) return 'Passes'
    if (pathname.startsWith(`/events/${id}/team`)) return 'Team'
    if (pathname.startsWith(`/events/${id}/registrations`)) return 'Registrations'
    return ''
  }

  const subPageLabel = getSubPageLabel()

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <li>
          <Link href="/events" className="hover:text-foreground transition-colors">
            Events
          </Link>
        </li>
        <li className="mx-2.5 text-border/60" aria-hidden="true">/</li>
        <li>
          <Link href={`/events/${id}`} className="hover:text-foreground transition-colors max-w-[120px] sm:max-w-xs truncate block">
            {eventName}
          </Link>
        </li>
        {subPageLabel && (
          <>
            <li className="mx-2.5 text-border/60" aria-hidden="true">/</li>
            <li className="text-copper font-medium">
              {subPageLabel}
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}
