'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Pencil, X, Users } from 'lucide-react'
import { addGuest, updateGuest, deleteGuest, addMultipleGuests } from '@/app/actions/guests'
import { createClient } from '@/lib/supabase/client'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionHeader } from '@/components/section-header'
import { EmptyState } from '@/components/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { Invitation, Guest } from '@/lib/types'

type GuestWithInvitation = Guest & { invitation: Invitation | null }

export default function GuestsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [guests, setGuests] = useState<GuestWithInvitation[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editGuest, setEditGuest] = useState<GuestWithInvitation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GuestWithInvitation | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  async function loadGuests() {
    const supabase = createClient()
    const { data } = await supabase
      .from('guests')
      .select('*, invitation:invitations(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    setGuests((data as any[])?.map(g => ({ ...g, invitation: g.invitation?.[0] ?? null })) ?? [])
  }

  useEffect(() => {
    const supabase = createClient()

    loadGuests()

    // Poll every 10s as a reliable fallback
    const poll = setInterval(loadGuests, 10000)

    const channel = supabase
      .channel(`guests-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests',      filter: `event_id=eq.${eventId}` }, () => loadGuests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `event_id=eq.${eventId}` }, () => loadGuests())
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [eventId])

  async function handleAdd(formData: FormData) {
    startTransition(async () => {
      const result = await addGuest(eventId, formData)
      if (result?.error) toast.error(result.error)
      else { toast.success('Guest added'); setAddOpen(false); loadGuests() }
    })
  }

  async function handleBulkAdd(emailsText: string, partySize: number) {
    startTransition(async () => {
      const result = await addMultipleGuests(eventId, emailsText, partySize)
      if (result?.error) toast.error(result.error)
      else {
        if (result?.warning) {
          toast.warning(result.warning)
        } else {
          toast.success(`Successfully imported ${result?.count} guest(s)`)
        }
        setAddOpen(false)
        loadGuests()
      }
    })
  }

  async function handleUpdate(formData: FormData) {
    if (!editGuest) return
    startTransition(async () => {
      const result = await updateGuest(editGuest.id, eventId, formData)
      if (result?.error) toast.error(result.error)
      else { toast.success('Guest updated'); setEditGuest(null); loadGuests() }
    })
  }

  const totalSeats = guests.reduce((a, g) => a + (g.invitation?.party_size ?? 1), 0)

  return (
    <div>
      {/* Section header + Add button */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b-2 border-foreground/10 pb-6">
        <SectionHeader
          eyebrow="GUEST_MANIFEST"
          title="Guest List"
          subtitle={`${guests.length} guest${guests.length !== 1 ? 's' : ''} · ${totalSeats} total seats`}
        />

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="signal" className="gap-2 h-12 px-6 text-sm shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" />
              ADD_GUEST
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background border-2 border-foreground/20 max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-3xl uppercase text-foreground">Add Guests</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="single" className="w-full mt-2">
              <TabsList variant="line" className="border-b-2 border-foreground/10 w-full justify-start mb-4">
                <TabsTrigger value="single" className="font-mono text-xs uppercase tracking-widest px-4 py-2 border-b-2 border-transparent data-[state=active]:border-signal">
                  Single Guest
                </TabsTrigger>
                <TabsTrigger value="bulk" className="font-mono text-xs uppercase tracking-widest px-4 py-2 border-b-2 border-transparent data-[state=active]:border-signal">
                  Multiple Guests
                </TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="mt-0">
                <GuestForm onSubmit={handleAdd} loading={isPending} prefix="add" />
              </TabsContent>
              <TabsContent value="bulk" className="mt-0">
                <BulkGuestForm onSubmit={handleBulkAdd} loading={isPending} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Guest list */}
      {guests.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="NO_GUESTS_YET"
          subtitle="Add guests to generate their QR entry cards"
        />
      ) : (
        <div className="border-2 border-foreground/10 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] bg-secondary border-b-2 border-foreground/20 px-4 py-3 gap-4">
            {['NAME', 'CONTACT', 'PARTY', 'SEAT', ''].map((h) => (
              <span key={h} className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/60">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {guests.map((guest) => (
            <div
              key={guest.id}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center px-4 py-4 gap-4 border-b border-foreground/5 hover:bg-foreground/2 transition-colors group"
            >
              <span className="font-mono text-sm text-foreground font-medium truncate">{guest.name}</span>
              <span className="font-mono text-xs text-foreground/60 truncate">{guest.phone || guest.email || '—'}</span>
              <span className="font-display text-lg text-signal" aria-label={`Party size: ${guest.invitation?.party_size ?? 1}`}>
                +{guest.invitation?.party_size ?? 1}
              </span>
              <span className="font-mono text-xs text-foreground/60 whitespace-nowrap">{guest.invitation?.seat_info || '—'}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground/20 hover:text-foreground hover:bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setEditGuest(guest)}
                  aria-label={`Edit guest ${guest.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-denied/40 hover:text-denied hover:bg-denied/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteTarget(guest)}
                  aria-label={`Remove guest ${guest.name}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editGuest} onOpenChange={(o) => !o && setEditGuest(null)}>
        <DialogContent className="bg-background border-2 border-foreground/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase text-foreground">Edit Guest</DialogTitle>
          </DialogHeader>
          {editGuest && (
            <GuestForm
              onSubmit={handleUpdate}
              loading={isPending}
              prefix="edit"
              defaultValues={{
                name: editGuest.name,
                phone: editGuest.phone ?? '',
                email: editGuest.email ?? '',
                party_size: editGuest.invitation?.party_size ?? 1,
                seat_info: editGuest.invitation?.seat_info ?? '',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Guest confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="REMOVE_GUEST"
        description="THIS_ACTION_IS_IRREVERSIBLE"
        subject={deleteTarget?.name}
        subjectLabel="TARGET_GUEST"
        body="Removing this guest will delete their invitation and QR code. This cannot be undone."
        confirmLabel="REMOVE_GUEST"
        isPending={isDeleting}
        onConfirm={() => {
          if (!deleteTarget) return
          startDeleteTransition(async () => {
            const result = await deleteGuest(deleteTarget.id, eventId)
            if (result?.error) toast.error(result.error)
            else { toast.success('Guest removed'); loadGuests(); setDeleteTarget(null) }
          })
        }}
      />
    </div>
  )
}

function GuestForm({
  onSubmit,
  loading,
  defaultValues,
  prefix,
}: {
  onSubmit: (f: FormData) => void
  loading: boolean
  prefix: string
  defaultValues?: { name: string; phone: string; email: string; party_size: number; seat_info: string }
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-5 mt-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${prefix}-g-name`} className={labelCls}>Full Name *</label>
        <input id={`${prefix}-g-name`} name="name" defaultValue={defaultValues?.name} placeholder="e.g. Ngozi Okafor" required className={fieldCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${prefix}-g-phone`} className={labelCls}>Phone</label>
          <input id={`${prefix}-g-phone`} name="phone" defaultValue={defaultValues?.phone} placeholder="+234..." className={fieldCls} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${prefix}-g-email`} className={labelCls}>Email</label>
          <input id={`${prefix}-g-email`} name="email" type="email" defaultValue={defaultValues?.email} placeholder="Optional" className={fieldCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${prefix}-g-party`} className={labelCls}>Admits (party size) *</label>
          <input id={`${prefix}-g-party`} name="party_size" type="number" min="1" max="20" defaultValue={defaultValues?.party_size ?? 1} required className={fieldCls} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${prefix}-g-seat`} className={labelCls}>Seat / Table</label>
          <input id={`${prefix}-g-seat`} name="seat_info" defaultValue={defaultValues?.seat_info} placeholder="e.g. Table 5" className={fieldCls} />
        </div>
      </div>

      <Button type="submit" variant="signal" className="w-full h-12 text-sm mt-2" disabled={loading}>
        {loading ? 'SAVING...' : 'SAVE GUEST'}
      </Button>
    </form>
  )
}

function BulkGuestForm({
  onSubmit,
  loading,
}: {
  onSubmit: (emailsText: string, partySize: number) => void
  loading: boolean
}) {
  const [emailsText, setEmailsText] = useState('')
  const [partySize, setPartySize] = useState(1)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emailsText.trim()) {
      toast.error('Please enter at least one email address.')
      return
    }
    onSubmit(emailsText, partySize)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="bulk-emails" className={labelCls}>Guest Emails *</label>
        <textarea
          id="bulk-emails"
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          placeholder="ngozi@example.com&#10;olana@gatekeeper.dev, guest@crenelle.org"
          required
          rows={6}
          className={`${fieldCls} py-3 resize-none font-mono text-xs h-36`}
        />
        <p className="font-mono text-[9px] uppercase tracking-wider text-foreground/40 leading-relaxed">
          Separate multiple email addresses using newlines, commas, or semicolons.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="bulk-party" className={labelCls}>Admits per Guest (party size) *</label>
        <input
          id="bulk-party"
          type="number"
          min="1"
          max="20"
          value={partySize}
          onChange={(e) => setPartySize(Number(e.target.value))}
          required
          className={fieldCls}
        />
        <p className="font-mono text-[9px] uppercase tracking-wider text-foreground/40">
          This party size will be assigned to each guest in the list.
        </p>
      </div>

      <Button type="submit" variant="signal" className="w-full h-12 text-sm mt-2" disabled={loading}>
        {loading ? 'IMPORTING...' : 'SAVE GUESTS'}
      </Button>
    </form>
  )
}
