'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Search, X, Users } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type ScanResult =
  | { status: 'success'; guestName: string; partySize: number; enteredCount: number; admittedNow: number; seatInfo: string | null }
  | { status: 'duplicate'; guestName: string; partySize: number; seatInfo: string | null; enteredAt: string }
  | { status: 'error'; message: string }

type PendingSelection = {
  invitationId: string
  guestName: string
  partySize: number
  remaining: number
  seatInfo: string | null
}

type SearchResult = {
  guestId: string
  guestName: string
  phone: string | null
  invitationId: string
  partySize: number
  seatInfo: string | null
}

type Counter = {
  gateLabel: string
  gateTotal: number
  eventTotal: number
  totalSeats: number
}

// ── Audio helpers (Web Audio API — no network, no assets) ─────────────────────

function playTone(type: 'admit' | 'deny' | 'warning') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    const configs: Record<string, Array<{ freq: number; start: number; duration: number; gain: number }>> = {
      // Admit: two ascending chime tones — cheerful, clear
      admit: [
        { freq: 784, start: 0,    duration: 0.12, gain: 0.35 },
        { freq: 1047, start: 0.1, duration: 0.18, gain: 0.30 },
      ],
      // Deny: single low thud — unmistakably wrong
      deny: [
        { freq: 220, start: 0, duration: 0.25, gain: 0.45 },
      ],
      // Warning (duplicate / already entered): two short mid tones
      warning: [
        { freq: 523, start: 0,    duration: 0.10, gain: 0.30 },
        { freq: 523, start: 0.12, duration: 0.10, gain: 0.30 },
      ],
    }

    for (const { freq, start, duration, gain } of configs[type]) {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.type = type === 'deny' ? 'sawtooth' : 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gainNode.gain.setValueAtTime(gain, ctx.currentTime + start)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }

    // Auto-close context after tones finish
    setTimeout(() => ctx.close(), 800)
  } catch {
    // AudioContext not available (old browser, server render) — silent fail
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScannerClient({
  token,
  gate,
  eventName,
  eventId,
}: {
  token: string
  gate: string
  eventName: string
  eventDate: string
  eventVenue: string
  eventId?: string
}) {
  // --- Core scanner state ---
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [selectedCount, setSelectedCount] = useState(1)
  const [processing, setProcessing] = useState(false)

  // --- Manual name search state ---
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // --- Live usher counter state ---
  const [counter, setCounter] = useState<Counter | null>(null)

  // --- Refs ---
  const scannerRef = useRef<any>(null)
  const lastScannedRef = useRef<string>('')
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Counter polling ─────────────────────────────────────────────────────────

  const fetchCounter = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/counter?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setCounter(data)
      }
    } catch { /* silent */ }
  }, [token])

  useEffect(() => {
    fetchCounter()
    const interval = setInterval(fetchCounter, 15_000)
    return () => clearInterval(interval)
  }, [fetchCounter])

  // ── QR scanning ────────────────────────────────────────────────────────────

  async function processScan(invitationId: string) {
    if (invitationId === lastScannedRef.current) return
    lastScannedRef.current = invitationId
    setTimeout(() => { lastScannedRef.current = '' }, 3000)

    if (scannerRef.current) {
      try { await scannerRef.current.pause(true) } catch (err) { console.error(err) }
    }

    setProcessing(true)
    setResult(null)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, scannerToken: token, checkOnly: true }),
      })

      const data = await res.json()

      if (res.status === 409 && data.alreadyEntered) {
        playTone('warning')
        setResult({
          status: 'duplicate',
          guestName: data.guest?.name ?? 'Unknown',
          partySize: data.partySize,
          seatInfo: data.seatInfo,
          enteredAt: data.enteredAt,
        })
        autoReset()
      } else if (res.ok) {
        if (data.partySize > 1 && data.remaining > 1) {
          setPendingSelection({
            invitationId,
            guestName: data.guest?.name ?? 'Unknown',
            partySize: data.partySize,
            remaining: data.remaining,
            seatInfo: data.seatInfo,
          })
          setSelectedCount(data.remaining)
        } else {
          await confirmAdmission(invitationId, 1)
        }
      } else {
        playTone('deny')
        setResult({ status: 'error', message: data.error ?? 'INVALID CODE' })
        autoReset()
      }
    } catch {
      playTone('deny')
      setResult({ status: 'error', message: 'NETWORK FAILURE' })
      autoReset()
    }

    setProcessing(false)
  }

  async function confirmAdmission(invitationId: string, count: number) {
    setProcessing(true)
    setPendingSelection(null)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, scannerToken: token, count }),
      })

      const data = await res.json()

      if (res.ok) {
        playTone('admit')
        setResult({
          status: 'success',
          guestName: data.guest?.name ?? 'Unknown',
          partySize: data.partySize,
          enteredCount: data.enteredCount,
          admittedNow: data.admittedNow,
          seatInfo: data.seatInfo,
        })
        // Refresh counter immediately after admission
        fetchCounter()
      } else {
        playTone('deny')
        setResult({ status: 'error', message: data.error ?? 'ADMISSION FAILED' })
      }
    } catch {
      playTone('deny')
      setResult({ status: 'error', message: 'CONNECTION LOST' })
    }

    setProcessing(false)
    autoReset()
  }

  function autoReset() {
    clearTimeout(resultTimeoutRef.current)
    resultTimeoutRef.current = setTimeout(() => {
      setResult(null)
      if (scannerRef.current) {
        try { scannerRef.current.resume() } catch {}
      }
    }, 3000)
  }

  // ── QR camera ───────────────────────────────────────────────────────────────

  async function startScanner() {
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => processScan(decodedText.trim()),
        () => {}
      )
      scannerRef.current = scanner
      setScanning(true)
    } catch (err) {
      console.error('Scanner start error:', err)
    }
  }

  useEffect(() => {
    startScanner()
    return () => {
      clearTimeout(resultTimeoutRef.current)
      if (scannerRef.current) {
        try { scannerRef.current.stop() } catch {}
      }
    }
  }, [])

  // ── Manual name search ──────────────────────────────────────────────────────

  function handleSearchInput(q: string) {
    setSearchQuery(q)
    clearTimeout(searchDebounce.current)
    if (q.length < 2) { setSearchResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/scan/search?token=${token}&q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results ?? [])
        }
      } catch { /* silent */ }
      setSearchLoading(false)
    }, 300)
  }

  function openSearch() {
    setSearchOpen(true)
    // Pause camera while manual search is open
    if (scannerRef.current) {
      try { scannerRef.current.pause(true) } catch {}
    }
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    clearTimeout(searchDebounce.current)
    // Resume camera
    if (scannerRef.current) {
      try { scannerRef.current.resume() } catch {}
    }
  }

  // ── Counter display helpers ─────────────────────────────────────────────────

  const capacityPct = counter && counter.totalSeats > 0
    ? Math.min(100, Math.round((counter.eventTotal / counter.totalSeats) * 100))
    : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col bg-void text-paper overflow-hidden select-none">

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="p-4 pt-10 shrink-0 border-b-2 border-ink">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl tracking-[0.3em] leading-none text-paper uppercase">
              CRENELLE
            </h1>
            <p className="font-mono text-xs text-paper/40 uppercase mt-1.5 tracking-widest truncate">
              {eventName} // {gate}
            </p>
          </div>

          {/* Live usher counter */}
          {counter !== null && (
            <div className="shrink-0 text-right">
              <p className="font-display text-3xl text-signal leading-none tabular-nums">
                {counter.eventTotal}
                {counter.totalSeats > 0 && (
                  <span className="text-paper/30 text-xl">/{counter.totalSeats}</span>
                )}
              </p>
              <p className="font-mono text-[8px] uppercase tracking-widest text-paper/30 mt-0.5">
                THIS GATE: {counter.gateTotal}
              </p>
              {/* Thin capacity bar */}
              {counter.totalSeats > 0 && (
                <div className="w-20 h-0.5 bg-ink mt-1.5 ml-auto">
                  <div
                    className="h-full bg-signal transition-all duration-700"
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual search trigger */}
        <button
          onClick={openSearch}
          className="mt-3 w-full flex items-center gap-2 px-3 py-2 bg-ink border border-paper/10 text-paper/40 font-mono text-xs uppercase tracking-widest hover:border-signal/40 hover:text-paper/70 transition-colors"
          aria-label="Search guest by name"
        >
          <Search className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>SEARCH GUEST NAME...</span>
        </button>
      </header>

      {/* ── Camera Viewport ──────────────────────────────────────── */}
      <main className="flex-1 relative flex items-center justify-center bg-void">
        <div className="relative w-72 h-72">
          {/* Brutalist Corner Brackets */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-[3px] border-l-[3px] border-signal z-20" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-[3px] border-r-[3px] border-signal z-20" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-[3px] border-l-[3px] border-signal z-20" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-[3px] border-r-[3px] border-signal z-20" />

          {/* QR Reader Surface */}
          <div id="qr-reader" className="w-full h-full overflow-hidden grayscale contrast-125 opacity-60" />

          {!scanning && !processing && (
            <div className="absolute inset-0 flex items-center justify-center bg-void/80 z-10">
              <Button variant="signal" onClick={startScanner}>INITIALIZE CAMERA</Button>
            </div>
          )}
        </div>
      </main>

      {/* ── Party Size Selector Overlay ─────────────────────────── */}
      {pendingSelection && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-void border-t-4 border-signal p-6 animate-in slide-in-from-bottom duration-150">
          <div className="flex flex-col gap-4">
            <header className="text-center">
              <p className="font-mono text-[10px] uppercase text-signal tracking-[0.2em] mb-1">GROUP_DETECTION</p>
              <h2 className="font-display text-3xl uppercase text-paper leading-none">{pendingSelection.guestName}</h2>
              <p className="font-mono text-xs text-paper/40 mt-1">REMAINING: {pendingSelection.remaining} OF {pendingSelection.partySize}</p>
            </header>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <button
                  key={num}
                  onClick={() => setSelectedCount(num)}
                  disabled={num > pendingSelection.remaining}
                  className={cn(
                    "h-14 font-display text-2xl border-2 transition-none flex items-center justify-center",
                    selectedCount === num
                      ? "bg-signal border-signal text-void"
                      : num > pendingSelection.remaining
                        ? "bg-ink border-ink text-paper/10"
                        : "bg-transparent border-ink text-paper hover:border-signal/50"
                  )}
                >
                  {num}
                </button>
              ))}
            </div>

            <Button
              variant="signal"
              className="w-full h-16 text-2xl mt-2"
              onClick={() => confirmAdmission(pendingSelection.invitationId, selectedCount)}
            >
              ADMIT {selectedCount} GUESTS
            </Button>
          </div>
        </div>
      )}

      {/* ── Manual Name Search Panel ─────────────────────────────── */}
      {searchOpen && (
        <div className="absolute inset-0 z-50 bg-void flex flex-col animate-in fade-in duration-100">
          {/* Search header */}
          <div className="p-4 pt-10 border-b-2 border-ink shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-ink border-2 border-signal px-3 py-2">
                <Search className="h-4 w-4 text-signal shrink-0" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Type guest name..."
                  className="flex-1 bg-transparent font-mono text-sm text-paper placeholder:text-paper/30 outline-none uppercase tracking-wide"
                  aria-label="Search guest by name"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} aria-label="Clear search">
                    <X className="h-4 w-4 text-paper/40 hover:text-paper transition-colors" />
                  </button>
                )}
              </div>
              <button
                onClick={closeSearch}
                className="font-mono text-[10px] uppercase tracking-widest text-paper/40 hover:text-paper transition-colors whitespace-nowrap"
                aria-label="Close search"
              >
                CANCEL
              </button>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-paper/30 mt-2 pl-1">
              USE WHEN QR CODE IS DAMAGED OR UNAVAILABLE
            </p>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center justify-center py-16">
                <p className="font-mono text-xs uppercase tracking-widest text-paper/40 animate-pulse">SEARCHING...</p>
              </div>
            )}

            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Users className="h-10 w-10 text-paper/20" aria-hidden="true" />
                <p className="font-mono text-xs uppercase tracking-widest text-paper/40">NO GUESTS FOUND</p>
                <p className="font-mono text-[9px] text-paper/20 uppercase tracking-widest">Check spelling or use the QR code</p>
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <div className="flex flex-col divide-y divide-ink">
                {searchResults.map((r) => (
                  <button
                    key={r.invitationId}
                    onClick={() => processScan(r.invitationId)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-ink transition-colors text-left active:bg-signal/20"
                    aria-label={`Admit ${r.guestName}`}
                  >
                    <div className="min-w-0">
                      <p className="font-display text-xl uppercase text-paper leading-tight truncate">{r.guestName}</p>
                      <div className="flex gap-3 mt-0.5">
                        {r.seatInfo && (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-paper/40">{r.seatInfo}</span>
                        )}
                        {r.phone && (
                          <span className="font-mono text-[9px] text-paper/30">{r.phone}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 ml-4 text-right">
                      <span className="font-display text-2xl text-signal">+{r.partySize}</span>
                      <p className="font-mono text-[8px] uppercase tracking-widest text-paper/30 mt-0.5">TAP TO ADMIT</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searchQuery && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Search className="h-10 w-10 text-paper/10" aria-hidden="true" />
                <p className="font-mono text-xs uppercase tracking-widest text-paper/30">TYPE A NAME TO SEARCH</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status Panel Flood ───────────────────────────────────── */}
      <footer className="shrink-0 min-h-[140px] flex items-stretch border-t-2 border-ink">
        {processing ? (
          <div className="w-full bg-ink flex items-center justify-center animate-pulse">
            <h2 className="font-display text-4xl text-paper/40 tracking-widest uppercase">PROCESSING...</h2>
          </div>
        ) : result ? (
          <div className={cn(
            "w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-75",
            result.status === 'success' ? "bg-admitted" :
            result.status === 'duplicate' ? "bg-signal" : "bg-denied"
          )}>
            <h2 className={cn(
              "font-display text-5xl uppercase leading-none tracking-tight",
              result.status === 'error' ? "text-paper" : "text-void"
            )}>
              {result.status === 'success' ? 'ADMITTED' :
               result.status === 'duplicate' ? 'ALREADY ENTERED' : 'DENIED'}
            </h2>
            <p className={cn(
              "font-mono text-sm uppercase mt-2 font-bold tracking-tight",
              result.status === 'error' ? "text-paper/80" : "text-void/60"
            )}>
              {result.status === 'success' ? result.guestName :
               result.status === 'duplicate' ? `ENTRY_TIME: ${new Date(result.enteredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` :
               result.message}
            </p>
            {result.status === 'success' && result.seatInfo && (
              <p className="font-mono text-xs text-void/40 uppercase tracking-widest mt-1">{result.seatInfo}</p>
            )}
          </div>
        ) : (
          <div className="w-full bg-ink flex items-center justify-center">
            <h2 className="font-display text-4xl text-paper/20 tracking-widest uppercase">READY TO SCAN</h2>
          </div>
        )}
      </footer>
    </div>
  )
}
