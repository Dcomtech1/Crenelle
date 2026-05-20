'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

export default function ScannerClient({
  token,
  gate,
  eventName,
}: {
  token: string
  gate: string
  eventName: string
  eventDate: string
  eventVenue: string
}) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [selectedCount, setSelectedCount] = useState(1)
  const [processing, setProcessing] = useState(false)
  const scannerRef = useRef<any>(null)
  const lastScannedRef = useRef<string>('')
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
        setResult({ status: 'error', message: data.error ?? 'INVALID CODE' })
        autoReset()
      }
    } catch {
      setResult({ status: 'error', message: 'NETWORK FAILURE' })
      autoReset()
    }

    setProcessing(false)
  }

  async function confirmAdmission(invitationId: string, count: number) {
    setProcessing(true)
    setPendingSelection(null)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, scannerToken: token, count }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({
          status: 'success',
          guestName: data.guest?.name ?? 'Unknown',
          partySize: data.partySize,
          enteredCount: data.enteredCount,
          admittedNow: data.admittedNow,
          seatInfo: data.seatInfo,
        })
      } else {
        setResult({ status: 'error', message: data.error ?? 'ADMISSION FAILED' })
      }
    } catch {
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

  return (
    <div className="fixed inset-0 flex flex-col bg-void text-paper overflow-hidden select-none">
      {/* Top Bar */}
      <header className="p-6 pt-10 shrink-0 border-b-2 border-ink">
        <h1 className="font-display text-4xl tracking-[0.3em] leading-none text-paper uppercase">
          CRENELLE
        </h1>
        <p className="font-mono text-xs text-paper/40 uppercase mt-2 tracking-widest">
          {eventName} // {gate}
        </p>
      </header>

      {/* Camera Viewport */}
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

      {/* Party Size Selector Overlay */}
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

      {/* Status Panel Flood */}
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

