# Crenelle — Systems Architecture

> **Codebase:** `crenelle` · **Stack:** Next.js 16 + Supabase + Resend  
> **Last updated:** May 2026 · **Author:** Systems Architect

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture Flowchart](#3-high-level-architecture-flowchart)
4. [Application Layer (Next.js Routes)](#4-application-layer-nextjs-routes)
5. [Data Model (Database Schema)](#5-data-model-database-schema)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
   - [Event Lifecycle](#61-event-lifecycle)
   - [QR Check-In Flow](#62-qr-check-in-flow)
   - [Email Dispatch Flow](#63-email-dispatch-flow)
   - [Public Registration Flow](#64-public-registration-flow)
7. [Security Model](#7-security-model)
8. [Server Actions & API Routes](#8-server-actions--api-routes)
9. [Component Map](#9-component-map)
10. [Database Migrations Log](#10-database-migrations-log)
11. [Environment Variables](#11-environment-variables)
12. [Known Constraints & Edge Cases](#12-known-constraints--edge-cases)
13. [Roadmap / Open Items](#13-roadmap--open-items)

---

## 1. System Overview

**Crenelle** is a B2B event management and access-control platform. It enables event organisers to:

- Create and manage events (closed invite-only or open public registration)
- Build guest lists and generate unique per-guest QR code invitations
- Send personalised invitation and reminder emails (via Resend)
- Deploy scanner links to ushers at the door — no login required for ushers
- Track check-in entry in real-time with party-size enforcement
- Review post-event attendance analytics
- (Platform admins) Monitor aggregate platform health from a hidden admin dashboard

The system is intentionally split into **three distinct user roles**:

| Role | Authentication | Capabilities |
|------|---------------|-------------|
| **Organiser** | Supabase Auth (email/password) | Full CRUD on their events, guests, invitations, scanner links |
| **Usher / Scanner** | Token-in-URL (no login) | Scan QR codes at a specific event entrance via a shareable link |
| **Platform Admin** | Organiser login + `ADMIN_EMAILS` env var | View aggregate platform stats, no guest data access |

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 16 (App Router) | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4 + custom design tokens | Brutalist/mono aesthetic — `font-mono`, `font-display`, `status-*` classes |
| **UI Components** | Radix UI primitives + shadcn/ui | `components/ui/` — Button, Dialog, etc. |
| **Database** | Supabase (PostgreSQL) | RLS enforced on all tables |
| **Auth** | Supabase Auth (SSR cookies via `@supabase/ssr`) | Two clients: `server.ts` (user-scoped) and `admin.ts` (service-role) |
| **Email** | Resend (`resend` SDK v6) | Custom HTML templates in `lib/email.ts` |
| **File Storage** | Supabase Storage (`banners` bucket) | CDN-served event banner images |
| **QR Codes** | `qrcode` (generation) · `html5-qrcode` (scanning) | Invitation ID encoded into QR |
| **Forms** | `react-hook-form` + `zod` | Client-side validation |
| **Toast Notifications** | `sonner` | Globally mounted in root layout |
| **PDF** | `@react-pdf/renderer` | Invitation PDFs (if applicable) |
| **Icons** | `lucide-react` | Throughout the UI |

---

## 3. High-Level Architecture Flowchart

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER / CLIENT                                      │
│                                                                                 │
│  ┌─────────────┐   ┌──────────────────┐   ┌────────────────┐   ┌────────────┐  │
│  │  Auth Pages │   │  Organiser       │   │  Scanner Page  │   │  Public    │  │
│  │  /login     │   │  Dashboard       │   │  /scan/[token] │   │  Register  │  │
│  │  /signup    │   │  /events/**      │   │                │   │  /register/│  │
│  └──────┬──────┘   └────────┬─────────┘   └───────┬────────┘   │  [slug]   │  │
│         │                   │                      │            └─────┬──────┘  │
└─────────┼───────────────────┼──────────────────────┼──────────────────┼─────────┘
          │                   │                      │                  │
          ▼                   ▼                      ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER (App Router)                             │
│                                                                                 │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐    │
│  │  Server Actions  │   │   API Routes     │   │  Server Components (SSR) │    │
│  │  app/actions/    │   │  /api/scan       │   │  (admin page, layouts)   │    │
│  │  - events.ts     │   │  /api/send-email │   └──────────────────────────┘    │
│  │  - guests.ts     │   │  /api/register   │                                   │
│  │  - registrations │   │  /api/admin/stats│                                   │
│  │  - scanner-links │   └────────┬─────────┘                                   │
│  │  - sender-profiles│           │                                              │
│  └────────┬──────────┘           │                                              │
│           │                      │                                              │
└───────────┼──────────────────────┼──────────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE (BaaS)                                      │
│                                                                                 │
│  ┌──────────────┐   ┌──────────────────────────────────────────────────────┐   │
│  │  Auth        │   │  PostgreSQL Database (RLS on all tables)             │   │
│  │  (email/pw)  │   │                                                      │   │
│  └──────────────┘   │  events ─────────┬──── guests ─── invitations       │   │
│                     │                  │                      │            │   │
│  ┌──────────────┐   │  scanner_links ──┘              entry_logs          │   │
│  │  Storage     │   │  registrations                  email_logs          │   │
│  │  (banners    │   │  sender_profiles                scan_errors         │   │
│  │   bucket)    │   │                                                      │   │
│  └──────────────┘   └──────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Realtime (Postgres Changes subscriptions on events + registrations)     │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┬──────────┘
                                                                        │
                                                                        ▼
                                                             ┌──────────────────┐
                                                             │  Resend (Email)  │
                                                             │  - Invitations   │
                                                             │  - Reminders     │
                                                             │  Inline QR + PDF │
                                                             └──────────────────┘
```

---

## 4. Application Layer (Next.js Routes)

### Route Groups & Pages

```
app/
├── layout.tsx                      Root layout — ThemeProvider, Sonner toaster
├── globals.css                     Global CSS & design tokens
├── page.tsx                        Landing / marketing page
│
├── (auth)/                         Auth route group (shared auth layout)
│   ├── layout.tsx
│   ├── login/                      → /login
│   └── signup/                     → /signup
│
├── (dashboard)/                    Organiser route group (auth-guarded layout)
│   ├── layout.tsx                  Sidebar nav + session check
│   ├── events/
│   │   ├── page.tsx                → /events         Event list dashboard
│   │   ├── events-dashboard.tsx    Client component — real-time event cards
│   │   ├── components/             control-bar, events-header, stats-panel
│   │   ├── hooks/                  Custom React hooks
│   │   └── [id]/                   → /events/:id     Event detail hub
│   │       ├── layout.tsx          Sub-nav tabs (Overview · Guests · Registrations · Scanners)
│   │       ├── page.tsx            Overview — edit event, banner, reminder email
│   │       ├── dashboard/          → /events/:id/dashboard  (analytics)
│   │       ├── guests/             → /events/:id/guests     Guest list + invite flow
│   │       ├── registrations/      → /events/:id/registrations  Accept/reject queue
│   │       ├── scanner-links/      → /events/:id/scanner-links  Manage usher links
│   │       └── cards/              → /events/:id/cards  (invitation cards/PDFs)
│   └── settings/                   → /settings       (sender profiles, account)
│
├── (admin)/                        Hidden admin route group
│   └── admin/
│       ├── layout.tsx              Admin layout (email whitelist guard)
│       ├── page.tsx                → /admin  Platform stats dashboard
│       ├── admin-stats-grid.tsx    Live-polling stats component (30s interval)
│       └── local-timestamp.tsx     Client-only timestamp display
│
├── register/
│   └── [slug]/                     → /register/:slug  Public event registration form
│
├── scan/
│   └── [token]/                    → /scan/:token  Usher QR scanner (no auth)
│
└── api/
    ├── scan/route.ts               POST — validate & record QR scan
    ├── send-email/route.ts         POST — dispatch invitation or reminder email
    ├── register/route.ts           POST — submit public registration
    └── admin/
        └── stats/route.ts          GET  — live platform stats (polled by admin dashboard)
```

---

## 5. Data Model (Database Schema)

### Entity Relationship Diagram

```
auth.users (Supabase Auth)
     │
     │ organizer_id (FK)
     ▼
┌─────────────┐        ┌──────────────────┐
│   events    │──1:N──▶│  scanner_links   │
│─────────────│        │──────────────────│
│ id (PK)     │        │ id (PK)          │
│ organizer_id│        │ event_id (FK)    │
│ name        │        │ token (unique)   │
│ date        │        │ label            │
│ time        │        │ is_active        │
│ venue       │        └──────────────────┘
│ description │
│ capacity    │        ┌──────────────────┐
│ status      │──1:N──▶│ registrations    │  ← open events only
│ event_type  │        │──────────────────│
│ reg_slug    │        │ id (PK)          │
│ max_regs    │        │ event_id (FK)    │
│ banner_url  │        │ full_name        │
│ sender_prof │        │ email            │
│ created_at  │        │ phone            │
│ updated_at  │        │ status           │
└──────┬──────┘        └──────────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐        ┌──────────────────┐
│   guests    │──1:1──▶│  invitations     │
│─────────────│        │──────────────────│
│ id (PK)     │        │ id (PK) ← QR ID  │
│ event_id    │        │ event_id (FK)    │
│ name        │        │ guest_id (FK)    │
│ phone       │        │ party_size (1-20)│
│ email       │        │ seat_info        │
│ created_at  │        │ status           │
└─────────────┘        └────────┬─────────┘
                                │
                                │ 1:N
                                ▼
                       ┌──────────────────┐
                       │   entry_logs     │
                       │──────────────────│
                       │ id (PK)          │
                       │ invitation_id    │
                       │ scanner_link_id  │
                       │ scanned_at       │
                       │ notes            │
                       └──────────────────┘

──────────────────────────────────────────

┌──────────────────┐   ┌──────────────────┐
│  sender_profiles │   │   email_logs     │
│──────────────────│   │──────────────────│
│ id (PK)          │   │ id (PK)          │
│ organizer_id     │   │ event_id (FK)    │
│ display_name     │   │ recipient_email  │
│ reply_to         │   │ email_type       │
│ is_default       │   │ subject          │
│ created_at       │   │ sent_at          │
│ updated_at       │   └──────────────────┘
└──────────────────┘

┌──────────────────┐
│   scan_errors    │ ← audit log for failed scan attempts
│──────────────────│
│ id (PK)          │
│ severity         │
│ created_at       │
└──────────────────┘
```

### Event Status Lifecycle

```
  draft ──────▶ published ──────▶ live ──────▶ ended
    │              │                │              │
  Setup         Invites          Scanning        Locked
  in progress   sent out         open            down
                                 for ushers
```

### Event Type

| Type | Registration | Guests added by |
|------|-------------|----------------|
| `closed` | Invite-only | Organiser manually adds guests |
| `open` | Public URL at `/register/:slug` | Guests self-register; organiser approves |

---

## 6. Data Flow Diagrams

### 6.1 Event Lifecycle

```
Organiser
    │
    ├──[1]─▶ Create Event (Server Action: createEvent)
    │          ├─ Inserts into `events` table (status: 'draft')
    │          ├─ Generates registration_slug if event_type = 'open'
    │          └─ Redirects to /events/:id
    │
    ├──[2]─▶ Add Guests → Generate Invitations (Guests tab)
    │          ├─ Server Action: createGuest → insert into `guests`
    │          ├─ Server Action: createInvitation → insert into `invitations`
    │          └─ invitation.id IS the QR code payload
    │
    ├──[3]─▶ Send Invitations (POST /api/send-email)
    │          ├─ Fetches invitation + guest data
    │          ├─ Generates QR code PNG (via `qrcode` npm)
    │          ├─ Builds HTML email (lib/email.ts)
    │          └─ Dispatches via Resend → records in `email_logs`
    │
    ├──[4]─▶ Publish Event (status: 'published')
    │          └─ updateEvent / updateEventStatus Server Action
    │
    ├──[5]─▶ Go Live (status: 'live')
    │          └─ Scanning unlocked for all active scanner_links
    │
    └──[6]─▶ End Event (status: 'ended')
               └─ All scanner links blocked by API
```

### 6.2 QR Check-In Flow

```
Usher at Door
    │
    ├─▶ Opens /scan/:token in browser (no login required)
    │     └─ Page validates token against `scanner_links` table (client-side init)
    │
    ├─▶ Scans guest QR code (html5-qrcode camera stream)
    │     └─ Extracts invitationId (UUID) from QR payload
    │
    └─▶ POST /api/scan  { invitationId, scannerToken, count }
              │
              ├─[1]─ Validate scanner token → `scanner_links` (is_active must be true)
              ├─[2]─ Check event status     → must be 'live'
              ├─[3]─ Fetch invitation       → must belong to same event
              ├─[4]─ Check if cancelled     → block if cancelled
              ├─[5]─ Count existing entry_logs for invitation
              │         if count >= party_size → 409 "Party full"
              ├─[6]─ If checkOnly=true → return preview data (no write)
              ├─[7]─ Insert N rows into `entry_logs`
              │         (DB trigger blocks race conditions exceeding party_size)
              └─▶ Return: { success, guest, partySize, admittedNow, seatInfo }

Usher sees: ✅ GREEN (admitted) or ❌ RED (denied) with reason
```

### 6.3 Email Dispatch Flow

```
Organiser triggers email
    │
    ├── Type: 'invitation'
    │     POST /api/send-email
    │       ├─ Auth check (Supabase session)
    │       ├─ Fetch event via RLS-scoped query
    │       ├─ lib/email.ts → sendInvitationEmail()
    │       │     ├─ Generate QR PNG (base64 data URL)
    │       │     ├─ Build HTML email template (inline styles)
    │       │     └─ resend.emails.send({ from, to, subject, html })
    │       └─ Record in `email_logs` table
    │
    └── Type: 'reminder'
          POST /api/send-email
            ├─ Auth check
            ├─ Fetch event via RLS
            ├─ lib/email.ts → sendReminderEmailsDirect()
            │     ├─ Iterates over recipients array
            │     ├─ Builds reminder HTML (with optional custom message)
            │     └─ Batch dispatches via Resend
            └─ Returns { sent: N, errors: [...] }
```

### 6.4 Public Registration Flow

```
Guest visits /register/:slug
    │
    ├─▶ Page fetches event by slug → shows event info + registration form
    │
    ├─▶ Guest submits form (name, email, phone)
    │     POST /api/register
    │       ├─ Validates slug → finds event
    │       ├─ Checks max_registrations cap (if set)
    │       ├─ Inserts into `registrations` (status: 'pending')
    │       └─ Returns success
    │
    └─▶ Organiser reviews queue at /events/:id/registrations
            ├─ Accept → status: 'accepted'
            │     └─ Server Action: createGuestFromRegistration
            │           ├─ Inserts into `guests`
            │           ├─ Inserts into `invitations`
            │           └─ (Optionally) sends invitation email
            └─ Reject → status: 'rejected'
```

---

## 7. Security Model

### Authentication & Authorisation

| Surface | Mechanism |
|---------|-----------|
| Organiser dashboard | Supabase Auth session cookie (validated server-side via `@supabase/ssr`) |
| Admin dashboard | Organiser auth **+** email must be in `ADMIN_EMAILS` env var |
| Scanner pages | Token-in-URL — validated server-side on every scan request |
| Public register pages | No auth — rate limiting via Supabase (future) |
| API routes (`/api/scan`) | Uses **admin/service-role** client to bypass RLS; all security logic is explicit |
| API routes (`/api/send-email`) | Requires valid session; fetches event via **RLS-scoped** user client |

### Row Level Security (Supabase)

All tables have RLS enabled. Policies enforce:

- **Organisers** can only `SELECT/INSERT/UPDATE/DELETE` rows belonging to events they own (`organizer_id = auth.uid()`)
- **Public** (scanners, guests) can `SELECT` from `scanner_links` (active only) and `invitations`
- **Public** can `INSERT` into `entry_logs` (the API validates intent before inserting)
- **Admin stats API** uses the `service-role` key — bypasses RLS for aggregate-only queries

### Race Condition Protection (QR Scanning)

A **PostgreSQL trigger** (`004_enforce_entry_limit_trigger.sql`) blocks concurrent scans that would exceed `party_size`. If two ushers scan the same QR simultaneously, the DB-level trigger rejects the second insert with `Party limit reached`, which the API catches and returns as a 409.

---

## 8. Server Actions & API Routes

### Server Actions (`app/actions/`)

| File | Exports | Purpose |
|------|---------|---------|
| `events.ts` | `createEvent`, `updateEvent`, `deleteEvent`, `updateEventStatus` | Full event CRUD + banner cleanup |
| `guests.ts` | `createGuest`, `deleteGuest`, `bulkImportGuests` | Guest management |
| `registrations.ts` | `acceptRegistration`, `rejectRegistration`, `sendReminderEmails` | Registration workflow |
| `scanner-links.ts` | `createScannerLink`, `toggleScannerLink`, `deleteScannerLink` | Usher link management |
| `sender-profiles.ts` | `createSenderProfile`, `updateSenderProfile`, `deleteSenderProfile` | Email sender config |
| `auth.ts` | `signOut` | Auth helpers |

### API Routes (`app/api/`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/scan` | `POST` | Token (scanner_link.token) | Validate QR and record entry log |
| `/api/send-email` | `POST` | Session (organiser) | Dispatch invitation or reminder via Resend |
| `/api/register` | `POST` | None (public) | Submit public event registration |
| `/api/admin/stats` | `GET` | Session + admin email check | Return aggregate platform stats |

---

## 9. Component Map

### Shared Components (`components/`)

| Component | Purpose |
|-----------|---------|
| `event-card.tsx` | Summary card for the events list — status badge, quick actions |
| `event-banner-input.tsx` | Upload + preview + remove banner image (Supabase Storage) |
| `status-change-dialog.tsx` | Confirmation dialog for event status transitions |
| `delete-event-dialog.tsx` | Confirm-before-delete dialog |
| `confirm-dialog.tsx` | Generic reusable confirm dialog |
| `stat-card.tsx` | Metric tile used in dashboards |
| `section-header.tsx` | Consistent page section heading |
| `empty-state.tsx` | Empty list / zero-data placeholder |
| `mode-toggle.tsx` | Dark/light theme toggle |
| `theme-provider.tsx` | `next-themes` wrapper |
| `scanner/` | QR scanner UI components |
| `ui/` | Radix/shadcn primitives (Button, Dialog, etc.) |

### Feature-Co-located Components

| Location | Components |
|----------|-----------|
| `app/(dashboard)/events/components/` | `control-bar.tsx`, `events-header.tsx`, `stats-panel.tsx` |
| `app/(admin)/admin/` | `admin-stats-grid.tsx`, `local-timestamp.tsx` |

---

## 10. Database Migrations Log

| # | File | Description |
|---|------|-------------|
| 001 | `001_initial_schema.sql` | Core tables: events, guests, invitations, scanner_links, entry_logs + RLS |
| 002 | `002_allow_multiple_entries.sql` | Relaxed `entry_logs` unique constraint to support party-size (>1) scans |
| 003 | `003_event_status_lifecycle.sql` | Added `published` + `live` status values; renamed `active` |
| 004 | `004_enforce_entry_limit_trigger.sql` | DB trigger to enforce party_size cap under concurrent scans |
| 005 | `005_open_events.sql` | Added `event_type`, `registration_slug`, `max_registrations`, `registrations` table |
| 006 | `006_email_logs.sql` | Email audit log table (`email_logs`) |
| 007 | `007_add_event_banner.sql` | Added `banner_url` column to events |
| 008 | `008_cleanup_orphaned_banners.sql` | Storage cleanup function for orphaned banner files |
| 009 | `009_drop_orphaned_banners_trigger.sql` | Trigger to delete banner file from storage on event delete |
| 010 | `010_scan_errors.sql` | Scan error audit table (`scan_errors`) with severity levels |
| 011 | `011_sender_profiles.sql` | `sender_profiles` table — multi-brand email sender config per organiser |

---

## 11. Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — used by admin client (server-only) |
| `RESEND_API_KEY` | ✅ | Resend API key for email dispatch |
| `RESEND_FROM_EMAIL` | ✅ | Verified sender email address (e.g. `noreply@crenelle.co`) |
| `ADMIN_EMAILS` | ⚠️ | Comma-separated list of admin email addresses |
| `NEXT_PUBLIC_APP_URL` | ⚠️ | Public base URL (used in QR code links) |

---

## 12. Known Constraints & Edge Cases

### Scan Concurrency
- Handled via PostgreSQL trigger (migration 004) — double-scans at the same instant are rejected at DB level
- API surface catches the error message and returns a clean 409 response

### Banner Storage Cleanup
- When an event is updated or deleted, the old banner is removed from Supabase Storage
- The `getStorageFilename()` helper in `actions/events.ts` parses the Supabase URL to extract the filename
- External/non-Supabase URLs are safely ignored

### Event Status Gate on Scanning
- Status must be exactly `'live'` for scanning to succeed
- `'draft'` and `'published'` are pre-event states — ushers get a "not yet open" error
- `'ended'` is locked — ushers get an "event has ended" error

### Open Events — Registration Cap
- `max_registrations` is optional; `null` means unlimited
- Cap is checked at registration time in the API (not enforced at DB level — future improvement)

### Sender Profiles
- One organiser can have multiple sender profiles (e.g., different brands/sub-events)
- `is_default` flag determines which profile pre-populates in the email send flow
- If no profile is configured, the system falls back to `RESEND_FROM_EMAIL`

### Real-time Updates
- Event detail page uses both **Supabase Realtime** (Postgres Changes subscription) and a **10-second polling interval** as belt-and-suspenders
- Admin stats grid polls `/api/admin/stats` every **30 seconds**

---

## 13. Roadmap / Open Items

### ✅ Completed (May 2026)

| Item | Implementation |
|------|---------------|
| ✅ Rate limiting on `/api/register` | IP-based (10/15min) + email-based (3/hr) sliding-window via [`lib/rate-limit.ts`](file:///c:/Users/olana/OneDrive/Documents/crenelle/lib/rate-limit.ts). Applied in `submitRegistration` server action. |
| ✅ Email unsubscribe / opt-out | `email_unsubscribes` table (migration 012), one-click `/api/unsubscribe?token=<hex>` route, token injected into every email footer. Pre-send check in `sendInvitationEmail` and `sendReminderEmailsDirect`. |

---

### 🔵 In-Progress / Planned

| Priority | Item | Notes |
|----------|------|-------|
| 🟡 Medium | Bulk guest CSV import | UI exists but import action needs validation hardening |
| 🟡 Medium | Registration cap DB constraint | Currently only enforced at API level — add DB check constraint |
| 🟡 Medium | Waitlist for open events | Queue guests when `max_registrations` reached |
| 🟢 Low | Invitation card PDF generation | `@react-pdf/renderer` is installed, wiring needed |
| 🟢 Low | Event analytics dashboard | `/events/:id/dashboard` route exists — populate with charts |
| 🟢 Low | Multi-language email templates | Currently English only |
| 🟢 Low | Webhook support | Notify external systems on check-in events |

---

## 14. Feature Expansion — Inspiration from Eventbrite & Luma

> High-impact features drawn from competitor analysis. Each is additive — no breaking changes to the existing data model.

### 🎟️ Ticketing & Paid Events *(Eventbrite-inspired)*

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Ticket tiers** | Multiple ticket types per event (General / VIP / Early Bird) — each with its own price, capacity, and QR batch | High |
| **Paid registration** | Stripe Checkout on the public `/register` page; registration only confirmed on payment | High |
| **Discount codes** | Percentage or fixed-amount coupon codes with redemption limits and expiry | Medium |
| **Free + paid hybrid** | Mix free guest list (closed) with public paid tickets (open) in a single event | Medium |
| **Order management** | Organiser view of all ticket orders, refund status, revenue breakdown | Medium |

### 📅 Event Discovery & Social *(Luma-inspired)*

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Public event page** | SEO-friendly, shareable event landing page with description, speakers, schedule, map embed | Medium |
| **Organiser profile** | Public page per organiser listing all upcoming public events — like a Luma host page | Medium |
| **Social sharing cards** | Auto-generated Open Graph image using event banner + name for rich link previews (WhatsApp, Twitter, iMessage) | Low |
| **"Interested" / soft RSVP** | Soft interest capture before full registration — notify when spots open | Medium |
| **Event series** | Group recurring events (weekly meetup, monthly dinner) under a parent series | High |
| **Guest network** | Optional: guests see who else is attending (with permission) — encourages networking | High |

### 📱 Mobile & Usher Experience

| Feature | Description | Complexity |
|---------|-------------|------------|
| **PWA / installable scanner** | Make `/scan/:token` installable as a home-screen app (manifest + service worker) — works offline | Medium |
| **Manual name search** | Fallback search on scanner page — type a guest name if QR is damaged or battery is dead | Low |
| **Multi-entrance stats** | Per-door breakdown in analytics — track which entrance each scanner link represents | Low |
| **Audio feedback** | Distinct tones for ✅ admitted vs ❌ denied on the scanner page (accessibility + speed) | Low |
| **Live usher counter** | Show live count of entries on the scanner page — ushers see progress towards capacity | Low |

### 📊 Analytics & Reporting

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Real-time attendance graph** | Live chart of check-ins over time during the event (entries per 5-minute bucket) | Medium |
| **No-show rate** | Invited vs Attended comparison per event | Low |
| **Email open/click tracking** | Track open rates via Resend webhooks | Medium |
| **Exportable guest list** | CSV export of guest + attendance data per event | Low |
| **Post-event summary report** | Auto-generated PDF after event ends: attendance %, no-shows, check-in peak time | High |

### 🔧 Organiser Productivity

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Event templates** | Save an event as a template — reuse layout, email copy, ticket tiers for future events | Medium |
| **Team access / sub-accounts** | Invite co-hosts with limited permissions (view-only, scanner management) | High |
| **WhatsApp notifications** | Send invitation and reminder via WhatsApp Business API — critical for African markets | High |
| **Custom email domain** | Let organisers send from their own domain via Resend custom domain — removes Crenelle branding | Medium |
| **Waitlist auto-promotion** | Automatically send an invitation when a spot opens from a cancellation | Medium |
| **Guest tags / categories** | Label guests (VIP, Press, Staff) for filtering and differentiated entry flows | Low |

---

## 15. Monetisation Strategies

> Recommended approach: **freemium SaaS** with usage-based upgrades — modelled on how Luma and Eventbrite generate revenue without alienating small organisers.

### Subscription Tiers

| | Free | Pro (~$25/mo) | Business (~$89/mo) |
|---|---|---|---|
| Events | Unlimited | Unlimited | Unlimited |
| Guests per event | 50 | Unlimited | Unlimited |
| Scanner links | 1 | Unlimited | Unlimited |
| Email branding | Crenelle footer | Crenelle footer | Custom domain |
| Analytics | ❌ | ✅ | ✅ |
| Team access | ❌ | ❌ | Up to 5 members |
| Webhooks | ❌ | ❌ | ✅ |
| PDF reports | ❌ | ✅ | ✅ |
| Support | Community | Email | Priority SLA |

### Revenue Stream 2 — Ticketing Commission

For paid events, charge a platform fee on each ticket sale:

| Model | Rate | Notes |
|-------|------|-------|
| **Percentage** | 2–4% of ticket face value | Competitive with Eventbrite (3.7% + $1.79) |
| **Flat fee** | $0.75–$1.50 per ticket | Better for high-value tickets |
| **Hybrid** | 2% + $0.50 | Most common, predictable for organisers |

> **Key differentiator vs Eventbrite:** absorb the Stripe processing fee on Pro/Business plans as a conversion incentive.

### Revenue Stream 3 — Usage-based Add-ons

| Add-on | Price |
|--------|-------|
| Extra guest capacity (+500 guests, one event) | $9 |
| Additional scanner link (per event) | $4 |
| WhatsApp notification credits (per 100 sends) | $8 |
| Custom domain setup (one-time) | $29 |

### Revenue Stream 4 — Enterprise / White-Label

For agencies or venues running Crenelle under their own brand:
- **Custom subdomain** — `tickets.yourvenue.com`
- **White-label PWA scanner** — client branding on the usher app
- **Dedicated Supabase project** — data isolation + SLA uptime guarantee
- **Pricing:** Custom contracts — estimated $400–$2,000/month

### Revenue Stream 5 — Sponsored Discovery *(Long-term)*

Once the public event directory is live:
- **Featured placement** on the discovery page — $50–200 per event
- **Promoted organiser profiles** — monthly retainer

### Monetisation Phase Roadmap

```
Phase 1 (Now)       → Freemium gate + Pro plan launch
Phase 2 (Q3 2026)   → Ticketing + Paystack integration (Nigerian market first)
Phase 3 (Q4 2026)   → WhatsApp notifications + Business plan
Phase 4 (Q1 2027)   → Public discovery + sponsored listings
Phase 5 (Q2 2027+)  → White-label / Enterprise contracts
```

---

## 16. AI Integration Opportunities

> AI is not a gimmick here — there are several genuinely high-leverage places where it fits naturally into the existing event management workflow.

### Where AI Actually Helps

#### 🤖 Smart Guest List Generation
**Prompt:** *"Add 20 board members from our Lagos office"*  
Organiser types a natural-language description → AI parses names, emails, roles from a pasted text blob (e.g., LinkedIn exports, email threads, spreadsheet paste). Eliminates the most tedious part of event setup.

- **Implementation:** OpenAI / Gemini API call in a new server action. Input: raw text. Output: structured `{ name, email, phone }[]` ready for bulk insert.
- **Complexity:** Low. The data schema is simple and LLMs are extremely good at this.
- **Value:** High. This single feature could be the biggest organiser time-saver.

#### 📧 AI-Powered Email Copy
**Prompt:** *"Write an invitation email for our annual gala in Lagos — formal tone"*  
Generate invitation and reminder email body copy on demand. The organiser reviews and edits before sending.

- **Implementation:** Streaming text generation in the "Send Invitations" dialog. Store approved copy as the `customMessage` field.
- **Model:** Gemini Flash (fast, cheap) or GPT-4o-mini.
- **Complexity:** Low.

#### 📋 Custom Registration Form Questions
**Prompt:** *"What should I ask guests registering for a tech conference?"*  
AI suggests relevant custom fields (dietary needs, company, role, T-shirt size) based on event type and description.

- **Implementation:** Pre-populate the registration form builder with AI-suggested fields.
- **Complexity:** Medium (requires building the custom fields feature first).

#### 📊 Post-Event Insights Narrative
After an event ends, generate a natural-language summary:
> *"142 of 180 guests attended (79%). Peak check-in was between 7:00–7:30 PM. 12 guests were turned away (party limit reached). The VIP entrance had a 15% lower no-show rate than General."*

- **Implementation:** Feed aggregated `entry_logs` stats to an LLM, render the narrative in the analytics dashboard.
- **Complexity:** Low (data aggregation is the hard part, narrative generation is trivial).

#### 🔍 Intelligent Duplicate Detection
Before adding a guest, detect potential duplicates:
> *"John Adeyemi (john.a@gmail.com) looks similar to an existing guest: Johnathan Adeyemi (john.adeyemi@gmail.com). Same person?"*

- **Implementation:** Fuzzy matching (Levenshtein distance) + optional LLM confirmation for ambiguous cases.
- **Complexity:** Low. Can start with pure string similarity, no LLM needed initially.

#### 🚨 Anomaly Detection on Scan Errors
The `scan_errors` table already exists. Feed error patterns to a simple classifier:
- Detect if a specific QR code is being scanned repeatedly at different entrances (resale/sharing)
- Flag IP addresses submitting an unusual number of registrations (bot activity)

- **Implementation:** Scheduled edge function that aggregates error patterns and writes alerts to the admin dashboard.
- **Complexity:** Medium.

### AI Integration Architecture

```
Organiser types prompt
        │
        ▼
Next.js Server Action
        │
        ├─▶ OpenAI / Gemini API (streaming)
        │         └─▶ Structured JSON response
        │
        └─▶ Preview UI (organiser reviews before committing)
                  │
                  └─▶ Supabase insert on confirm
```

### Recommended Stack

| Use Case | Model | SDK | Cost estimate |
|----------|-------|-----|--------------|
| Guest list parsing | Gemini 2.0 Flash | `@google/generative-ai` | ~$0.001 per parse |
| Email copy generation | Gemini 2.0 Flash | `@google/generative-ai` | ~$0.002 per draft |
| Post-event narrative | Gemini 1.5 Flash | `@google/generative-ai` | ~$0.001 per report |
| Duplicate detection | Pure JS (no AI) | `fastest-levenshtein` | Free |

> **Recommendation:** Start with **Google Gemini** — it has a generous free tier (1,500 req/day), integrates cleanly with Next.js server actions, and avoids adding OpenAI dependency cost at early stage. Gate AI features behind the **Pro plan** to justify the upgrade.

---

## 17. Payment Gateway — Nigerian Market Analysis

> **Verdict: Start with Paystack, keep Stripe as a future global expansion path.**

### Paystack vs Stripe vs Alternatives

| | Paystack | Stripe | Flutterwave | Squad (GTB) |
|--|---------|--------|-------------|-------------|
| **Nigerian cards** | ✅ Native | ⚠️ Limited | ✅ Native | ✅ Native |
| **Bank transfers (NIPS)** | ✅ | ❌ | ✅ | ✅ |
| **USSD payments** | ✅ | ❌ | ✅ | ✅ |
| **POS integration** | ✅ | ❌ | ✅ | ✅ |
| **NGN settlement** | ✅ Direct | ❌ USD only | ✅ Direct | ✅ Direct |
| **Transaction fee** | 1.5% + ₦100 (capped ₦2,000) | 2.9% + $0.30 | 1.4% local / 3.8% intl | 1.5% |
| **Setup complexity** | Low | Medium | Low | Medium |
| **Dashboard quality** | Excellent | Excellent | Good | Fair |
| **Webhook reliability** | ✅ Excellent | ✅ Excellent | ⚠️ Variable | ✅ Good |
| **Free tier** | ✅ (no monthly fee) | ✅ (no monthly fee) | ✅ | ✅ |
| **International cards** | ✅ | ✅ Best | ✅ | ⚠️ Limited |

### Why Paystack Wins for the Nigerian Market

1. **Local payment methods matter.** A significant portion of Nigerian event-goers pay via bank transfer or USSD — not card. Paystack supports all of these natively. Stripe does not.
2. **NGN settlement.** Paystack settles directly to a Nigerian bank account in Naira. Stripe requires a USD account and involves conversion fees and CBN compliance headaches.
3. **Trust signal.** Paystack is a known brand in Nigeria (acquired by Stripe in 2020 ironically). Organisers and guests recognise it.
4. **Fee cap.** Paystack caps local card fees at ₦2,000 (~$1.30) regardless of transaction size. For high-value event tickets, this is significantly cheaper than Stripe's uncapped percentage.
5. **Compliance.** CBN regulations around international payment processors are complex. Paystack handles this natively.

### Recommended Implementation Strategy

```
Phase 1 (Nigeria launch)
  └─▶ Paystack Checkout (hosted page — simplest integration)
        - One-time ticket purchase via card / bank transfer / USSD
        - Paystack webhook → verify payment → create registration

Phase 2 (East/West Africa expansion)
  └─▶ Flutterwave (covers Ghana, Kenya, Rwanda + 30 other African markets)
        - Swap or parallel integration

Phase 3 (International events)
  └─▶ Stripe (for diaspora events, UK/US organisers)
        - Requires verified international entity
```

### Integration Touchpoints

```
Guest clicks "Pay & Register"
        │
        ▼
POST /api/register/[slug]
  ├─ Validate event + capacity
  ├─ Create Paystack transaction (initialize)
  └─ Redirect → Paystack hosted checkout page

Guest completes payment on Paystack
        │
        ▼
Paystack webhook → POST /api/webhooks/paystack
  ├─ Verify HMAC-SHA512 signature (Paystack-Signature header)
  ├─ Confirm payment.status === 'success'
  ├─ Insert into `registrations` (status: 'accepted')
  ├─ Create guest + invitation
  └─ Trigger invitation email with QR code

Organiser dashboard
  └─ Shows payment reference alongside each registration
```

### New Migration Required

```sql
-- Add payment fields to registrations table
ALTER TABLE public.registrations
  ADD COLUMN payment_reference text,       -- Paystack reference
  ADD COLUMN payment_status text DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'failed')),
  ADD COLUMN amount_paid integer,           -- in kobo (NGN × 100)
  ADD COLUMN paid_at timestamptz;
```

---

## 18. Navigation Audit — Current Iteration Assessment

### What's Working Well ✅

| Element | Assessment |
|---------|-----------|
| **Top bar** | Clean, minimal — logo, email, settings, theme toggle, sign out. All expected items present. |
| **Breadcrumb "← All events"** | Clear escape hatch from event detail back to the list. |
| **Event sub-tabs** | Overview / Guests / Registrations / Scanner Links / Live Dashboard — logical grouping, horizontally scrollable on mobile. |
| **Status badge** | Animated blink on "Live" is a smart visual cue for ushers and organisers. |
| **Contextual Registrations tab** | Only appears for open events — smart conditional rendering, avoids confusion. |
| **"Open event" badge** | Displayed next to the event date — good disambiguation at a glance. |

### UX Gaps & Quick Wins 🔴

| Gap | Impact | Fix |
|-----|--------|-----|
| **No active tab indicator** | The current tab has no visual active state — users can't tell which section they're in | Add `aria-current="page"` detection and a `border-b-2 border-copper text-foreground` active class using `usePathname()` |
| **Settings only has one page** | `/settings` links directly to `/settings/sender-profiles` — if more settings pages are added this will break | Add a settings index or a left sidebar inside settings |
| **No mobile bottom nav** | On mobile, the top bar items (Settings, Sign Out) are icon-only, with text hidden. There's no bottom navigation | Consider a mobile bottom tab bar for Events / New Event / Settings |
| **"New Event" is not in the nav** | To create a new event, the user must find the button on the events list page. It should also be accessible from any screen | Add `+ New Event` to the top bar (desktop) or FAB button (mobile) |
| **No empty state on sub-tabs** | When Guests or Scanner Links are empty, there's no guided CTA (e.g., "No guests yet — add your first guest →") | Add contextual empty states per tab |
| **Event cards show "checkedIn" not "invited"** | The stat card shows check-ins (0 until the event is live), not the total number of guests. New organisers may think nothing is saved | Show `X guests invited` on draft/published events, switch to `X checked in` only when live |
| **Tab label "Entry Cards"** | Slightly ambiguous — could be "Invitation Cards" or "QR Passes" for clearer intent | Consider renaming to "Passes" or "QR Cards" |
| **No visual breadcrumb path** | Deep in `/events/:id/guests`, it's not obvious you're two levels deep | Show `Events > [Event Name] > Guests` breadcrumb trail |

### Navigation Map (Current State)

```
/ (Landing)
├─ /login
├─ /signup
├─ /events                        ← Events list (primary home)
│   └─ /events/new                ← Create event form
│   └─ /events/:id                ← Event overview
│       ├─ /events/:id/registrations  (open events only)
│       ├─ /events/:id/guests
│       ├─ /events/:id/cards
│       ├─ /events/:id/scanner-links
│       └─ /events/:id/dashboard
├─ /settings/sender-profiles      ← Only settings page
├─ /register/:slug                ← Public (no auth)
├─ /scan/:token                   ← Public (no auth)
└─ /admin                         ← Hidden, email-gated
```

### Recommended Tab Order Tweak

Current order: `Overview · Registrations · Guests · Entry Cards · Scanner Links · Live Dashboard`

Suggested order (frequency of use):
```
Overview · Guests · Registrations · Live Dashboard · Scanner Links · Passes
```
Rationale: After creating an event, the most common workflow is: set up → add guests → manage registrations → go live and monitor. The current order is logical but doesn't match the natural workflow sequence.

### Overall Assessment for Current Iteration

> **Rating: 7.5 / 10** — Solid foundation, production-ready for closed events. A few targeted UX fixes (active tab state, "New Event" in nav, empty states, mobile nav) would push this to 9/10 without any database or architecture changes.

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information architecture | 8/10 | Well-structured, logical grouping |
| Mobile responsiveness | 6/10 | Works but no bottom nav; tab overflow is managed |
| Discoverability | 7/10 | "New Event" is buried; Settings is a single link |
| Visual hierarchy | 8/10 | Brutalist aesthetic is distinctive and consistent |
| Empty states | 5/10 | Missing on most sub-tabs |
| Active state / wayfinding | 6/10 | No active tab highlight is a real usability gap |
| Accessibility | 7/10 | `aria-label` present on most elements; `aria-current` missing |

---

*This document is intended to be updated alongside the codebase. It is the single source of truth for onboarding new contributors and making architectural decisions.*

---

## 19. The Bigger Vision — What Problem Are We Actually Solving?

> This section steps back from the current feature set and asks the harder question: what is the largest version of this problem we could credibly own?

### The Real Problem Is Not "Event Management"

Strip Crenelle down to first principles and the core loop is this:

```
1. Define a list of people who are authorised to be somewhere
2. Issue each person a verifiable credential
3. Verify that credential at a physical point of presence
4. Log every interaction with that credential
```

This is not an event problem. This is a **physical identity and access control problem** — and virtually every organisation in Nigeria (and Africa broadly) does this manually, badly, and at scale.

Events are the wedge. They are the entry point because they have a clear pain point, a specific time pressure, and a person willing to pay (the organiser). But the infrastructure being built — QR credentials, scanner links, guest management, email dispatch, entry logs — is generic enough to power use cases orders of magnitude larger.

---

### The Real Addressable Market

**Current market:** Event organisers. Estimated TAM in Nigeria: ~₦50–200B/year.

**Actual market if you own the access credential layer:**

| Sector | Nigerian Scale | Pain Point |
|--------|---------------|------------|
| **Religious institutions** | 500+ megachurches with 10,000–500,000 members (RCCG, Winners, Daystar, MFM) | Member identity, ushering, programme access, giving records |
| **Higher education** | 170 federal/state universities, 3M+ enrolled students | Exam hall access, hostel entry, event attendance, CPD credits |
| **Corporate campuses & industrial sites** | NNPC, Dangote, Transcorp, all manufacturing plants | Contractor management, visitor logging, staff access |
| **Professional associations** | NBA, ICAN, NMA, NSE — millions of members across regulated professions | Annual dues, CPD attendance, event access, member verification |
| **Government citizen services** | NIMC, NPC, passport offices, courts | Queue management, appointment verification, presence logging |
| **Residential estates** | 2,000+ gated communities across Lagos, Abuja, PH | Visitor pre-registration, resident credentials, delivery management |
| **Healthcare** | Private hospital groups, NHIS-approved facilities | Patient appointment management, ward access, visitor control |

The combined TAM is not ₦200B. It is multiple trillions of naira in inefficiency waiting to be systematised.

---

### The Insight: Africa Has No Physical Access Credential Layer

In developed markets, this problem is partially solved by combinations of:
- Physical access cards (HID, RFID — expensive, hardware-dependent)
- Enterprise identity systems (Okta, Microsoft Entra — built for digital, not physical)
- Legacy visitor management (Envoy, Proxyclick — US-centric, expensive)

None of these work in the African context because:
1. **Smartphone penetration is the norm** — QR-on-phone is more practical than RFID card issuance
2. **No one wants to install an app** — a URL-based credential (the scan page) requires zero installation
3. **Unreliable internet at point of scan** — offline-capable PWA scanner is a real requirement
4. **NGN pricing is inaccessible** at $20–$50/seat/month Western SaaS pricing
5. **WhatsApp is the operating system** — credential delivery via WhatsApp is more reliable than email for many segments

Crenelle, as currently built, already solves for points 1, 2, and 5. The QR-on-phone + browser scanner is the right form factor for this market.

---

### What the Product Becomes: A Physical Access OS

Rather than "event management software," the reframe is:

> **Crenelle is the credential and access management layer for organisations that control physical spaces — starting with events, scaling to every recurring access use case.**

The core product primitives stay identical:

| Current Name | Generalised Name | Scale Use Case |
|---|---|---|
| Event | **Access Programme** | Weekly service / exam session / site visit / clinic day |
| Guest | **Member / Beneficiary** | Church member / student / contractor / patient |
| Invitation | **Access Credential** | QR pass that proves entitlement to enter |
| Scanner Link | **Checkpoint** | Gate / entrance / desk / ward |
| Entry Log | **Presence Record** | Attendance / check-in log / audit trail |
| Registration | **Enrolment** | New member signup / course registration / contractor onboarding |
| Organiser | **Administrator** | Church admin / registrar / facilities manager / clinic coordinator |

**Nothing in the database schema needs to change.** The tables are already named generically enough.

---

### The Product Evolution Path

```
Stage 1 — The Wedge (Now)
  Event organisers. Private dinners, corporate events, concerts.
  Prove the QR credential + scanner workflow. Build brand trust.

Stage 2 — Vertical Depth (6–12 months)
  Pick one high-volume vertical and go deep:
  
  RECOMMENDED: Religious institutions (churches)
  ─ Highest density of the exact problem
  ─ Sunday service = weekly "event" running our exact loop
  ─ Willingness to pay is proven (tithes, building funds, software)
  ─ Champion-driven sales: one deacon or admin decision-maker per church
  ─ Network effect: "Our church uses Crenelle" → sister church adopts it
  ─ Mega-churches (RCCG, Winners) are the enterprise deal

Stage 3 — Platform Expansion (12–24 months)
  Open the credential infrastructure to other use cases via:
  ─ Recurring access programmes (not just one-off events)
  ─ Membership tiers (General / VIP / Staff / Volunteer)
  ─ Multi-location support (multiple campuses, gates, branches)
  ─ Credential history (full access log per person across programmes)

Stage 4 — Network Effects (24+ months)
  The moat: every person's QR credential becomes reusable across
  any organisation on the Crenelle network.
  ─ Guest registers once → credential works at any Crenelle event
  ─ "Verified by Crenelle" becomes a trust signal (like "Verified by Paystack")
  ─ Interoperable identity across organisations in the same ecosystem
```

---

### The Church Vertical — Why It's the Right Beachhead

This deserves its own analysis because it is the highest-conviction next move.

**The problem at a megachurch:**
- RCCG's Redemption Camp hosts 500,000–1,000,000 people during annual conventions
- Winners Chapel Canaanland (Ota) has 50,000+ members weekly
- Every programme (Sunday service, mid-week, special programmes, Holy Ghost Night) has crowd control requirements
- Members currently identified by: paper ushering lists, physical membership cards, or "we know your face"
- No digital record of who attended what, when
- No credential system for restricted areas (prayer teams, backstage, media zones)
- No mechanism to send a personalised QR pass to members

**The Crenelle fit is exact:**
```
Church Admin = Organiser
Sunday Service = Event (recurring, weekly)
Service Hall / Zones = Scanner Links (with labels like "Main Auditorium" / "Prayer Room" / "Media Zone")
Church Member = Guest
Member QR Pass = Invitation
Attendance Log = Entry Logs
```

**The business model for churches:**
- Churches will not pay per-ticket fees (events are free)
- Subscription model based on member count:
  - Up to 200 members → ₦15,000/month (~$10)
  - Up to 2,000 members → ₦50,000/month (~$33)
  - Up to 20,000 members → ₦200,000/month (~$130)
  - Enterprise (RCCG, Winners) → Custom contract

**The sales motion:**
- One champion (the Head of Ushering, IT Coordinator, or Programmes Director)
- Demo at a mid-week service or department meeting
- Free trial for 3 months
- Upsell on analytics and multi-location (multiple campuses)

---

### The Competitive Moat (What Keeps Competitors Out)

Once access logs accumulate, the moat deepens:

1. **Attendance history is sticky.** An organisation's years of attendance data cannot be migrated elsewhere without rebuilding it. Switching cost increases with every logged entry.

2. **Credential network effects.** As more organisations use Crenelle, a person's credential (their registered profile) becomes reusable. A guest who registered for a Lagos Tech Summit can be pre-verified at a Crenelle-powered church event using the same identity — with permission. No competitor can replicate this without scale.

3. **WhatsApp-native delivery.** The QR credential delivered via WhatsApp (once WhatsApp Business API is integrated) is culturally native in Nigeria in a way that email-only competitors cannot replicate quickly.

4. **Offline-first scanner.** A PWA that caches the authorised guest list and works without internet is a real technical advantage in venues with poor connectivity. Most SaaS competitors assume reliable internet.

---

### What This Means for the Current Codebase

The good news: **the architecture is already 70% of the way there.**

| Current Capability | Maps To |
|---|---|
| Events with status lifecycle | Recurring access programmes with session management |
| Multiple scanner links per event | Multi-gate / multi-zone checkpoint management |
| Party size per invitation | Access tier (1 person vs. group pass vs. family pass) |
| Seat info field on invitation | Zone assignment (Balcony B / Row 12 / Media Zone) |
| Entry logs with scanner_link_id | Full audit trail: who entered, which gate, when |
| Open registration with approval | Member enrolment with admin approval workflow |
| Sender profiles | Multi-brand / multi-campus communications |

**What needs to be added to unlock the bigger use case:**

| Feature | Complexity | Why It Unlocks Scale |
|---------|-----------|---------------------|
| Recurring events / series | Medium | Church services repeat weekly — single "programme" with recurring sessions |
| Member profiles (persistent across events) | High | A person's credential doesn't expire after one event; it's their identity |
| Multi-location / multi-campus | Medium | One organisation, many physical sites |
| Membership tiers / access levels | Medium | General / VIP / Staff — different QR codes grant different access |
| Offline scanner mode (PWA + service worker cache) | Medium | Non-negotiable for churches with 10,000+ on-site |
| WhatsApp credential delivery | High | The default communication channel in Nigeria |
| Bulk member import (CSV / Google Contacts) | Low | Churches have existing rolls in Excel |

---

### The Reframed Pitch

**Today:**
> "Crenelle is event management software with QR check-in."

**The bigger truth:**
> "Crenelle is the access credential infrastructure for African organisations — the layer between 'who is authorised to be here' and 'proof they were here.' We started with events because every organisation runs them. We're building toward owning physical presence as a verifiable, digital-first record for every community, institution, and gathering on the continent."

This is not a pivot. The events product ships first, generates revenue, and proves the workflow. The church vertical is the scale move. The platform play is the moat.

---
