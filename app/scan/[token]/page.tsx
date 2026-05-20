import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ScannerClient from '@/components/scanner/ScannerClient'

export default async function ScannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  // Validate the scanner token server-side; also join the event to check its status
  const { data: scannerLink } = await supabase
    .from('scanner_links')
    .select('id, label, event_id, is_active, event:events(name, date, venue, status)')
    .eq('token', token)
    .single()

  if (!scannerLink) notFound()

  const event = scannerLink.event as any
  const eventStatus: string = event?.status ?? 'draft'

  // --- Link deactivated by organiser ---
  if (!scannerLink.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void p-6">
        <div className="text-center text-paper max-w-sm">
          <p className="font-display text-8xl mb-6 opacity-40">🔒</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/40 mb-2">ACCESS_REVOKED</p>
          <h1 className="font-display text-4xl uppercase text-paper leading-none mb-4">Link Deactivated</h1>
          <p className="font-mono text-xs text-paper/50 uppercase tracking-wide leading-relaxed">
            This scanner link has been deactivated by the organiser.
            Contact them to re-enable access.
          </p>
        </div>
      </div>
    )
  }

  // --- Event not yet live (draft or published) ---
  if (eventStatus === 'draft' || eventStatus === 'published') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void p-6">
        <div className="text-center text-paper max-w-sm">
          <p className="font-display text-8xl mb-6 opacity-40">⏳</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-2">STANDBY_MODE</p>
          <h1 className="font-display text-4xl uppercase text-paper leading-none mb-4">Not Yet Open</h1>
          <p className="font-mono text-xs text-paper/50 uppercase tracking-wide leading-relaxed">
            Scanning for{' '}
            <span className="text-paper/80">{event?.name}</span>{' '}
            has not opened yet. The organiser will set the event to{' '}
            <span className="text-signal">LIVE</span> when admission begins.
          </p>
          <div className="mt-8 border border-signal/20 bg-signal/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-signal/70">
              Stand by — this page will work once the event goes live.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- Event has ended ---
  if (eventStatus === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void p-6">
        <div className="text-center text-paper max-w-sm">
          <p className="font-display text-8xl mb-6 opacity-40">🏁</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-denied/60 mb-2">EVENT_CLOSED</p>
          <h1 className="font-display text-4xl uppercase text-paper leading-none mb-4">Event Ended</h1>
          <p className="font-mono text-xs text-paper/50 uppercase tracking-wide leading-relaxed">
            <span className="text-paper/80">{event?.name}</span> has concluded.
            This scanner link is no longer active. No further admissions can be recorded.
          </p>
        </div>
      </div>
    )
  }

  // --- Event is live — show scanner ---
  return (
    <ScannerClient
      token={token}
      gate={scannerLink.label}
      eventName={event?.name ?? ''}
      eventDate={event?.date ?? ''}
      eventVenue={event?.venue ?? ''}
    />
  )
}
