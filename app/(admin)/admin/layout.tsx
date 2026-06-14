import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, QrCode, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { ModeToggle } from '@/components/mode-toggle'

/**
 * Admin layout — completely separate from the organizer (dashboard) group.
 *
 * Access control:
 *   ADMIN_EMAILS is a comma-separated list of email addresses allowed admin access.
 *   Example .env.local:
 *     ADMIN_EMAILS=you@example.com,backup@example.com
 *
 * To add a new admin: append their email to ADMIN_EMAILS and redeploy.
 * For full RBAC with database-backed roles, migrate to an `admin_roles` table.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Must be authenticated
  if (!user) redirect('/login')

  // 2. Must be in the admin allow-list
  //
  // ⚠️  KNOWN LIMITATION: This is an email-based allowlist read from an env var.
  //    Two weaknesses:
  //      a) Adding/removing admins requires a redeploy.
  //      b) If an admin changes their auth email address they silently lose access.
  //
  //    MIGRATION PATH: When ready, create an `admin_roles` table:
  //      CREATE TABLE admin_roles (user_id uuid PRIMARY KEY REFERENCES auth.users(id));
  //    Then check: SELECT 1 FROM admin_roles WHERE user_id = auth.uid()
  //    This is keyed on the immutable user.id, not the mutable user.email.
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes((user.email ?? '').toLowerCase())) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm px-6 md:px-10 py-4 flex items-center justify-between">
        {/* Brand + admin badge */}
        <Link
          href="/admin"
          className="flex items-center gap-3 group"
          aria-label="Crenelle Admin — go to admin dashboard"
        >
          <div className="w-7 h-7 border border-copper/60 flex items-center justify-center group-hover:border-copper transition-colors shrink-0">
            <QrCode className="w-3.5 h-3.5 text-copper" />
          </div>
          <span className="font-display font-light tracking-[0.2em] uppercase text-foreground text-xl group-hover:text-copper transition-colors">
            Crenelle
          </span>
          {/* Admin badge */}
          <span
            className="ml-1 inline-flex items-center gap-1 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] bg-copper/15 text-copper border border-copper/30 px-2 py-0.5"
            aria-label="Admin mode"
          >
            <ShieldCheck className="w-2.5 h-2.5" aria-hidden="true" />
            Admin
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <span
            className="font-sans text-[11px] text-muted-foreground hidden sm:block truncate max-w-52"
            aria-label={`Signed in as ${user.email}`}
          >
            {user.email}
          </span>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-1">
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
