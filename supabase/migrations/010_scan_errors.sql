-- ============================================================
-- GateKeep — Scan Error Tracking
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Error severity levels
create type public.scan_error_severity as enum ('low', 'medium', 'high', 'critical');

-- Scan errors table — written by the /api/scan route on failures
-- Used by the admin dashboard for error-rate monitoring only.
-- No personal guest data is stored here.
create table public.scan_errors (
  id               uuid        default gen_random_uuid() primary key,

  -- Context (both nullable: errors may occur before context is resolved)
  event_id         uuid        references public.events(id) on delete set null,
  scanner_link_id  uuid        references public.scanner_links(id) on delete set null,

  -- Error classification
  error_code       text        not null,
  -- Examples: INVALID_TOKEN | DUPLICATE_SCAN | EXPIRED_INVITATION
  --           RATE_LIMIT_EXCEEDED | MALFORMED_QR | INTERNAL_ERROR

  message          text,

  severity         public.scan_error_severity not null default 'medium',

  -- Optional debugging context — never include PII
  -- Store things like: { "token_prefix": "abc1", "attempt": 3 }
  raw_payload      jsonb,

  -- Hashed IP for rate-limit analysis — not reversible, not PII
  -- Use: encode(digest(ip_address, 'sha256'), 'hex')
  ip_hash          text,

  created_at       timestamptz default now() not null
);

-- ── Indexes for admin dashboard time-range queries ────────────
create index scan_errors_created_at_idx
  on public.scan_errors (created_at desc);

create index scan_errors_event_id_idx
  on public.scan_errors (event_id)
  where event_id is not null;

create index scan_errors_error_code_idx
  on public.scan_errors (error_code);

create index scan_errors_severity_idx
  on public.scan_errors (severity);

-- ── Row Level Security ─────────────────────────────────────────
-- RLS enabled with no public/authenticated policies.
-- Only the service-role admin client can read or write this table.
-- This is intentional: scan errors are never exposed to organizers.
alter table public.scan_errors enable row level security;
