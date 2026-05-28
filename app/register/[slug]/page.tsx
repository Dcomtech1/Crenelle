'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, MapPin, Clock, CheckCircle2, XCircle, Users } from 'lucide-react'
import { submitRegistration } from '@/app/actions/registrations'
import { getOptimizedBannerUrl } from '@/lib/images'
import { toast } from 'sonner'

interface EventInfo {
  id: string
  name: string
  date: string
  time: string | null
  venue: string
  description: string | null
  status: string
  max_registrations: number | null
  registration_count: number
  banner_url?: string | null
  tiers?: Array<{ id: string; name: string; price: number; currency: string }>
}

export default function PublicRegistrationPage() {
  const { slug } = useParams<{ slug: string }>()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [waitlisted, setWaitlisted] = useState(false)
  const [selectedTierId, setSelectedTierId] = useState('')
  const isSubmitting = useRef(false)

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/register/${slug}`)
        if (!res.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const data = await res.json()
        setEvent(data)
      } catch {
        setNotFound(true)
      }
      setLoading(false)
    }
    loadEvent()
  }, [slug])

  useEffect(() => {
    if (event?.tiers && event.tiers.length > 0) {
      setSelectedTierId(event.tiers[0].id)
    }
  }, [event])

  async function handleSubmit(formData: FormData) {
    if (isSubmitting.current || !event) return

    // Intercept paid tier selections
    const selectedTier = event.tiers?.find((t) => t.id === selectedTierId)
    if (selectedTier && selectedTier.price > 0) {
      toast.info("Online payments are coming soon! Paid registrations are not yet enabled.", { duration: 5000 })
      return
    }

    isSubmitting.current = true
    setSubmitting(true)
    setError(null)

    const result = await submitRegistration(event.id, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
      isSubmitting.current = false
    } else {
      setWaitlisted(!!(result as any)?.waitlisted)
      setSubmitted(true)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-mono text-xs uppercase text-foreground/60 tracking-widest animate-pulse">
          LOADING_EVENT...
        </p>
      </div>
    )
  }

  // Not found
  if (notFound || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-denied mx-auto mb-4" />
          <h1 className="font-display text-4xl uppercase text-foreground mb-2">EVENT NOT FOUND</h1>
          <p className="font-mono text-xs uppercase text-foreground/60 tracking-widest">
            This registration link is invalid or the event is no longer accepting registrations.
          </p>
        </div>
      </div>
    )
  }

  // Registration full
  const isFull = event.max_registrations !== null && event.registration_count >= event.max_registrations

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          {waitlisted ? (
            <div className="border-2 border-signal/30 bg-signal/5 p-8">
              <Clock className="h-16 w-16 text-signal mx-auto mb-6" />
              <h1 className="font-display text-4xl uppercase text-foreground mb-3">ADDED TO WAITLIST</h1>
              <p className="font-mono text-sm text-foreground/70 leading-relaxed mb-6">
                <span className="text-foreground font-bold">{event.name}</span> is currently full.
                You've been added to the waitlist and will be notified if a spot opens up.
              </p>
              <div className="border-t border-foreground/10 pt-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/50 leading-relaxed">
                  The organizer manages the waitlist. If a place becomes available,
                  you'll receive an email with your entry pass QR code.
                </p>
              </div>
            </div>
          ) : (
            <div className="border-2 border-admitted/30 bg-admitted/5 p-8">
              <CheckCircle2 className="h-16 w-16 text-admitted mx-auto mb-6" />
              <h1 className="font-display text-4xl uppercase text-foreground mb-3">REGISTRATION RECEIVED</h1>
              <p className="font-mono text-sm text-foreground/70 leading-relaxed mb-6">
                Your registration for <span className="text-foreground font-bold">{event.name}</span> has been submitted successfully.
              </p>
              <div className="border-t border-foreground/10 pt-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/50 leading-relaxed">
                  The organizer will review your registration.
                  If accepted, you'll receive an email with your entry pass QR code.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {event.banner_url && (
          <div className="border-2 border-foreground/20 border-b-0 aspect-video w-full overflow-hidden bg-void/10 select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getOptimizedBannerUrl(event.banner_url, 'web')}
              alt={`${event.name} banner`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Event header */}
        <div className="border-2 border-foreground/20 p-6 mb-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-2">
            EVENT REGISTRATION
          </p>
          <h1 className="font-display text-5xl uppercase text-foreground leading-none tracking-tight mb-4">
            {event.name}
          </h1>

          <div className="flex flex-col gap-2 mt-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-foreground/50 shrink-0" />
              <span className="font-mono text-sm text-foreground/80">{eventDate}</span>
            </div>
            {event.time && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-foreground/50 shrink-0" />
                <span className="font-mono text-sm text-foreground/80">{event.time.slice(0, 5)}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-foreground/50 shrink-0" />
              <span className="font-mono text-sm text-foreground/80">{event.venue}</span>
            </div>
            {event.max_registrations && (
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-foreground/50 shrink-0" />
                <span className="font-mono text-sm text-foreground/80">
                  {event.registration_count} / {event.max_registrations} spots taken
                </span>
              </div>
            )}
          </div>

          {event.description && (
            <p className="font-mono text-xs text-foreground/60 mt-4 leading-relaxed border-t border-foreground/10 pt-4">
              {event.description}
            </p>
          )}
        </div>

        {/* Registration form */}
        <div className="border-2 border-foreground/20 border-t-0 p-6">
          {isFull ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-signal mx-auto mb-4" />
              <h2 className="font-display text-2xl uppercase text-foreground mb-2">EVENT IS FULL</h2>
              <p className="font-mono text-xs text-foreground/60 uppercase tracking-widest mb-6">
                All spots are taken — but you can join the waitlist.
              </p>

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="border-2 border-denied bg-denied/10 p-4 font-mono text-sm text-denied uppercase tracking-wide mb-4 text-left"
                >
                  ⚠ {error}
                </div>
              )}

              <form action={handleSubmit} className="flex flex-col gap-5 text-left">
                <div className="flex flex-col gap-2">
                  <label htmlFor="wl-name" className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80">Full Name *</label>
                  <input id="wl-name" name="full_name" required placeholder="e.g. Ngozi Okafor"
                    className="w-full bg-background border-2 border-foreground/40 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/40 focus:outline-none focus:border-signal transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="wl-email" className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80">Email Address *</label>
                  <input id="wl-email" name="email" type="email" required placeholder="you@example.com"
                    className="w-full bg-background border-2 border-foreground/40 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/40 focus:outline-none focus:border-signal transition-colors" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full h-14 bg-signal text-void font-display text-2xl uppercase tracking-wider hover:bg-signal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'JOINING...' : 'JOIN WAITLIST →'}
                </button>
              </form>
            </div>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60 mb-6">
                Fill in your details below to register for this event.
                The organizer will review and confirm your spot.
              </p>

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="border-2 border-denied bg-denied/10 p-4 font-mono text-sm text-denied uppercase tracking-wide mb-4"
                >
                  ⚠ {error}
                </div>
              )}

              <form action={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="reg-name"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80"
                  >
                    Full Name *
                  </label>
                  <input
                    id="reg-name"
                    name="full_name"
                    required
                    placeholder="e.g. Ngozi Okafor"
                    className="w-full bg-background border-2 border-foreground/40 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/40 focus:outline-none focus:border-signal transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="reg-email"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80"
                  >
                    Email Address *
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full bg-background border-2 border-foreground/40 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/40 focus:outline-none focus:border-signal transition-colors"
                  />
                  <p className="font-mono text-[9px] text-foreground/40 uppercase tracking-wide">
                    Your invitation and QR entry pass will be sent to this email
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="reg-phone"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80"
                  >
                    Phone Number
                  </label>
                  <input
                    id="reg-phone"
                    name="phone"
                    placeholder="+234..."
                    className="w-full bg-background border-2 border-foreground/40 text-foreground font-mono text-sm px-4 py-3 placeholder:text-foreground/40 focus:outline-none focus:border-signal transition-colors"
                  />
                </div>

                {event.tiers && event.tiers.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="reg-tier"
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80"
                    >
                      Select Ticket Tier *
                    </label>
                    <select
                      id="reg-tier"
                      name="ticket_tier_id"
                      value={selectedTierId}
                      onChange={(e) => setSelectedTierId(e.target.value)}
                      required
                      className="w-full bg-background border-2 border-foreground/40 text-foreground font-mono text-sm px-4 py-3 focus:outline-none focus:border-signal transition-colors"
                    >
                      {event.tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.price === 0 ? '(Free)' : `(₦${(t.price / 100).toLocaleString()})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(() => {
                  const selectedTier = event.tiers?.find((t) => t.id === selectedTierId)
                  const isPaidTier = selectedTier ? selectedTier.price > 0 : false
                  return (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-14 bg-signal text-void font-display text-2xl uppercase tracking-wider hover:bg-signal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {submitting
                        ? 'SUBMITTING...'
                        : isPaidTier
                        ? 'PAY & REGISTER →'
                        : 'REGISTER →'}
                    </button>
                  )
                })()}
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-foreground/30">
            CRENELLE_ENTRY_SYSTEM // SECURE_REGISTRATION
          </p>
        </div>
      </div>
    </div>
  )
}
