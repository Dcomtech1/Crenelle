'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  label: string
  href: string
}

interface EventTabsProps {
  id: string
  tabs: Tab[]
}

export function EventTabs({ id, tabs }: EventTabsProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Event sections" className="mb-10">
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const fullHref = `/events/${id}${tab.href}`
          // If href is empty (Overview), match exact pathname. Otherwise, match exact or sub-path.
          const isActive = tab.href === ''
            ? pathname === fullHref
            : pathname === fullHref || pathname.startsWith(fullHref + '/')

          return (
            <Link
              key={tab.label}
              href={fullHref}
              aria-current={isActive ? 'page' : undefined}
              className={`relative font-sans text-xs font-semibold uppercase tracking-[0.14em] px-5 py-3 whitespace-nowrap transition-colors border-b-2 -mb-px focus-visible:outline-none focus-visible:text-copper focus-visible:border-copper ${
                isActive
                  ? 'border-copper text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
