-- Migration: Merge guests and registrations into attendees
-- ==========================================================

BEGIN;

-- ── 1. ENUM ──────────────────────────────────────────────────────────────────

CREATE TYPE attendee_source AS ENUM ('imported', 'public_registration', 'manual');

-- ── 2. CREATE attendees TABLE ─────────────────────────────────────────────────

CREATE TABLE public.attendees (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_id             uuid        NOT NULL,
  name                 text        NOT NULL,
  email                text,
  phone                text,
  source               attendee_source NOT NULL DEFAULT 'imported',
  registration_status  text        CHECK (
                         registration_status = ANY (
                           ARRAY['pending','accepted','rejected','waitlist']
                         ) OR registration_status IS NULL
                       ),
  ticket_tier_id       uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendees_pkey
    PRIMARY KEY (id),
  CONSTRAINT attendees_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT attendees_ticket_tier_id_fkey
    FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id) ON DELETE SET NULL
);

-- ── 3. MIGRATE DATA ───────────────────────────────────────────────────────────

-- 3a. guests → attendees (preserve original id for FK remapping below)
INSERT INTO public.attendees (id, event_id, name, email, phone, source, created_at)
SELECT
  id,
  event_id,
  name,
  email,
  phone,
  'imported'::attendee_source,
  created_at
FROM public.guests;

-- 3b. registrations → attendees
INSERT INTO public.attendees (id, event_id, name, email, phone, source, registration_status, created_at)
SELECT
  id,
  event_id,
  full_name,
  email,
  phone,
  'public_registration'::attendee_source,
  status,
  created_at
FROM public.registrations;

-- ── 4. ALTER invitations ──────────────────────────────────────────────────────

-- 4a. Add attendee_id (nullable initially for population)
ALTER TABLE public.invitations
  ADD COLUMN attendee_id uuid
    REFERENCES public.attendees(id) ON DELETE CASCADE;

-- 4b. Populate attendee_id from guest_id
--     guests.id was preserved as attendees.id in step 3a, so this is a direct map.
UPDATE public.invitations
SET attendee_id = guest_id;

-- 4c. Enforce NOT NULL now that all rows are populated
ALTER TABLE public.invitations
  ALTER COLUMN attendee_id SET NOT NULL;

-- 4d. Drop the RLS policy that depends on guest_id before dropping the column.
--     Defined in 020_rls_ticket_tier_system.sql as: USING (guest_id = auth.uid())
--     Recreated below with attendee_id after the column swap.
DROP POLICY IF EXISTS "Guests can select their own invitation"
  ON public.invitations;

-- 4e. Drop guest_id
ALTER TABLE public.invitations
  DROP COLUMN guest_id;

-- 4f. Recreate the guest SELECT policy pointing at the new column.
--     Semantics are identical: the attendee's UUID (preserved from guests.id)
--     must match the calling user's auth.uid().
CREATE POLICY "Guests can select their own invitation"
  ON public.invitations FOR SELECT
  USING (
    attendee_id = auth.uid()
  );

-- ── 5. DROP LEGACY TABLES ─────────────────────────────────────────────────────

DROP TABLE public.registrations;
DROP TABLE public.guests;

-- ── 6. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX idx_attendees_event_id
  ON public.attendees (event_id);

CREATE INDEX idx_attendees_email_event_id
  ON public.attendees (email, event_id);

CREATE INDEX idx_attendees_source
  ON public.attendees (source);

COMMIT;
