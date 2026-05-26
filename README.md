# Crenelle — Physical Access Credential Infrastructure

> The layer between *who is authorised to be here* and *proof they were here.*

Crenelle is a QR-based access control and guest management platform. It lets event organisers and institutions issue verifiable digital credentials to members or guests, deploy scanner links to checkpoints, and maintain a real-time audit log of everyone who enters — with zero hardware required.

**Starting point:** Events (corporate, private, social).  
**Bigger picture:** The access credential layer for African organisations — churches, universities, corporate campuses, associations, estates.

---

## What It Does

### For Organisers / Administrators
- Create **closed events** (invite-only, curated guest list) or **open events** (public registration with approval workflow)
- Add guests individually or in bulk — set party size, seat assignment, and status
- Issue personalised **QR entry passes** via email (with event banner, event details, and one-click unsubscribe)
- Send **reminders** to all confirmed guests with optional custom message
- Create **scanner links** per checkpoint/entrance — shareable over WhatsApp, no login required for ushers
- Manage **sender profiles** (branded From: name and reply-to per event or organisation)
- Monitor **real-time attendance** and registration stats from the dashboard
- **Invite co-hosts** with granular permissions — Viewer, Scanner Manager, or Co-Organiser — each receiving an automated email notification

### For Ushers / Checkpoint Staff
- Open a scanner link on any smartphone browser — no app download, no login
- Point camera at a guest's QR code → instant ✅ GREEN (admitted) or ❌ RED (denied) with reason
- Party-size tracking: admit 1–N members per QR code; DB-level trigger prevents race conditions

### For Guests / Members
- Receive a personalised email with the event details and their unique QR entry pass
- Present the QR code (phone or printed) at the entrance
- Register for open events via a public URL (`/register/:slug`) — organiser approves or rejects

---

## The Bigger Vision

Strip this down to first principles and the core loop is:

```
Authorise → Credential → Verify → Log
```

This is not an "event" problem. It is a **physical identity and access control problem** that every organisation in Nigeria — and Africa broadly — solves manually, badly, and at scale.

| What we call it now | What it really is |
|---------------------|-------------------|
| Event | Any recurring access programme (weekly service, exam session, site visit) |
| Guest | Member, student, contractor, patient, resident |
| Invitation | A verifiable credential — proof of entitlement to enter |
| Scanner Link | A checkpoint — gate, entrance, desk, ward |
| Entry Log | A presence record — attendance, audit trail |

**The current codebase is already 70% of the way to owning this at scale.** See [`ARCHITECTURE.md §19`](./ARCHITECTURE.md) for the full strategic breakdown.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Database + Auth** | Supabase (PostgreSQL + RLS + Realtime) |
| **Styling** | Tailwind CSS 4 + Radix UI + shadcn/ui |
| **Email** | Resend (transactional — invitations + reminders) |
| **QR Generation** | `qrcode` (npm) — inline in emails |
| **QR Scanning** | `html5-qrcode` — browser camera, no app required |
| **File Storage** | Supabase Storage (event banner images) |
| **Forms** | `react-hook-form` + `zod` |
| **Notifications** | `sonner` (toast) |
| **Hosting** | Vercel (recommended) |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` (or create `.env.local`) and fill in:

```env
# Supabase — required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend — required for email
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# App URL — used in QR code links inside emails
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Admin dashboard — comma-separated email addresses
ADMIN_EMAILS=admin@yourdomain.com
```

> `SUPABASE_SERVICE_ROLE_KEY` is **never** exposed to the browser. It is only used in server-side API routes and server actions.

### 3. Run all database migrations

In your **Supabase Dashboard → SQL Editor**, run each migration file in order:

```
supabase/migrations/
  001_initial_schema.sql               ← Core tables + RLS
  002_allow_multiple_entries.sql       ← Party-size entry support
  003_event_status_lifecycle.sql       ← draft / published / live / ended
  004_enforce_entry_limit_trigger.sql  ← Race-condition DB trigger
  005_open_events.sql                  ← Public registration + registrations table
  006_email_logs.sql                   ← Email audit log
  007_add_event_banner.sql             ← Event banner images
  008_cleanup_orphaned_banners.sql
  009_drop_orphaned_banners_trigger.sql
  010_scan_errors.sql                  ← Scan error audit table
  011_sender_profiles.sql              ← Multi-brand email sender profiles
  012_email_unsubscribe.sql            ← CAN-SPAM / GDPR unsubscribe tokens
  013_registration_cap_and_waitlist.sql ← DB-enforced cap + waitlist routing
  014_fix_unsubscribe_default.sql      ← Fix unsubscribed_at default (bug fix)
  015_team_access.sql                  ← event_members table + co-host RLS
  016_add_co_organiser_role.sql        ← co_organiser role tier
```

### 4. Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
crenelle/
├── app/
│   ├── layout.tsx                 # Root layout — ThemeProvider, Sonner
│   ├── page.tsx                   # Landing page
│   ├── globals.css                # Design tokens + global styles
│   │
│   ├── (auth)/                    # Login + Signup
│   │   ├── login/
│   │   └── signup/
│   │
│   ├── (dashboard)/               # Organiser portal (auth-guarded)
│   │   ├── events/
│   │   │   ├── page.tsx           # Events list + stats + co-hosting section
│   │   │   ├── new/               # Create event form
│   │   │   └── [id]/              # Event detail hub
│   │   │       ├── page.tsx       # Overview + edit + reminder email
│   │   │       ├── guests/        # Guest list + invite flow (role-gated)
│   │   │       ├── registrations/ # Accept / reject queue (open events)
│   │   │       ├── cards/         # QR invitation cards / passes
│   │   │       ├── scanner-links/ # Usher checkpoint management (role-gated)
│   │   │       ├── dashboard/     # Live attendance analytics
│   │   │       └── team/          # Co-host management (owner only)
│   │   └── settings/
│   │       └── sender-profiles/   # Email sender brand config
│   │
│   ├── (admin)/                   # Hidden platform admin (email-gated)
│   │   └── admin/                 # Aggregate stats — no guest data
│   │
│   ├── register/[slug]/           # Public event registration form
│   ├── scan/[token]/              # Usher QR scanner (no login)
│   │
│   ├── actions/                   # Next.js Server Actions
│   │   ├── auth.ts
│   │   ├── events.ts
│   │   ├── guests.ts
│   │   ├── registrations.ts
│   │   ├── scanner-links.ts
│   │   ├── sender-profiles.ts
│   │   └── team.ts                # Co-host invite / remove / role update
│   │
│   └── api/
│       ├── scan/route.ts          # POST — validate QR + record entry
│       ├── send-email/route.ts    # POST — dispatch invitation / reminder
│       ├── register/[slug]/route.ts  # GET — public event info by slug
│       ├── unsubscribe/route.ts   # GET/POST — one-click email opt-out
│       └── admin/stats/route.ts   # GET — platform stats (polled 30s)
│
├── components/
│   ├── ui/                        # Radix / shadcn primitives
│   ├── scanner/                   # QR camera scanner component
│   ├── event-card.tsx
│   ├── event-banner-input.tsx
│   ├── status-change-dialog.tsx
│   └── ...
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Supabase client (SSR cookies)
│   │   ├── admin.ts               # Service-role client (bypasses RLS)
│   │   └── admin-stats.ts         # Aggregate platform stats fetcher
│   ├── email.ts                   # Email templates + Resend dispatch
│   ├── images.ts                  # Banner URL helpers
│   ├── rate-limit.ts              # In-process sliding-window rate limiter
│   ├── team-access.ts             # getEventAccess() — role resolution helper
│   ├── types.ts                   # TypeScript interfaces
│   └── validations/               # Zod schemas
│
└── supabase/
    └── migrations/                # Ordered SQL migrations (run in sequence)
```

---

## Database Schema

9 tables, all with Row Level Security enabled. Organisers can only read/write their own data. The admin service-role key bypasses RLS only for aggregate stats — no personal data is exposed.

```
events ──────────────── guests ─────── invitations ─── entry_logs
   │                       │
   ├── scanner_links        └── (guest_id FK)
   ├── registrations
   ├── email_logs
   ├── sender_profiles
   └── event_members          (co-host team access — role per member)

email_unsubscribes        (opt-out list — admin-only access)
scan_errors               (error audit — admin-only access)
```

---

## Security Model

| Surface | Mechanism |
|---------|-----------|
| Organiser dashboard | Supabase Auth session (SSR cookie via `@supabase/ssr`) |
| Admin dashboard | Organiser auth + email in `ADMIN_EMAILS` env var |
| Scanner pages | Token-in-URL — validated server-side on every scan |
| Public register pages | Rate-limited: 10/IP/15min + 3/email/hour (in-process) |
| `/api/scan` | Admin client — explicit security logic; no RLS dependency |
| `/api/send-email` | Requires valid session; RLS-scoped event fetch |
| `/api/unsubscribe` | Token-only — 48-char hex, no session required (CAN-SPAM) |
| Co-host event access | RLS policies on `event_members` — members can only read events they are invited to; mutations gated by role |

**Race condition protection:** A PostgreSQL trigger (`004_enforce_entry_limit_trigger.sql`) blocks concurrent scans that would exceed `party_size`. Works at the DB level — the API catches the error and returns a clean 409.

**Email compliance:** Every outbound email includes a one-click unsubscribe link. The `/api/unsubscribe` endpoint processes opt-outs without requiring login (CAN-SPAM / GDPR requirement). All future sends check the `email_unsubscribes` table before dispatching.

---

## Deployment

### Vercel (recommended)

```bash
# 1. Push to GitHub
git push origin main

# 2. Connect repo to Vercel at vercel.com/new

# 3. Add environment variables in Vercel → Settings → Environment Variables
#    (all variables listed in the Quick Start section above)

# 4. Deploy — Vercel auto-detects Next.js, no build config needed
```

### Supabase Storage

Create a public bucket named **`banners`** in your Supabase project:
> Storage → New bucket → Name: `banners` → Public: ✅

---

## Architecture Reference

For the complete technical breakdown — data model, flowcharts, security model, AI integration plans, payment gateway analysis, navigation audit, and the strategic vision for scaling beyond events — see:

**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**

Key sections:
- §3 — High-level architecture flowchart
- §5 — Full entity relationship diagram
- §6 — Data flow diagrams (event lifecycle, QR check-in, email, registration)
- §16 — AI integration opportunities
- §17 — Payment gateway analysis (Paystack vs Stripe for Nigerian market)
- §18 — Navigation UX audit
- §19 — The bigger vision: physical access infrastructure for Africa

---

## Roadmap

**Completed**
- [x] Rate limiting on public registration (IP + email-based)
- [x] Email unsubscribe / opt-out (CAN-SPAM / GDPR)
- [x] Registration cap enforced at DB level (trigger)
- [x] Waitlist for over-capacity open events
- [x] Bulk email guest import
- [x] Multi-entrance live analytics (per-gate breakdown)
- [x] Manual name search on scanner page
- [x] Audio feedback on scan (admit / deny tones)
- [x] Live usher counter (gate total + event total)
- [x] **Team access / co-host collaboration** — Viewer, Scanner Manager, Co-Organiser roles with RLS enforcement and invite email

**Next**
- [ ] Active tab indicator in event sub-navigation
- [ ] Paystack payment integration (ticketed events)
- [ ] PWA offline scanner mode
- [ ] AI guest list parsing (paste → structured rows)
- [ ] Recurring event series (weekly programmes)
- [ ] WhatsApp credential delivery
- [ ] Custom email domain per organiser (Resend custom domain)

---

*Built on Next.js 16 · Supabase · Resend · Tailwind CSS*
