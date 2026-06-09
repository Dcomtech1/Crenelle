import Link from 'next/link'
import { QrCode, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Page Not Found — Crenelle',
}

export default function NotFound() {
  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col justify-between overflow-x-hidden selection:bg-copper/30 relative grain">
      
      {/* Navigation Header */}
      <header className="flex items-center justify-between px-8 md:px-14 py-6 border-b border-border bg-background/50 backdrop-blur-sm z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-7 h-7 border border-copper/60 flex items-center justify-center group-hover:border-copper transition-colors">
            <QrCode className="w-3.5 h-3.5 text-copper" />
          </div>
          <span className="font-display text-xl font-light tracking-[0.25em] uppercase text-foreground">
            Crenelle
          </span>
        </Link>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20 relative z-10">
        {/* Large watermark error code */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display font-bold text-center pointer-events-none select-none text-foreground/3"
          style={{
            fontSize: 'clamp(120px, 30vw, 400px)',
            letterSpacing: '-0.05em',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          404
        </div>

        <div className="relative z-20 space-y-8 max-w-lg">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-copper">
            Entry Denied
          </p>

          <h1
            className="font-display font-bold leading-[0.9] tracking-tight"
            style={{ fontSize: 'clamp(44px, 8vw, 84px)' }}
          >
            Access <span className="text-copper italic">Revoked</span>.
          </h1>

          <div className="w-16 h-px bg-copper/40 mx-auto" />

          <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            The page you are looking for does not exist, has been moved, or you do not have permissions to view it.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-3 bg-foreground text-background font-sans text-xs font-semibold uppercase tracking-[0.12em] px-8 py-4 hover:opacity-85 transition-opacity cursor-pointer w-full sm:w-auto justify-center"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground/75 hover:text-foreground px-6 py-4 border border-border hover:border-foreground/30 transition-colors w-full sm:w-auto justify-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-8 md:px-14 z-10 bg-card/20 text-center sm:text-left">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60">
          <p>© 2026 Crenelle. Page not found.</p>
          <div className="flex gap-6 font-mono text-[10px] uppercase tracking-wider">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
