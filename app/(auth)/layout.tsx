import Link from 'next/link'
import { QrCode } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">

      {/* ── Left editorial panel (desktop) ── */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden flex-col justify-between p-14 bg-card border-r border-border">

        {/* Structural watermark */}
        <div
          className="absolute bottom-0 right-0 font-display font-bold text-foreground/[0.04] leading-none select-none pointer-events-none"
          style={{ fontSize: '26vw', lineHeight: 0.85 }}
          aria-hidden="true"
        >
          CR
        </div>

        {/* Copper vertical rule */}
        <div className="absolute left-14 top-0 bottom-0 w-px bg-copper/20" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3 pl-6">
          <div className="w-7 h-7 border border-copper/60 flex items-center justify-center">
            <QrCode className="w-3.5 h-3.5 text-copper" />
          </div>
          <span className="font-display font-light tracking-[0.2em] uppercase text-foreground text-xl">
            Crenelle
          </span>
        </Link>

        {/* Hero statement */}
        <div className="relative z-10 pl-6">
          <div className="border-l-2 border-copper pl-6 mb-8">
            <h2
              className="font-display text-foreground font-semibold leading-[0.95] tracking-tight"
              style={{ fontSize: 'clamp(32px, 4vw, 54px)' }}
            >
              Every seat,<br />
              <span className="italic font-light text-muted-foreground">accounted for.</span>
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {[
              'QR-coded entry passes, generated instantly',
              'Gate scanning from any phone, no app required',
              'Single-use codes — no duplicates, no gate-crashers',
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="font-sans text-[9px] font-bold text-copper mt-0.5 shrink-0 uppercase tracking-widest">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">{line}</p>
              </div>
            ))}
          </div>

          <p className="font-sans text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] mt-12">
            © 2026 Crenelle
          </p>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-background">

        {/* Mobile logo */}
        <Link href="/" className="lg:hidden mb-12 flex items-center gap-3">
          <div className="w-7 h-7 border border-copper/60 flex items-center justify-center">
            <QrCode className="w-3.5 h-3.5 text-copper" />
          </div>
          <span className="font-display font-light tracking-[0.2em] uppercase text-foreground text-xl">
            Crenelle
          </span>
        </Link>

        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
