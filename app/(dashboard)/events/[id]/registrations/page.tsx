'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { Check, X, Mail, Search, UserPlus, Clock, CheckCircle2, XCircle, Send, ArrowUpCircle } from 'lucide-react'
import { acceptRegistration, rejectRegistration, promoteFromWaitlist, sendReminderEmails } from '@/app/actions/registrations'
import { createClient } from '@/lib/supabase/client'
import { fieldCls, labelCls } from '@/lib/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionHeader } from '@/components/section-header'
import { EmptyState } from '@/components/empty-state'
import { toast } from 'sonner'
import type { Event } from '@/lib/types'

interface Registration {
  id: string
  event_id: string
  full_name: string
  email: string
  phone: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'waitlist'
  created_at: string
}

export default function RegistrationsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'waitlist'>('all')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [sendingReminder, setSendingReminder] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState<Registration | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Registration | null>(null)

  async function loadData() {
    const supabase = createClient()
    const [{ data: attendees }, { data: ev }] = await Promise.all([
      supabase
        .from('attendees')
        .select('*')
        .eq('event_id', eventId)
        .eq('source', 'public_registration')
        .order('created_at', { ascending: true }),
      supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single(),
    ])

    const mappedRegs = (attendees ?? []).map((a: any) => ({
      id: a.id,
      event_id: a.event_id,
      full_name: a.name,
      email: a.email,
      phone: a.phone,
      status: a.registration_status,
      created_at: a.created_at,
    }))

    setRegistrations(mappedRegs as any[])
    setEvent(ev)
  }

  useEffect(() => {
    loadData()

    const poll = setInterval(loadData, 10000)

    const supabase = createClient()
    const channel = supabase
      .channel(`registrations-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees', filter: `event_id=eq.${eventId}` }, () => loadData())
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [eventId])

  function handleAccept(reg: Registration) {
    setAcceptTarget(reg)
  }

  function handleReject(reg: Registration) {
    setRejectTarget(reg)
  }

  async function confirmAccept() {
    if (!acceptTarget) return
    startTransition(async () => {
      const result = await acceptRegistration(acceptTarget.id, eventId)
      if (result?.error) toast.error(result.error)
      else toast.success(`${acceptTarget.full_name} accepted — invitation email sent`)
      setAcceptTarget(null)
      loadData()
    })
  }

  async function confirmReject() {
    if (!rejectTarget) return
    startTransition(async () => {
      const result = await rejectRegistration(rejectTarget.id, eventId)
      if (result?.error) toast.error(result.error)
      else toast.success(`${rejectTarget.full_name} rejected`)
      setRejectTarget(null)
      loadData()
    })
  }

  async function handleSendReminder() {
    setSendingReminder(true)
    const result = await sendReminderEmails(eventId, reminderMessage)
    if (result?.error) {
      toast.error(result.error)
    } else {
      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success(`Reminder sent to ${result.count} guest${result.count !== 1 ? 's' : ''}`)
      }
      setReminderOpen(false)
      setReminderMessage('')
    }
    setSendingReminder(false)
  }

  // Filter + search
  const filtered = registrations
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => {
      if (!search) return true
      const s = search.toLowerCase()
      return r.full_name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s)
    })

  const counts = {
    pending: registrations.filter(r => r.status === 'pending').length,
    accepted: registrations.filter(r => r.status === 'accepted').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
    waitlist: registrations.filter(r => r.status === 'waitlist').length,
  }

  // Copy registration link
  function copyRegistrationLink() {
    if (!event?.registration_slug) return
    navigator.clipboard.writeText(`${window.location.origin}/register/${event.registration_slug}`)
    toast.success('Registration link copied')
  }

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      pending: 'bg-signal/20 text-signal border-signal/30',
      accepted: 'bg-admitted/20 text-admitted border-admitted/30',
      rejected: 'bg-denied/20 text-denied border-denied/30',
      waitlist: 'bg-foreground/10 text-foreground/60 border-foreground/20',
    }
    return cls[status] ?? ''
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b-2 border-foreground/10 pb-6">
        <SectionHeader
          eyebrow="PUBLIC_REGISTRATIONS"
          title="Registrations"
          subtitle={`${counts.pending} pending · ${counts.accepted} accepted · ${counts.rejected} rejected · ${counts.waitlist} waitlist`}
        />

        <div className="flex gap-2 shrink-0">
          {/* Send Reminder */}
          <Button
            variant="ghost"
            className="gap-2 h-12 px-5 text-sm font-mono uppercase tracking-widest text-foreground/70 hover:text-foreground border border-foreground/20 hover:border-foreground/50"
            onClick={() => setReminderOpen(true)}
          >
            <Mail className="h-4 w-4" />
            SEND_REMINDER
          </Button>

          {/* Copy registration link */}
          {event?.registration_slug && (
            <Button
              variant="signal"
              className="gap-2 h-12 px-5 text-sm"
              onClick={copyRegistrationLink}
            >
              <UserPlus className="h-4 w-4" />
              COPY_LINK
            </Button>
          )}
        </div>
      </div>

      {/* Registration link info */}
      {event?.registration_slug && (
        <div className="border-l-4 border-signal p-4 bg-signal/5 mb-6">
          <p className="font-mono text-[10px] text-foreground/50 uppercase tracking-widest mb-1">
            PUBLIC REGISTRATION LINK
          </p>
          <p className="font-mono text-xs text-signal break-all">
            {typeof window !== 'undefined' && `${window.location.origin}/register/${event.registration_slug}`}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-0 border-2 border-foreground/20 overflow-hidden">
          {(['all', 'pending', 'accepted', 'rejected', 'waitlist'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-[10px] uppercase tracking-widest px-4 py-2.5 transition-colors ${
                filter === f
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground/60 hover:text-foreground'
              }`}
            >
              {f === 'all' ? `ALL (${registrations.length})` : `${f} (${counts[f]})`}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border-2 border-foreground/20 text-foreground font-mono text-xs px-4 py-2.5 pl-9 placeholder:text-foreground/30 focus:outline-none focus:border-signal transition-colors"
          />
        </div>
      </div>

      {/* Registrations list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-10 w-10" />}
          title="NO_REGISTRATIONS"
          subtitle={filter !== 'all' ? `No ${filter} registrations` : 'No one has registered yet'}
        />
      ) : (
        <div className="border-2 border-foreground/10 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] bg-secondary border-b-2 border-foreground/20 px-4 py-3 gap-4">
            {['NAME', 'EMAIL / PHONE', 'STATUS', 'DATE', ''].map((h) => (
              <span key={h} className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/60">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((reg) => (
            <div
              key={reg.id}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center px-4 py-4 gap-4 border-b border-foreground/5 hover:bg-foreground/2 transition-colors group"
            >
              <span className="font-mono text-sm text-foreground font-medium truncate">{reg.full_name}</span>
              <div className="flex flex-col">
                <span className="font-mono text-xs text-foreground/60 truncate">{reg.email}</span>
                {reg.phone && <span className="font-mono text-[10px] text-foreground/40 truncate">{reg.phone}</span>}
              </div>
              <span
                className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1 border ${statusBadge(reg.status)}`}
              >
                {reg.status}
              </span>
              <span className="font-mono text-[10px] text-foreground/40 whitespace-nowrap">
                {new Date(reg.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
              <div className="flex gap-1">
                {reg.status === 'pending' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-admitted/60 hover:text-admitted hover:bg-admitted/10 transition-all"
                      onClick={() => handleAccept(reg)}
                      aria-label={`Accept ${reg.full_name}`}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-denied/40 hover:text-denied hover:bg-denied/10 transition-all"
                      onClick={() => handleReject(reg)}
                      aria-label={`Reject ${reg.full_name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {reg.status === 'waitlist' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-signal/60 hover:text-signal hover:bg-signal/10 transition-all"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await promoteFromWaitlist(reg.id, eventId)
                        if (result?.error) toast.error(result.error)
                        else { toast.success(`${reg.full_name} moved to pending`); loadData() }
                      })
                    }}
                    aria-label={`Promote ${reg.full_name} from waitlist`}
                    title="Promote to pending"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                  </Button>
                )}
                {reg.status === 'accepted' && (
                  <CheckCircle2 className="h-4 w-4 text-admitted/60" />
                )}
                {reg.status === 'rejected' && (
                  <XCircle className="h-4 w-4 text-denied/40" />
                )}
                {reg.status === 'waitlist' && counts.waitlist > 0 && (
                  <Clock className="h-4 w-4 text-foreground/30" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accept Confirmation Dialog */}
      <ConfirmDialog
        open={!!acceptTarget}
        onOpenChange={(open) => !open && setAcceptTarget(null)}
        title="ACCEPT_REGISTRATION"
        description="CONFIRM_ACCEPTANCE"
        subject={acceptTarget?.full_name}
        subjectLabel="REGISTRANT"
        body={`Accepting will create a guest entry, generate a QR code, and send an invitation email to ${acceptTarget?.email ?? 'their email'}.`}
        confirmLabel="ACCEPT & SEND INVITE"
        isPending={isPending}
        onConfirm={confirmAccept}
      />

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="REJECT_REGISTRATION"
        description="THIS_ACTION_IS_IRREVERSIBLE"
        subject={rejectTarget?.full_name}
        subjectLabel="REGISTRANT"
        body="This person will not receive an invitation. You can revisit this later if needed."
        confirmLabel="REJECT_REGISTRATION"
        isPending={isPending}
        onConfirm={confirmReject}
      />

      {/* Reminder Dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="bg-background border-2 border-foreground/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase text-foreground">Send Reminder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 mt-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/60 leading-relaxed">
              Send a reminder email to all {counts.accepted} confirmed guests.
              Each email will include event details and their QR entry pass.
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="reminder-msg" className={labelCls}>Custom Message (optional)</label>
              <textarea
                id="reminder-msg"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="e.g. We can't wait to see you! Don't forget to bring your ID..."
                rows={4}
                className={`${fieldCls} resize-none`}
              />
            </div>

            <div className="border-l-4 border-signal p-3 bg-signal/5">
              <p className="font-mono text-[10px] text-foreground/60 uppercase tracking-wide">
                <span className="text-signal font-bold">NOTE:</span> This will send an email to {counts.accepted} confirmed guest{counts.accepted !== 1 ? 's' : ''} immediately.
              </p>
            </div>

            <Button
              variant="signal"
              className="w-full h-12 text-sm gap-2"
              disabled={sendingReminder || counts.accepted === 0}
              onClick={handleSendReminder}
            >
              <Send className="h-4 w-4" />
              {sendingReminder ? 'SENDING...' : `SEND TO ${counts.accepted} GUESTS →`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
