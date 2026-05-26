'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Plus, Settings } from 'lucide-react'

export function MobileNav() {
  const pathname = usePathname()

  const tabs = [
    {
      label: 'Events',
      href: '/events',
      icon: Calendar,
    },
    {
      label: 'New Event',
      href: '/events/new',
      icon: Plus,
      isFab: true,
    },
    {
      label: 'Settings',
      href: '/settings/sender-profiles',
      icon: Settings,
    },
  ]

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-6 py-2 flex items-center justify-around sm:hidden h-16"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.isFab
          ? pathname === tab.href
          : pathname.startsWith(tab.href)

        if (tab.isFab) {
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label={tab.label}
              className={`flex items-center justify-center -translate-y-4 w-12 h-12 rounded-full border-4 border-background shadow-lg transition-all ${
                isActive
                  ? 'bg-foreground text-background scale-105'
                  : 'bg-copper text-background hover:scale-105'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
            </Link>
          )
        }

        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-1 px-3 focus-visible:outline-none transition-colors ${
              isActive ? 'text-copper' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4.5 h-4.5" aria-hidden="true" />
            <span className="font-mono text-[9px] uppercase tracking-widest leading-none">
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
