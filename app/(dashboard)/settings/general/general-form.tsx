'use client'

import { useState, useTransition } from 'react'
import { Loader2, Globe, Building2, Bell, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import { saveOrganizerSettings } from '@/app/actions/general-settings'
import type { OrganizerSettings, DateFormat, ClockFormat } from '@/lib/types'

// ── Timezone list ────────────────────────────────────────────────
const TIMEZONES = [
  { value: 'Africa/Lagos',       label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Accra',       label: 'Accra (GMT, UTC+0)' },
  { value: 'Africa/Nairobi',     label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Africa/Johannesburg',label: 'Johannesburg (SAST, UTC+2)' },
  { value: 'Africa/Cairo',       label: 'Cairo (EET, UTC+2)' },
  { value: 'Europe/London',      label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',       label: 'Paris (CET/CEST)' },
  { value: 'America/New_York',   label: 'New York (EST/EDT)' },
  { value: 'America/Chicago',    label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles',label: 'Los Angeles (PST/PDT)' },
  { value: 'Asia/Dubai',         label: 'Dubai (GST, UTC+4)' },
  { value: 'Asia/Kolkata',       label: 'Mumbai / Delhi (IST, UTC+5:30)' },
  { value: 'Asia/Singapore',     label: 'Singapore (SGT, UTC+8)' },
  { value: 'UTC',                label: 'UTC (Coordinated Universal Time)' },
]

// ── Currency list ────────────────────────────────────────────────
const CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
]

interface Props {
  settings: OrganizerSettings | null
}

export function GeneralSettingsForm({ settings }: Props) {
  // ── State — initialised from DB row or defaults ──────────────
  const [orgName,      setOrgName]      = useState(settings?.org_name ?? '')
  const [timezone,     setTimezone]     = useState(settings?.default_timezone  ?? 'Africa/Lagos')
  const [currency,     setCurrency]     = useState(settings?.default_currency  ?? 'NGN')
  const [dateFormat,   setDateFormat]   = useState<DateFormat>(settings?.date_format  ?? 'DD/MM/YYYY')
  const [clockFormat,  setClockFormat]  = useState<ClockFormat>(settings?.clock_format ?? '12h')
  const [emailFooter,  setEmailFooter]  = useState(settings?.email_footer ?? '')

  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    startTransition(async () => {
      const result = await saveOrganizerSettings(new FormData(form))
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('General settings saved.')
      }
    })
  }

  // ── Reusable toggle group ────────────────────────────────────
  function ToggleGroup<T extends string>({
    name,
    value,
    onChange,
    options,
  }: {
    name: string
    value: T
    onChange: (v: T) => void
    options: { value: T; label: string }[]
  }) {
    return (
      <div className="flex flex-wrap gap-px border border-border bg-border">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              'font-mono text-[10px] uppercase tracking-[0.15em] px-4 py-2.5 transition-colors select-none',
              value === opt.value
                ? 'bg-copper text-background'
                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
        {/* Hidden input so FormData picks up the value */}
        <input type="hidden" name={name} value={value} />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-up">

      {/* ── 1. Organisation & Branding ── */}
      <section className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Building2 className="size-4 text-copper" aria-hidden="true" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            Organisation &amp; Branding
          </h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="org-name" className={labelCls}>
              Organisation name
            </label>
            <input
              id="org-name"
              name="org_name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Events Ltd"
              maxLength={120}
              className={fieldCls}
            />
            <p className={hintCls}>
              Used as the master brand across all events, emails, and reports.
            </p>
          </div>

          <div className="p-4 border border-border/40 bg-muted/30 flex items-start gap-3">
            <Zap className="size-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wide leading-relaxed">
              Custom domain support (e.g.&nbsp;
              <span className="text-muted-foreground">tickets.yourdomain.com</span>)
              is planned for a future release.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. Localisation & Regional Defaults ── */}
      <section className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Globe className="size-4 text-copper" aria-hidden="true" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            Localisation &amp; Regional Defaults
          </h2>
        </div>
        <div className="px-6 py-6 space-y-6">

          {/* Timezone */}
          <div className="flex flex-col gap-2">
            <label htmlFor="default-timezone" className={labelCls}>
              Default timezone
            </label>
            <select
              id="default-timezone"
              name="default_timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={fieldCls}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className={hintCls}>
              Applied to ticket sale start/end times and scheduled email sends.
            </p>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-2">
            <label htmlFor="default-currency" className={labelCls}>
              Default currency
            </label>
            <select
              id="default-currency"
              name="default_currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={fieldCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className={hintCls}>
              Pre-filled when creating paid ticket tiers. Can be overridden per event.
            </p>
          </div>

          {/* Date format */}
          <div className="flex flex-col gap-3">
            <span className={labelCls}>Date format</span>
            <ToggleGroup<DateFormat>
              name="date_format"
              value={dateFormat}
              onChange={setDateFormat}
              options={[
                { value: 'DD/MM/YYYY', label: 'DD / MM / YYYY' },
                { value: 'MM/DD/YYYY', label: 'MM / DD / YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              ]}
            />
            <p className={hintCls}>
              Controls how event dates are rendered on tickets and guest-facing pages.
            </p>
          </div>

          {/* Clock format */}
          <div className="flex flex-col gap-3">
            <span className={labelCls}>Clock format</span>
            <ToggleGroup<ClockFormat>
              name="clock_format"
              value={clockFormat}
              onChange={setClockFormat}
              options={[
                { value: '12h', label: '12-hour  (9:00 AM)' },
                { value: '24h', label: '24-hour  (21:00)' },
              ]}
            />
          </div>

        </div>
      </section>

      {/* ── 3. Global Notification Preferences ── */}
      <section className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Bell className="size-4 text-copper" aria-hidden="true" />
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground">
            Global Notification Preferences
          </h2>
        </div>
        <div className="px-6 py-6 space-y-6">

          {/* Email footer */}
          <div className="flex flex-col gap-2">
            <label htmlFor="email-footer" className={labelCls}>
              Global email footer
            </label>
            <textarea
              id="email-footer"
              name="email_footer"
              value={emailFooter}
              onChange={(e) => setEmailFooter(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="e.g. Acme Events Ltd · 12 Marina Street, Lagos · events@acme.com"
              className={[fieldCls, 'resize-y min-h-[96px]'].join(' ')}
            />
            <div className="flex items-center justify-between">
              <p className={hintCls}>
                Plain text appended to the bottom of every invitation and reminder email sent to guests.
                <br />
                <span className="text-copper/80">
                  This is different from sender profiles — it controls the email body, not the From: header.
                </span>
              </p>
              <span
                className={[
                  'font-mono text-[10px] shrink-0 ml-4',
                  emailFooter.length > 450 ? 'text-copper' : 'text-muted-foreground/50',
                ].join(' ')}
              >
                {emailFooter.length}/500
              </span>
            </div>
          </div>

          {/* Organizer digests — deferred */}
          <div className="p-4 border border-border/40 bg-muted/30 flex items-start gap-3">
            <Zap className="size-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wide leading-relaxed">
              Organizer digest emails (daily / weekly summaries) are planned for a future release.
            </p>
          </div>

        </div>
      </section>

      {/* ── 4. Integrations & Webhooks — coming soon ── */}
      <section className="border border-border/40 bg-card opacity-60">
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="size-4 text-muted-foreground/50" aria-hidden="true" />
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/70">
              Integrations &amp; Webhooks
            </h2>
          </div>
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] border border-border/40 text-muted-foreground/40 px-2 py-0.5">
            Coming Soon
          </span>
        </div>
        <div className="px-6 py-6 space-y-4 pointer-events-none select-none">
          {[
            { title: 'API Access Keys', desc: 'Create and revoke tokens for external scanner scripts and integrations.' },
            { title: 'Webhooks', desc: 'Post to your own URL on events like registration.created or ticket.scanned.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 opacity-50">
              <div className="w-1 h-4 bg-border shrink-0 mt-0.5" />
              <div>
                <p className="font-sans text-xs font-semibold text-foreground/60">{item.title}</p>
                <p className="font-sans text-[11px] text-muted-foreground/50 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Save button ── */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-foreground text-background font-sans text-xs font-semibold uppercase tracking-[0.14em] px-8 py-3.5 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          Save settings
        </button>
        <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wide">
          Changes apply to new events only.
        </p>
      </div>

    </form>
  )
}
