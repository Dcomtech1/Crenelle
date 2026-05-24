import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, QrCode, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { ModeToggle } from '@/components/mode-toggle'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm px-6 md:px-10 py-4 flex items-center justify-between">
        <Link
          href="/events"
          className="flex items-center gap-3 group"
          aria-label="Crenelle — go to events dashboard"
        >
          <div className="w-7 h-7 border border-copper/60 flex items-center justify-center group-hover:border-copper transition-colors shrink-0">
            <QrCode className="w-3.5 h-3.5 text-copper" />
          </div>
          <span className="font-display font-light tracking-[0.2em] uppercase text-foreground text-xl group-hover:text-copper transition-colors">
            Crenelle
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span
            className="font-sans text-[11px] text-muted-foreground hidden sm:block truncate max-w-52"
            aria-label={`Signed in as ${user.email}`}
          >
            {user.email}
          </span>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-1">
            <Link
              href="/settings/sender-profiles"
              className="inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70 hover:text-foreground border border-border hover:border-foreground/30 bg-transparent hover:bg-foreground/4 transition-all h-8 px-3"
              aria-label="Settings"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <ModeToggle />
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70 hover:text-foreground border border-border hover:border-foreground/30 bg-transparent hover:bg-foreground/4 transition-all h-8 px-3 cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
