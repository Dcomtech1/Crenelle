'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pencil, Trash2, Save, X, Copy, Lock, Globe, Mail, Send, Image as ImageIcon } from 'lucide-react'
import { updateEvent, deleteEvent } from '@/app/actions/events'
import { sendReminderEmails } from '@/app/actions/registrations'
import { Button } from '@/components/ui/button'
import { DeleteEventDialog } from '@/components/delete-event-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { fieldCls, labelCls } from '@/lib/form-styles'
import { toast } from 'sonner'
import type { Event } from '@/lib/types'
import { EventBannerInput } from '@/components/event-banner-input'
import { getOptimizedBannerUrl } from '@/lib/images'

export default function EventOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editEventType, setEditEventType] = useState<'closed' | 'open'>('closed')
  const isSubmitting = useRef(false)

  // Reminder dialog state
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [sendingReminder, setSendingReminder] = useState(false)

  // Registration counts for open events
  const [regCounts, setRegCounts] = useState({ pending: 0, accepted: 0, rejected: 0 })

  useEffect(() => {
    const supabase = createClient()

    async function loadEvent() {
      const { data } = await supabase.from('events').select('*').eq('id', id).single()
      if (data) {
        setEvent(data)
        setEditEventType(data.event_type || 'closed')
      }
    }

    async function loadRegCounts() {
      const { data } = await supabase
        .from('registrations')
        .select('status')
        .eq('event_id', id)
      if (data) {
        setRegCounts({
          pending: data.filter(r => r.status === 'pending').length,
          accepted: data.filter(r => r.status === 'accepted').length,
          rejected: data.filter(r => r.status === 'rejected').length,
        })
      }
    }

    loadEvent()
    loadRegCounts()

    // Poll every 10s — guarantees status badge updates without Supabase Realtime
    const poll = setInterval(() => { loadEvent(); loadRegCounts() }, 10000)

    const channel = supabase
      .channel(`event-detail-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, () => loadEvent())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${id}` }, () => loadRegCounts())
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [id])

  if (!event) return (
    <div className="font-mono text-xs uppercase text-foreground/60 tracking-widest py-12 text-center animate-pulse">
      LOADING_EVENT_DATA...
    </div>
  )

  async function handleUpdate(formData: FormData) {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setLoading(true)
    const result = await updateEvent(id, formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setEditing(false)
      router.refresh()
    }
    setLoading(false)
    isSubmitting.current = false
  }

  function handleDelete() {
    setDeleteOpen(true)
  }

  function copyRegistrationLink() {
    if (!event?.registration_slug) return
    navigator.clipboard.writeText(`${window.location.origin}/register/${event.registration_slug}`)
    toast.success('Registration link copied')
  }

  async function handleSendReminder() {
    setSendingReminder(true)
    const result = await sendReminderEmails(id, reminderMessage)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`Reminder sent to ${result.count} guests`)
      setReminderOpen(false)
      setReminderMessage('')
    }
    setSendingReminder(false)
  }

  const statusColors: Record<string, string> = {
    live:      'status-admitted',
    published: 'status-pending',
    draft:     'bg-foreground/10 text-foreground/60 px-4 py-1',
    ended:     'status-denied',
  }

  if (editing) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-2">EDITING_EVENT</p>
          <h2 className="font-display text-4xl uppercase text-foreground leading-none">Edit Details</h2>
        </div>

        <form action={handleUpdate} className="brutalist-card flex flex-col gap-6">
          {error && (
            <div role="alert" aria-live="assertive" className="border-2 border-denied bg-denied/10 p-4 font-mono text-sm text-denied uppercase tracking-wide">
              ⚠ {error}
            </div>
          )}

          {/* Event Type */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Event Type</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditEventType('closed')}
                className={`flex items-center gap-3 p-3 border-2 transition-all ${
                  editEventType === 'closed'
                    ? 'border-signal bg-signal/10 text-foreground'
                    : 'border-foreground/20 text-foreground/60 hover:border-foreground/40'
                }`}
              >
                <Lock className={`h-4 w-4 shrink-0 ${editEventType === 'closed' ? 'text-signal' : ''}`} />
                <span className="font-display text-lg uppercase leading-none">Closed</span>
              </button>
              <button
                type="button"
                onClick={() => setEditEventType('open')}
                className={`flex items-center gap-3 p-3 border-2 transition-all ${
                  editEventType === 'open'
                    ? 'border-signal bg-signal/10 text-foreground'
                    : 'border-foreground/20 text-foreground/60 hover:border-foreground/40'
                }`}
              >
                <Globe className={`h-4 w-4 shrink-0 ${editEventType === 'open' ? 'text-signal' : ''}`} />
                <span className="font-display text-lg uppercase leading-none">Open</span>
              </button>
            </div>
            <input type="hidden" name="event_type" value={editEventType} />
            {event.registration_slug && editEventType === 'open' && (
              <input type="hidden" name="registration_slug" value={event.registration_slug} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ev-name" className={labelCls}>Event Name *</label>
            <input id="ev-name" name="name" defaultValue={event.name} required className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-date" className={labelCls}>Date *</label>
              <input id="ev-date" name="date" type="date" defaultValue={event.date} required className={fieldCls} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-time" className={labelCls}>Time</label>
              <input id="ev-time" name="time" type="time" defaultValue={event.time ?? ''} className={fieldCls} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ev-venue" className={labelCls}>Venue *</label>
            <input id="ev-venue" name="venue" defaultValue={event.venue} required className={fieldCls} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ev-capacity" className={labelCls}>Capacity</label>
            <input id="ev-capacity" name="capacity" type="number" min="1" defaultValue={event.capacity ?? ''} className={fieldCls} />
          </div>

          {editEventType === 'open' && (
            <div className="flex flex-col gap-2">
              <label htmlFor="ev-max-reg" className={labelCls}>Max Registrations</label>
              <input
                id="ev-max-reg"
                name="max_registrations"
                type="number"
                min="1"
                defaultValue={event.max_registrations ?? ''}
                placeholder="Leave empty for unlimited"
                className={fieldCls}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="ev-status" className={labelCls}>Status</label>
            <select
              id="ev-status"
              name="status"
              defaultValue={event.status}
              className={`${fieldCls} appearance-none cursor-pointer`}
            >
              <option value="draft">Draft — being set up, scanning closed</option>
              <option value="published">Published — ready, scanning closed</option>
              <option value="live">Live — scanning open for ushers</option>
              <option value="ended">Ended — event over, scanning blocked</option>
            </select>
          </div>

          <EventBannerInput defaultValue={event.banner_url} />

          <div className="flex flex-col gap-2">
            <label htmlFor="ev-desc" className={labelCls}>Description</label>
            <textarea
              id="ev-desc"
              name="description"
              defaultValue={event.description ?? ''}
              rows={3}
              className={`${fieldCls} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-2 border-t-2 border-foreground/10">
            <Button type="submit" variant="signal" disabled={loading} className="gap-2 h-12 px-6 text-sm">
              <Save className="h-4 w-4" aria-hidden="true" />
              {loading ? 'SAVING...' : 'SAVE CHANGES'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} className="gap-2 h-12 px-6 text-sm text-foreground/70 hover:text-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
              CANCEL
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-6">
        <div className="brutalist-card">
        {/* Card header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-foreground/20">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">EVENT_DETAILS</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReminderOpen(true)}
              className="gap-2 font-mono text-xs uppercase tracking-widest text-foreground/70 hover:text-foreground border border-foreground/20 hover:border-foreground/50 h-9 px-4"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Remind
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-2 font-mono text-xs uppercase tracking-widest text-foreground/70 hover:text-foreground border border-foreground/20 hover:border-foreground/50 h-9 px-4"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="gap-2 font-mono text-xs uppercase tracking-widest text-denied/60 hover:text-denied border border-denied/20 hover:border-denied/50 h-9 px-4"
              aria-label={`Delete event ${event.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        {/* Data rows */}
        <dl className="flex flex-col gap-6">
          <Row label="EVENT_NAME" value={<span className="font-display text-3xl text-foreground uppercase">{event.name}</span>} />
          <Row
            label="EVENT_TYPE"
            value={
              <span className="inline-flex items-center gap-2">
                {event.event_type === 'open' ? <Globe className="h-4 w-4 text-signal" /> : <Lock className="h-4 w-4 text-foreground/60" />}
                <span className={`font-display text-lg uppercase ${event.event_type === 'open' ? 'text-signal' : ''}`}>
                  {event.event_type}
                </span>
              </span>
            }
          />
          <Row label="DATE" value={new Date(event.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()} />
          {event.time && <Row label="TIME" value={event.time.slice(0, 5)} />}
          <Row label="VENUE" value={event.venue} />
          {event.capacity && <Row label="CAPACITY" value={`${event.capacity} people`} />}
          <Row
            label="STATUS"
            value={
              <span
                className={`inline-block px-4 py-1 font-display text-lg uppercase ${statusColors[event.status] ?? ''}`}
                aria-label={`Status: ${event.status}`}
              >
                {event.status}
              </span>
            }
          />
          {event.description && <Row label="DESCRIPTION" value={event.description} />}
        </dl>
      </div>

      {/* Registration link for open events */}
      {event.event_type === 'open' && event.registration_slug && (
        <div className="brutalist-card">
          <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-foreground/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal">REGISTRATION_LINK</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyRegistrationLink}
              className="gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground/50 hover:text-foreground border border-foreground/10 hover:border-foreground/30 h-8 px-3"
            >
              <Copy className="h-3 w-3" />
              COPY
            </Button>
          </div>
          <p className="font-mono text-xs text-foreground/70 break-all mb-4">
            {typeof window !== 'undefined' && `${window.location.origin}/register/${event.registration_slug}`}
          </p>

          {/* Registration stats */}
          <div className="grid grid-cols-3 gap-px bg-foreground/10">
            <div className="bg-background p-3 text-center">
              <p className="font-display text-2xl text-signal">{regCounts.pending}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-foreground/50">Pending</p>
            </div>
            <div className="bg-background p-3 text-center">
              <p className="font-display text-2xl text-admitted">{regCounts.accepted}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-foreground/50">Accepted</p>
            </div>
            <div className="bg-background p-3 text-center">
              <p className="font-display text-2xl text-denied">{regCounts.rejected}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-foreground/50">Rejected</p>
            </div>
          </div>

          {event.max_registrations && (
            <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mt-3">
              Registration cap: {event.max_registrations} total
            </p>
          )}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteEventDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        eventName={event?.name}
        isPending={isPending}
        onConfirm={() => {
          startTransition(async () => {
            await deleteEvent(id)
            setDeleteOpen(false)
          })
        }}
      />

      {/* ── Reminder Dialog ── */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="bg-background border-2 border-foreground/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase text-foreground">Send Reminder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 mt-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/60 leading-relaxed">
              Send a reminder email with event details and QR entry pass to all confirmed guests.
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="overview-reminder-msg" className={labelCls}>Custom Message (optional)</label>
              <textarea
                id="overview-reminder-msg"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="e.g. We can't wait to see you! Remember to arrive by 4pm..."
                rows={4}
                className={`${fieldCls} resize-none`}
              />
            </div>

            <Button
              variant="signal"
              className="w-full h-12 text-sm gap-2"
              disabled={sendingReminder}
              onClick={handleSendReminder}
            >
              <Send className="h-4 w-4" />
              {sendingReminder ? 'SENDING...' : 'SEND REMINDERS →'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div> {/* End Left Column */}

      {/* Right Column (Banner frame) */}
      <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8 space-y-6 print:hidden">
        <div className="brutalist-card p-0 overflow-hidden group">
          <div className="border-b-2 border-foreground/20 p-4 bg-foreground/5">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">EVENT_BANNER // ATTACHMENT</p>
          </div>
          {event.banner_url ? (
            <div className="aspect-video w-full overflow-hidden bg-void/50 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getOptimizedBannerUrl(event.banner_url, 'web')}
                alt={`${event.name} Banner`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border-dashed border-2 border-foreground/15 m-6 p-6 text-center select-none bg-void/5">
              <ImageIcon className="h-8 w-8 text-foreground/30 mb-2" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/50 font-bold">
                NO_BANNER_ATTACHED
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wide text-foreground/40 mt-2 max-w-[220px] leading-relaxed">
                Click Edit above to upload a banner for emails and event pages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-6">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/70 sm:w-36 shrink-0 mb-1 sm:mb-0 sm:pt-1">
        {label}
      </dt>
      <dd className="font-mono text-sm text-foreground leading-relaxed">
        {value}
      </dd>
    </div>
  )
}
