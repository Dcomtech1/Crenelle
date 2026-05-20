'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, MapPin, Clock, CheckCircle2, XCircle, Users } from 'lucide-react'
import { submitRegistration } from '@/app/actions/registrations'

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
}

export default function PublicRegistrationPage() {
  const { slug } = useParams<{ slug: string }>()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
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

  async function handleSubmit(formData: FormData) {
    if (isSubmitting.current || !event) return
    isSubmitting.current = true
    setSubmitting(true)
    setError(null)

    const result = await submitRegistration(event.id, formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
      isSubmitting.current = false
    } else {
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
              <XCircle className="h-10 w-10 text-denied mx-auto mb-4" />
              <h2 className="font-display text-2xl uppercase text-foreground mb-2">REGISTRATION FULL</h2>
              <p className="font-mono text-xs text-foreground/60 uppercase tracking-widest">
                All available spots have been taken.
              </p>
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 bg-signal text-void font-display text-2xl uppercase tracking-wider hover:bg-signal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {submitting ? 'SUBMITTING...' : 'REGISTER →'}
                </button>
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
