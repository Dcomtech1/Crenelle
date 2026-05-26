'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mail, User, Sliders } from 'lucide-react'

export function SettingsSidebar() {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'Sender Profiles',
      href: '/settings/sender-profiles',
      icon: Mail,
      disabled: false,
    },
    {
      label: 'Account',
      href: '#',
      icon: User,
      disabled: true,
      badge: 'Soon'
    },
    {
      label: 'General',
      href: '#',
      icon: Sliders,
      disabled: true,
      badge: 'Soon'
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-copper mb-4">
          Settings Menu
        </p>
        <nav aria-label="Settings sections" className="flex flex-row md:flex-col gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible border-b md:border-b-0 border-border pb-3 md:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href) && !item.disabled

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/45 border-l border-transparent select-none cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="hidden md:inline font-sans text-[8px] font-semibold tracking-normal border border-border/40 text-muted-foreground/30 px-1.5 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-copper border-l-2 border-copper pl-[11px] bg-foreground/[0.02]'
                    : 'text-muted-foreground hover:text-foreground border-l border-transparent hover:border-border/30 hover:bg-foreground/[0.01]'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
