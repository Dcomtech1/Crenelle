'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Pencil, X, Users, Lock } from 'lucide-react'
import { addAttendee, updateAttendee, cancelAttendeeInvitation, addMultipleAttendees } from '@/app/actions/attendees'
import { createClient } from '@/lib/supabase/client'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionHeader } from '@/components/section-header'
import { EmptyState } from '@/components/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { Invitation, Attendee, TicketTier } from '@/lib/types'

type GuestWithInvitation = Attendee & {
  invitation: (Invitation & { ticket_tier?: TicketTier | null }) | null
}

export default function GuestsPageClient({ canEdit }: { canEdit: boolean }) {
  const { id: eventId } = useParams<{ id: string }>()
  const [guests, setGuests] = useState<GuestWithInvitation[]>([])
  const [tiers, setTiers] = useState<any[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editGuest, setEditGuest] = useState<GuestWithInvitation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GuestWithInvitation | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function loadGuests() {
    const supabase = createClient()
    const { data } = await supabase
      .from('attendees')
      .select('*, invitations(*, ticket_tier:ticket_tiers(*))')
      .eq('event_id', eventId)
      .in('source', ['imported', 'manual'])
      .order('created_at', { ascending: true })
    setGuests((data as any[])?.map(g => ({ ...g, invitation: g.invitations?.[0] ?? null })) ?? [])
  }

  async function loadTiers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('ticket_tiers')
      .select('*')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setTiers(data ?? [])
  }

  useEffect(() => {
    const supabase = createClient()

    loadGuests()
    loadTiers()

    const poll = setInterval(() => { loadGuests(); loadTiers() }, 10000)

    const channel = supabase
      .channel(`guests-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees',   filter: `event_id=eq.${eventId}` }, () => loadGuests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `event_id=eq.${eventId}` }, () => loadGuests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_tiers', filter: `event_id=eq.${eventId}` }, () => loadTiers())
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [eventId])

  async function handleAdd(formData: FormData) {
    setIsSaving(true)
    try {
      const result = await addAttendee(eventId, formData)
      if (result?.error) {
        toast.error(result.error)
      } else if (result?.warning) {
        toast.warning(result.warning, { duration: 6000 })
        setAddOpen(false)
        await loadGuests()
      } else {
        toast.success('Guest added')
        setAddOpen(false)
        await loadGuests()
      }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBulkAdd(emailsText: string, partySize: number) {
    setIsSaving(true)
    try {
      const result = await addMultipleAttendees(eventId, emailsText, partySize)
      if (result?.error) toast.error(result.error)
      else {
        if (result?.warning) {
          toast.warning(result.warning)
        } else {
          toast.success(`Successfully imported ${result?.count} guest(s)`)
        }
        setAddOpen(false)
        await loadGuests()
      }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(formData: FormData) {
    if (!editGuest) return
    setIsSaving(true)
    try {
      const result = await updateAttendee(editGuest.id, eventId, formData)
      if (result?.error) toast.error(result.error)
      else { toast.success('Guest updated'); setEditGuest(null); await loadGuests() }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred')
    } finally {
      setIsSaving(false)
    }
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

        {canEdit ? (
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
                  <GuestForm onSubmit={handleAdd} loading={isSaving} prefix="add" tiers={tiers} />
                </TabsContent>
                <TabsContent value="bulk" className="mt-0">
                  <BulkGuestForm onSubmit={handleBulkAdd} loading={isSaving} />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        ) : (
          /* Read-only indicator for co-hosts */
          <span className="inline-flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border border-border px-3 py-2">
            <Lock className="h-3 w-3" aria-hidden="true" />
            READ-ONLY
          </span>
        )}
      </div>

      {/* Guest list */}
      {guests.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="NO_GUESTS_YET"
          subtitle="Add guests to generate their QR entry cards"
          action={
            canEdit ? (
              <Button
                variant="signal"
                onClick={() => setAddOpen(true)}
                className="gap-2 h-11 px-5 text-xs font-mono tracking-widest uppercase"
              >
                <Plus className="h-3.5 w-3.5" />
                ADD_YOUR_FIRST_GUEST
              </Button>
            ) : null
          }
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
              <div className="flex flex-col truncate">
                <span className="font-mono text-sm text-foreground font-medium truncate">{guest.name}</span>
                {guest.invitation?.ticket_tier?.name && (
                  <span className="inline-block self-start font-mono text-[9px] uppercase tracking-wider bg-foreground/10 text-foreground px-1.5 py-0.5 mt-1 font-semibold">
                    {guest.invitation.ticket_tier.name}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-foreground/60 truncate">{guest.phone || guest.email || '—'}</span>
              <span className="font-display text-lg text-signal" aria-label={`Party size: ${guest.invitation?.party_size ?? 1}`}>
                +{guest.invitation?.party_size ?? 1}
              </span>
              <span className="font-mono text-xs text-foreground/60 whitespace-nowrap">{guest.invitation?.seat_info || '—'}</span>
              {/* Edit/Delete only shown to owners */}
              <div className="flex gap-1">
                {canEdit && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {canEdit && (
        <>
          <Dialog open={!!editGuest} onOpenChange={(o) => !o && setEditGuest(null)}>
            <DialogContent className="bg-background border-2 border-foreground/20 max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-3xl uppercase text-foreground">Edit Guest</DialogTitle>
              </DialogHeader>
              {editGuest && (
                <GuestForm
                  onSubmit={handleUpdate}
                  loading={isSaving}
                  prefix="edit"
                  tiers={tiers}
                  defaultValues={{
                    name: editGuest.name,
                    phone: editGuest.phone ?? '',
                    email: editGuest.email ?? '',
                    party_size: editGuest.invitation?.party_size ?? 1,
                    seat_info: editGuest.invitation?.seat_info ?? '',
                    ticket_tier_id: editGuest.invitation?.ticket_tier_id ?? '',
                  }}
                />
              )}
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            title="CANCEL_INVITATION"
            description="THIS_ACTION_IS_IRREVERSIBLE"
            subject={deleteTarget?.name}
            subjectLabel="TARGET_GUEST"
            body="Cancelling this guest's invitation will invalidate their QR code entry pass. This cannot be undone."
            confirmLabel="CANCEL_INVITATION"
            isPending={isDeleting}
            onConfirm={async () => {
              if (!deleteTarget) return
              setIsDeleting(true)
              try {
                const result = await cancelAttendeeInvitation(deleteTarget.id, eventId)
                if (result?.error) toast.error(result.error)
                else { toast.success('Invitation cancelled'); await loadGuests(); setDeleteTarget(null) }
              } catch (e: any) {
                toast.error(e.message || 'An error occurred')
              } finally {
                setIsDeleting(false)
              }
            }}
          />
        </>
      )}
    </div>
  )
}

function GuestForm({
  onSubmit,
  loading,
  defaultValues,
  prefix,
  tiers,
}: {
  onSubmit: (f: FormData) => void
  loading: boolean
  prefix: string
  defaultValues?: { name: string; phone: string; email: string; party_size: number; seat_info: string; ticket_tier_id?: string | null }
  tiers: any[]
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

      <div className="flex flex-col gap-2">
        <label htmlFor={`${prefix}-g-tier`} className={labelCls}>Ticket Tier</label>
        <select
          id={`${prefix}-g-tier`}
          name="ticket_tier_id"
          defaultValue={defaultValues?.ticket_tier_id ?? ''}
          className={`${fieldCls} appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-size-[0.65rem_auto] bg-position-[right_1rem_center] bg-no-repeat`}
        >
          <option value="">No Tier / Standard</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.price === 0 ? 'Free' : `${(t.price / 100).toLocaleString()} ${t.currency || 'NGN'}`})
            </option>
          ))}
        </select>
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
