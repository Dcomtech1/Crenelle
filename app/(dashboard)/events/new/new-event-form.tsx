'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Globe, Mail } from 'lucide-react'
import { createEvent } from '@/app/actions/events'
import { Button } from '@/components/ui/button'
import { EventBannerInput } from '@/components/event-banner-input'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import type { SenderProfile } from '@/lib/types'

interface NewEventFormProps {
  profiles: Pick<SenderProfile, 'id' | 'display_name' | 'reply_to' | 'is_default'>[]
}

export function NewEventForm({ profiles }: NewEventFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [eventType, setEventType] = useState<'closed' | 'open'>('closed')
  const isSubmitting = useRef(false)

  async function handleSubmit(formData: FormData) {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setLoading(true)
    setError(null)
    const result = await createEvent(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      isSubmitting.current = false
    }
  }

  const defaultProfile = profiles.find((p) => p.is_default)

  return (
    <div className="max-w-2xl">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-foreground/70 hover:text-signal transition-colors mb-8 group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
        Back to Events
      </Link>

      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-2">INITIALIZE_NEW_EVENT</p>
        <h1 className="font-display text-5xl uppercase text-foreground leading-none">Create Event</h1>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/50 mt-3 leading-relaxed border-l-2 border-signal/40 pl-3">
          {eventType === 'closed' ? (
            <>
              New events start as <span className="text-foreground/80">DRAFT</span>.
              Set to <span className="text-foreground/80">PUBLISHED</span> when your guest list is ready,
              then <span className="text-signal">LIVE</span> on event day to open scanning for ushers.
            </>
          ) : (
            <>
              <span className="text-foreground/80">OPEN</span> events generate a public registration link.
              Users sign up, you review and accept who you want.
              Accepted guests receive their QR entry pass via email.
            </>
          )}
        </p>
      </div>

      <form action={handleSubmit} className="brutalist-card flex flex-col gap-6">
        {error && (
          <div role="alert" aria-live="assertive" className="border-2 border-denied bg-denied/10 p-4 font-mono text-sm text-denied uppercase tracking-wide">
            ⚠ {error}
          </div>
        )}

        {/* Event Type Selector */}
        <div className="flex flex-col gap-2">
          <span className={labelCls}>Event Type *</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEventType('closed')}
              className={`flex items-center gap-3 p-4 border-2 transition-all ${
                eventType === 'closed'
                  ? 'border-signal bg-signal/10 text-foreground'
                  : 'border-foreground/20 text-foreground/60 hover:border-foreground/40'
              }`}
            >
              <Lock className={`h-5 w-5 shrink-0 ${eventType === 'closed' ? 'text-signal' : ''}`} />
              <div className="text-left">
                <p className="font-display text-lg uppercase leading-none">Closed</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-foreground/50 mt-1">
                  You build the guest list
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setEventType('open')}
              className={`flex items-center gap-3 p-4 border-2 transition-all ${
                eventType === 'open'
                  ? 'border-signal bg-signal/10 text-foreground'
                  : 'border-foreground/20 text-foreground/60 hover:border-foreground/40'
              }`}
            >
              <Globe className={`h-5 w-5 shrink-0 ${eventType === 'open' ? 'text-signal' : ''}`} />
              <div className="text-left">
                <p className="font-display text-lg uppercase leading-none">Open</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-foreground/50 mt-1">
                  Public sign-up link
                </p>
              </div>
            </button>
          </div>
          <input type="hidden" name="event_type" value={eventType} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="new-ev-name" className={labelCls}>Event Name *</label>
          <input
            id="new-ev-name"
            name="name"
            required
            placeholder="e.g. Amaka & Chidi's Wedding"
            className={fieldCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="new-ev-date" className={labelCls}>Date *</label>
            <input id="new-ev-date" name="date" type="date" required className={fieldCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="new-ev-time" className={labelCls}>Time</label>
            <input id="new-ev-time" name="time" type="time" className={fieldCls} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="new-ev-venue" className={labelCls}>Venue *</label>
          <input
            id="new-ev-venue"
            name="venue"
            required
            placeholder="e.g. Eko Hotels & Suites, Lagos"
            className={fieldCls}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="new-ev-capacity" className={labelCls}>Total Capacity</label>
          <input
            id="new-ev-capacity"
            name="capacity"
            type="number"
            min="1"
            placeholder="e.g. 300"
            className={fieldCls}
          />
          <p className={hintCls}>Maximum number of people allowed in</p>
        </div>

        {/* Open event specific fields */}
        {eventType === 'open' && (
          <div className="flex flex-col gap-4 border-2 border-signal/20 bg-signal/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal font-bold">
              OPEN EVENT SETTINGS
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="new-ev-max-reg" className={labelCls}>Max Registrations</label>
              <input
                id="new-ev-max-reg"
                name="max_registrations"
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                className={fieldCls}
              />
              <p className={hintCls}>Cap on how many people can sign up (leave empty for no limit)</p>
            </div>

            <div className="border-l-4 border-signal/40 pl-3">
              <p className="font-mono text-[9px] text-foreground/60 uppercase tracking-wide leading-relaxed">
                When published, a unique registration link will be generated.
                Share it publicly — users can register without creating an account.
                You&apos;ll review and manually accept or reject each registration.
              </p>
            </div>
          </div>
        )}

        <EventBannerInput />

        {/* ── Sending Identity ── */}
        <div className="flex flex-col gap-2">
          <label htmlFor="new-ev-sender-profile" className={labelCls}>
            Sending Identity
          </label>

          {profiles.length === 0 ? (
            <div className="flex items-center gap-3 border border-dashed border-border px-4 py-3">
              <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <p className="font-sans text-xs text-muted-foreground">
                No sender profiles yet.{' '}
                <a
                  href="/settings/sender-profiles"
                  className="text-copper hover:underline underline-offset-2"
                >
                  Create one in Settings →
                </a>
              </p>
            </div>
          ) : (
            <select
              id="new-ev-sender-profile"
              name="sender_profile_id"
              className={fieldCls}
              defaultValue=""
            >
              <option value="">
                {defaultProfile
                  ? `Default — ${defaultProfile.display_name}`
                  : 'Use account default'}
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.reply_to}){p.is_default ? ' — default' : ''}
                </option>
              ))}
            </select>
          )}
          <p className={hintCls}>
            Which brand or organisation sends emails for this event
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="new-ev-desc" className={labelCls}>Description</label>
          <textarea
            id="new-ev-desc"
            name="description"
            placeholder="Optional notes about the event..."
            rows={3}
            className={`${fieldCls} resize-none`}
          />
        </div>

        <div className="flex gap-3 pt-2 border-t-2 border-foreground/20">
          <Button type="submit" variant="signal" disabled={loading} className="flex-1 h-12 text-sm">
            {loading ? 'CREATING...' : 'CREATE EVENT →'}
          </Button>
          <Link href="/events">
            <Button type="button" variant="ghost" className="h-12 px-6 font-mono text-xs uppercase tracking-widest text-foreground/70 hover:text-foreground border border-foreground/20 hover:border-foreground/50">
              CANCEL
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
