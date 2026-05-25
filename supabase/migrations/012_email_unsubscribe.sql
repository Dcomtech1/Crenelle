-- ============================================================
-- GateKeeper — Email Unsubscribe / Opt-out (CAN-SPAM / GDPR)
-- Migration: 012_email_unsubscribe.sql
-- ============================================================

-- Stores one row per email address that has opted out.
-- The `token` column is a random secret embedded in unsubscribe links —
-- no login is required to unsubscribe (required by CAN-SPAM).

CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email        text        NOT NULL,

  -- Opaque token embedded in ?token=<value> unsubscribe links.
  -- Generated once per email; reused across all events.
  token        text        NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),

  -- The event the guest was associated with when they unsubscribed.
  -- NULL means a global unsubscribe from all platform emails.
  event_id     uuid        REFERENCES public.events(id) ON DELETE SET NULL,

  -- Who triggered the unsubscribe (organiser blast vs system)
  source       text        NOT NULL DEFAULT 'guest_link'
                           CHECK (source IN ('guest_link', 'organiser', 'admin')),

  unsubscribed_at timestamptz DEFAULT now() NOT NULL
);

-- One email should only appear once in this table
CREATE UNIQUE INDEX email_unsubscribes_email_unique
  ON public.email_unsubscribes (lower(email));

-- Fast lookup by token (used by the unsubscribe API route)
CREATE UNIQUE INDEX email_unsubscribes_token_idx
  ON public.email_unsubscribes (token);

-- Fast lookup to check before sending (used in email dispatch)
CREATE INDEX email_unsubscribes_email_lower_idx
  ON public.email_unsubscribes (lower(email));

-- ── Row Level Security ──────────────────────────────────────────
-- No organiser-level access to this table.
-- Only the service-role admin client reads/writes it.
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- ── Helper function ─────────────────────────────────────────────
-- Returns TRUE if an email is on the unsubscribe list.
-- Call from application code: SELECT public.is_email_unsubscribed('user@example.com');
CREATE OR REPLACE FUNCTION public.is_email_unsubscribed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_unsubscribes
    WHERE lower(email) = lower(p_email)
  );
$$;
