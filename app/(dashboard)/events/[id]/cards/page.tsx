'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Printer, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import QRCode from 'qrcode'
import type { Guest, Invitation, Event } from '@/lib/types'

type CardData = {
  guest: Guest
  invitation: Invitation
  qrDataUrl: string
}

export default function CardsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [cards, setCards] = useState<CardData[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: ev }, { data: guests }] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('guests').select('*, invitation:invitations(*)').eq('event_id', eventId).order('name'),
      ])

      setEvent(ev)

      const cardList: CardData[] = []
      for (const g of (guests ?? []) as any[]) {
        const invitation = g.invitation?.[0]
        if (!invitation) continue
        const qrDataUrl = await QRCode.toDataURL(invitation.id, {
          width: 256,
          margin: 1,
          color: { dark: '#0A0A0A', light: '#F0EDE8' },
        })
        cardList.push({ guest: g, invitation, qrDataUrl })
      }

      setCards(cardList)
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) return (
    <div className="font-mono text-xs uppercase text-foreground/60 tracking-widest py-12 text-center animate-pulse">
      GENERATING_QR_CODES...
    </div>
  )

  if (cards.length === 0) {
    return (
      <div className="py-20 border-2 border-dashed border-foreground/20 flex flex-col items-center justify-center text-center">
        <QrCode className="h-10 w-10 text-foreground/20 mb-4" aria-hidden="true" />
        <p className="font-display text-2xl uppercase text-foreground/50 mb-1">NO_GUESTS_ADDED_YET</p>
        <p className="font-mono text-xs text-foreground/50 uppercase tracking-widest">
          Add guests first, then return here to generate their QR entry cards
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 border-b-2 border-foreground/10 pb-6 print:hidden">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-1">QR_PASS_MANIFEST</p>
          <h2 className="font-display text-4xl uppercase text-foreground leading-none">QR Passes</h2>
          <p className="font-mono text-xs text-foreground/70 uppercase tracking-widest mt-2">
            {cards.length} pass{cards.length !== 1 ? 'es' : ''} ready to print
          </p>
        </div>
        <Button
          onClick={() => window.print()}
          variant="signal"
          className="gap-2 h-12 px-6 text-sm shrink-0"
          aria-label="Print all QR passes"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          PRINT_ALL_PASSES
        </Button>
      </div>

      <p className="font-mono text-[10px] text-foreground/60 uppercase tracking-widest mb-6 print:hidden">
        Tip: Use browser Print dialog → Save as PDF → Enable "Background graphics" for best results.
      </p>

      {/* Print grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-2 print:gap-3">
        {cards.map(({ guest, invitation, qrDataUrl }) => (
          <EntryCard
            key={invitation.id}
            eventName={event?.name ?? ''}
            guestName={guest.name}
            partySize={invitation.party_size}
            seatInfo={invitation.seat_info}
            qrDataUrl={qrDataUrl}
          />
        ))}
      </div>
    </div>
  )
}

function EntryCard({
  eventName,
  guestName,
  partySize,
  seatInfo,
  qrDataUrl,
}: {
  eventName: string
  guestName: string
  partySize: number
  seatInfo: string | null
  qrDataUrl: string
}) {
  return (
    <div
      className="border-2 border-foreground/20 bg-background p-5 flex flex-col items-center text-center print:break-inside-avoid"
      role="article"
      aria-label={`Entry card for ${guestName}`}
    >
      {/* Event name */}
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/60 mb-3">{eventName}</p>

      {/* Dashed separator */}
      <div className="w-full border-t border-dashed border-foreground/10 mb-3" aria-hidden="true" />

      {/* QR Code */}
      <img
        src={qrDataUrl}
        alt={`QR code for ${guestName}`}
        className="w-28 h-28 mb-4 border-2 border-foreground/10"
      />

      {/* Dashed separator */}
      <div className="w-full border-t border-dashed border-foreground/10 mb-3" aria-hidden="true" />

      {/* Guest name */}
      <p className="font-display text-2xl uppercase text-foreground leading-tight">{guestName}</p>

      {/* Party size */}
      <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/70 mt-2">
        ADMITS <span className="text-signal font-bold">{partySize}</span> {partySize === 1 ? 'PERSON' : 'PEOPLE'}
      </p>

      {/* Seat info */}
      {seatInfo && (
        <div className="mt-3 border border-signal/30 px-3 py-1">
          <p className="font-mono text-[9px] uppercase tracking-widest text-signal">{seatInfo}</p>
        </div>
      )}
    </div>
  )
}
