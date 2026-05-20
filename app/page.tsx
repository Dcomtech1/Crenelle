import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { QrCode, ArrowRight } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { cn } from '@/lib/utils'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const useCases = [
    "Weddings", "Galas", "Conferences", "Church Programs",
    "Birthday Parties", "Concerts", "Private Dinners", "Festivals", "Workshops"
  ]

  return (
    <div className="bg-background text-foreground min-h-screen overflow-x-hidden selection:bg-copper/30">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-14 py-5 border-b border-border bg-background/90 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-7 h-7 border border-copper/60 flex items-center justify-center group-hover:border-copper transition-colors">
            <QrCode className="w-3.5 h-3.5 text-copper" />
          </div>
          <span
            className="font-display text-xl font-light tracking-[0.25em] uppercase text-foreground"
            style={{ letterSpacing: '0.2em' }}
          >
            Crenelle
          </span>
        </Link>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-7">
            {[['#process', 'Process'], ['#features', 'Features'], ['#uses', 'For']].map(([href, label]) => (
              <a key={href} href={href}
                className="font-sans text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
              >{label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <div className="w-px h-4 bg-border hidden md:block" />
            <Link href="/login"
              className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-foreground border border-border hover:border-copper hover:text-copper px-5 py-2.5 transition-all"
            >
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen pt-24 pb-20 px-8 md:px-14 flex flex-col justify-center relative overflow-hidden">

        {/* Watermark text — structural atmosphere */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 font-display font-bold text-center pointer-events-none select-none text-foreground/4"
          style={{
            fontSize: 'clamp(80px, 18vw, 260px)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          CRENELLE
        </div>

        {/* Vertical copper rule — left edge */}
        <div className="absolute left-8 md:left-14 top-32 bottom-20 w-px bg-copper/15 hidden lg:block" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-16 xl:gap-24 items-center max-w-7xl mx-auto w-full">

          {/* Left — Typography as architecture */}
          <div className="pl-0 lg:pl-8">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-copper mb-8 mt-10">
              Event Access Management
            </p>

            <h1
              className="font-display font-bold leading-[0.9] tracking-tight mb-10"
              style={{ fontSize: 'clamp(64px, 10vw, 130px)' }}
            >
              <span className="block text-foreground italic">No</span>
              <span className="block text-foreground">Uninvited</span>
              <span className="block text-copper">Guests.</span>
            </h1>

            <div className="border-l border-copper/40 pl-6 mb-10 max-w-md">
              <p className="font-sans text-sm font-normal leading-relaxed text-muted-foreground">
                QR-coded entry passes. Real-time gate scanning. Live attendance dashboards.
                Total control from invitation to exit.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login"
                className="inline-flex items-center gap-3 bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] px-8 py-4 hover:bg-foreground/90 transition-colors group"
              >
                Create an event
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#process"
                className="font-sans text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
              >
                See how →
              </a>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-10 mt-16 pt-8 border-t border-border">
              {[
                { n: '847', label: 'Events hosted' },
                { n: '134k+', label: 'Guests processed' },
                { n: '99.8%', label: 'Scan accuracy' },
              ].map(s => (
                <div key={s.label}>
                  <p className="font-display text-2xl font-semibold text-foreground">{s.n}</p>
                  <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Physical pass mockup */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="animate-float" style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.6))' }}>
              {/* Pass ticket — printed on card stock */}
              <div className="relative w-96 bg-card text-card-foreground border border-border overflow-hidden"
                style={{ boxShadow: '4px 4px 0 0 rgba(var(--copper-rgb), 0.2)' }}
              >
                {/* Copper top bar */}
                <div className="h-1.5 bg-copper w-full" />

                {/* Top section */}
                <div className="px-7 pt-6 pb-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-1">Entry Pass</p>
                      <p className="font-display text-2xl font-bold leading-tight">The Grand Meridian<br/>Gala 2026</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-copper border border-copper px-2 py-1">
                        Live
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4">
                    {[
                      ['Guest', 'Alexandra Harris'],
                      ['Ref.', 'CRN-7H2K-9P'],
                      ['Date', '21 Jun 2026'],
                      ['Venue', 'The Meridian, Lagos'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p className="font-sans text-[8px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                        <p className="font-sans text-xs font-semibold mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Perforated tear line */}
                <div className="relative mx-5 border-t border-dashed border-border flex items-center">
                  <div className="absolute -left-8 w-4 h-4 rounded-full bg-background" />
                  <div className="absolute -right-8 w-4 h-4 rounded-full bg-background" />
                </div>

                {/* Bottom stub */}
                <div className="px-7 py-5 flex items-center justify-between">
                  <div>
                    <p className="font-sans text-[8px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Table / Seat</p>
                    <p className="font-display text-xl font-semibold">Table 7 · A</p>
                    <p className="font-sans text-[9px] text-muted-foreground mt-0.5">Party of 2</p>
                  </div>

                  {/* QR Grid */}
                  <div className="border border-border p-1.5 bg-white">
                    <div className="grid grid-cols-9 w-20 h-20">
                      {Array(81).fill(0).map((_, i) => (
                        <div key={i}
                          className={cn("w-full h-full", [0,1,2,3,4,5,6,7,9,15,18,21,24,27,28,29,30,31,32,33,34,35,36,38,40,42,44,46,48,50,53,56,59,62,63,64,65,66,67,68,70,72,74,76].includes(i)
                            ? 'bg-black' : 'bg-white'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* ADMIT ONE stamp — rotated overlay */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display font-bold text-4xl text-copper border-2 border-copper px-5 py-2 uppercase select-none pointer-events-none"
                  style={{ transform: 'translate(-50%, -50%) rotate(-14deg)', opacity: 0.18, letterSpacing: '0.1em' }}
                >
                  ADMIT ONE
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES STRIP ── */}
      <section id="uses" className="border-y border-border py-5 overflow-hidden bg-card/40">
        <div className="animate-marquee">
          {Array(2).fill(0).map((_, i) => (
            <div key={i} className="flex items-center shrink-0">
              {useCases.map(uc => (
                <span key={uc}
                  className="font-display italic text-2xl text-muted-foreground mx-10 whitespace-nowrap flex items-center gap-6"
                >
                  {uc}
                  <span className="w-1 h-1 rounded-full bg-copper/50 inline-block not-italic" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section id="process" className="py-28 px-8 md:px-14 border-b border-border">
        <div className="max-w-7xl mx-auto">

          <div className="flex items-baseline gap-6 mb-16">
            <h2 className="font-display italic font-light text-5xl md:text-6xl text-foreground">The process</h2>
            <div className="flex-1 h-px bg-border ml-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
            {[
              { n: '01', title: 'Create your event', body: 'Set the event name, date, venue, and capacity. Done in minutes. No technical setup required.' },
              { n: '02', title: 'Add your guest list', body: 'Enter each guest with their party size and seat. Crenelle generates their unique QR entry pass automatically.' },
              { n: '03', title: 'Print & distribute passes', body: 'Download beautifully formatted entry cards. Print and hand-deliver, or dispatch via email.' },
              { n: '04', title: 'Scan at the gate', body: 'Share the scanner link with your ushers. They use their own phones — no app download, no login.' },
            ].map(step => (
              <div key={step.n} className="bg-card px-8 py-10 group hover:bg-muted/30 transition-colors">
                <p
                  className="font-display font-bold text-foreground/5 leading-none mb-6 select-none"
                  style={{ fontSize: 'clamp(56px, 8vw, 96px)' }}
                >
                  {step.n}
                </p>
                <div className="accent-bar">
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-28 px-8 md:px-14 bg-card/50 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-copper mb-4">What you get</p>
            <h2
              className="font-display font-semibold text-foreground leading-[0.95]"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)' }}
            >
              Everything you need<br />
              <span className="italic font-light">at the gate.</span>
            </h2>
          </div>

          {/* Feature rows — editorial, not cards */}
          <div className="flex flex-col divide-y divide-parchment/[0.07]">
            {[
              {
                num: '01',
                title: 'Personalised QR Entry Passes',
                body: 'Every guest receives a unique QR code tied to their name, party size, and seat — generated the moment you add them. Formatted for print, ready to hand out.',
                tag: 'Core',
              },
              {
                num: '02',
                title: 'Instant Gate Scanning',
                body: 'Ushers scan from any phone browser. No app to download, no credentials needed. Green means in. Entry confirmed in under two seconds.',
                tag: 'Real-time',
              },
              {
                num: '03',
                title: 'Live Attendance Dashboard',
                body: 'Watch arrivals update in real time from any device. See who\'s in, who\'s pending, and your live headcount — all without refreshing.',
                tag: 'Analytics',
              },
              {
                num: '04',
                title: 'Zero Uninvited Guests',
                body: 'Every QR code works exactly once. Duplicates are flagged immediately on scan. No valid pass means no entry — no exceptions, no arguments.',
                tag: 'Security',
              },
            ].map(f => (
              <div key={f.num} className="grid grid-cols-1 md:grid-cols-[80px_1fr_auto] gap-6 py-10 items-start group">
                <p className="font-display text-4xl font-light text-muted-foreground group-hover:text-copper transition-colors">{f.num}</p>
                <div>
                  <h3 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-3">{f.title}</h3>
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-2xl">{f.body}</p>
                </div>
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.25em] text-copper border border-copper/30 px-3 py-1.5 self-start">
                  {f.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-32 px-8 md:px-14 relative overflow-hidden">
        {/* Background number — structural */}
        <div
          className="absolute inset-0 flex items-center justify-center font-display font-bold text-parchment/2 pointer-events-none select-none"
          style={{ fontSize: '35vw', lineHeight: 1 }}
          aria-hidden="true"
        >
          IN
        </div>

        <div className="relative z-10 max-w-5xl">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-copper mb-8">Ready?</p>
          <h2
            className="font-display font-semibold text-foreground leading-[0.92] tracking-tight mb-12"
            style={{ fontSize: 'clamp(48px, 8vw, 110px)' }}
          >
            Take control of<br />
            <span className="italic font-light">your door.</span>
          </h2>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <Link href="/login"
              className="inline-flex items-center gap-3 bg-foreground text-background font-sans text-sm font-semibold uppercase tracking-[0.12em] px-10 py-5 hover:opacity-80 transition-opacity group"
            >
              Create a free account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="font-sans text-xs text-muted-foreground self-center">No credit card. Set up in five minutes.</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-10 px-8 md:px-14">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border border-copper/50 flex items-center justify-center">
              <QrCode className="w-3 h-3 text-copper" />
            </div>
            <span className="font-display font-light tracking-[0.2em] uppercase text-muted-foreground text-sm">Crenelle</span>
            <span className="text-muted-foreground/40 text-xs ml-4">© 2026. All rights reserved.</span>
          </div>

          <div className="flex gap-10">
            {[
              ['#process', 'Process'],
              ['#features', 'Features'],
              ['/login', 'Sign in'],
            ].map(([href, label]) => (
              <a key={href} href={href}
                className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
              >{label}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
