-- ============================================================
-- Crenelle — Ticket Tier System
-- Migration: 017_ticket_tiers.sql
-- ============================================================
--
-- Adds:
--   1. ticket_tiers      — multiple admission tiers per event
--   2. tier_perks        — bullet-point perks per tier
--   3. invitation_audit_log — status/tier change history per invitation
--
-- Alters:
--   invitations — adds ticket_tier_id, payment_reference;
--                 upgrades status text CHECK → invitation_status ENUM;
--                 party_size already exists (added in 001) — only a
--                 default value alignment comment is added here.
--
-- Safe to run on a live database:
--   • ENUM migration uses USING cast; existing values
--     ('pending', 'cancelled') are both members of the new type.
--   • All new columns are nullable or have defaults.
--   • No existing indexes or triggers are removed.
-- ============================================================

-- ── 1. invitation_status ENUM ─────────────────────────────────
-- Create before altering invitations so the USING clause can reference it.
-- Wrapped in a DO block so re-running after a partial failure is safe:
-- if the type already exists (committed on a prior run), the block is
-- skipped rather than raising "type already exists" (42710).

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'active',
    'cancelled',
    'checked_in',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;  -- type already exists, nothing to do
END $$;

-- ── 2. ticket_tiers ───────────────────────────────────────────

CREATE TABLE public.ticket_tiers (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    uuid          NOT NULL
                            REFERENCES public.events(id) ON DELETE CASCADE,
  name        text          NOT NULL,
  -- price stored in smallest currency unit (kobo for NGN, cents for USD, etc.)
  price       integer       NOT NULL CHECK (price >= 0),
  capacity    integer       CHECK (capacity IS NULL OR capacity > 0),
  is_public   boolean       NOT NULL DEFAULT true,
  currency    text          NOT NULL DEFAULT 'NGN',
  deleted_at  timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ── 3. tier_perks ─────────────────────────────────────────────

CREATE TABLE public.tier_perks (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id    uuid        NOT NULL
                         REFERENCES public.ticket_tiers(id) ON DELETE CASCADE,
  label      text        NOT NULL,
  icon       text,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Alter invitations ───────────────────────────────────────

-- 4a. Drop the existing text CHECK constraint on status.
--     The constraint name was set in 001_initial_schema.sql.
--     We use IF EXISTS + a name-agnostic approach: drop by scanning
--     pg_constraint so the migration is re-entrant even if the
--     constraint name differs across environments.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.invitations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pending%'
    AND pg_get_constraintdef(oid) LIKE '%cancelled%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.invitations DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END;
$$;

-- 4b. Cast status column from text → invitation_status ENUM.
--     Existing values 'pending' and 'cancelled' are valid ENUM members.
--
--     Wrapped in a DO block for two reasons:
--       1. PostgreSQL cannot auto-cast a text default during ALTER COLUMN TYPE
--          (error 42804) — the default must be dropped first, then restored.
--       2. If this migration is re-run after a partial failure the column may
--          already be the ENUM type — the block checks and skips in that case.
DO $$
DECLARE
  v_col_type text;
BEGIN
  SELECT data_type
    INTO v_col_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'invitations'
     AND column_name  = 'status';

  -- Only alter if the column is still a plain text type.
  -- If it is already 'USER-DEFINED' (i.e. our ENUM), skip.
  IF v_col_type = 'text' THEN
    ALTER TABLE public.invitations ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.invitations
      ALTER COLUMN status TYPE public.invitation_status
      USING status::public.invitation_status;
    ALTER TABLE public.invitations
      ALTER COLUMN status SET DEFAULT 'pending'::public.invitation_status;
  END IF;
END $$;

-- 4c. Add ticket_tier_id (nullable — existing rows have no tier).
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS ticket_tier_id uuid
    REFERENCES public.ticket_tiers(id) ON DELETE SET NULL;

-- 4d. Add payment_reference (nullable, unique — only set for paid invitations).
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS payment_reference text UNIQUE;

-- Note: party_size already exists as INTEGER NOT NULL DEFAULT 1
-- (added in 001_initial_schema.sql, used by the 004 entry-limit trigger).
-- No changes needed to that column.

-- ── 5. invitation_audit_log ───────────────────────────────────

CREATE TABLE public.invitation_audit_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id  uuid        NOT NULL
                             REFERENCES public.invitations(id) ON DELETE CASCADE,
  changed_by     uuid        NOT NULL
                             REFERENCES auth.users(id) ON DELETE CASCADE,
  old_status     public.invitation_status,
  new_status     public.invitation_status,
  old_tier_id    uuid,
  new_tier_id    uuid,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 6. Indexes ────────────────────────────────────────────────

-- ticket_tiers
CREATE INDEX ticket_tiers_event_id_idx
  ON public.ticket_tiers (event_id);

-- invitations — general lookups
CREATE INDEX invitations_event_id_idx
  ON public.invitations (event_id);

-- Supabase may already have this from 001; use IF NOT EXISTS guard via
-- a DO block so the migration is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'invitations'
      AND indexname  = 'invitations_event_id_idx'
  ) THEN
    EXECUTE 'CREATE INDEX invitations_event_id_idx ON public.invitations (event_id)';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS invitations_ticket_tier_id_idx
  ON public.invitations (ticket_tier_id);

CREATE INDEX IF NOT EXISTS invitations_status_idx
  ON public.invitations (status);

-- Partial: capacity accounting — only count active / checked-in rows
CREATE INDEX IF NOT EXISTS invitations_tier_active_partial_idx
  ON public.invitations (ticket_tier_id)
  WHERE status IN ('active', 'checked_in');

-- Partial: fast "active guests for an event" queries
CREATE INDEX IF NOT EXISTS invitations_event_active_partial_idx
  ON public.invitations (event_id, status)
  WHERE status = 'active';

-- tier_perks lookup by tier
CREATE INDEX IF NOT EXISTS tier_perks_tier_id_idx
  ON public.tier_perks (tier_id);

-- audit log lookup by invitation
CREATE INDEX IF NOT EXISTS invitation_audit_log_invitation_id_idx
  ON public.invitation_audit_log (invitation_id);

-- ── 7. RLS — ticket_tiers ─────────────────────────────────────

ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;

-- Organisers: full management of tiers they own (via events).
-- Soft-delete enforcement: deleted_at IS NOT NULL rows are hidden
-- from all non-service-role queries.
CREATE POLICY "Organisers manage their own ticket tiers"
  ON public.ticket_tiers FOR ALL
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = ticket_tiers.event_id
        AND events.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = ticket_tiers.event_id
        AND events.organizer_id = auth.uid()
    )
  );

-- Co-hosts (all roles): read-only access, soft-deleted rows hidden.
CREATE POLICY "Members can read ticket tiers for co-hosted events"
  ON public.ticket_tiers FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ticket_tiers.event_id
        AND em.member_id = auth.uid()
    )
  );

-- Public (scanner page, registration page): read public, non-deleted tiers.
CREATE POLICY "Public can read public ticket tiers"
  ON public.ticket_tiers FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_public = true
  );

-- ── 8. RLS — tier_perks ───────────────────────────────────────

ALTER TABLE public.tier_perks ENABLE ROW LEVEL SECURITY;

-- Organisers: full management (join through ticket_tiers → events).
CREATE POLICY "Organisers manage perks for their tiers"
  ON public.tier_perks FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND e.organizer_id = auth.uid()
        AND tt.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND e.organizer_id = auth.uid()
        AND tt.deleted_at IS NULL
    )
  );

-- Co-hosts: read-only.
CREATE POLICY "Members can read perks for co-hosted event tiers"
  ON public.tier_perks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.event_members em ON em.event_id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND em.member_id = auth.uid()
        AND tt.deleted_at IS NULL
    )
  );

-- Public: read perks for public, non-deleted tiers.
CREATE POLICY "Public can read perks for public tiers"
  ON public.tier_perks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ticket_tiers tt
      WHERE tt.id = tier_perks.tier_id
        AND tt.is_public = true
        AND tt.deleted_at IS NULL
    )
  );

-- ── 9. RLS — invitation_audit_log ─────────────────────────────

ALTER TABLE public.invitation_audit_log ENABLE ROW LEVEL SECURITY;

-- Organisers can read audit entries for invitations on their events.
CREATE POLICY "Organisers can read invitation audit log"
  ON public.invitation_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.events e ON e.id = inv.event_id
      WHERE inv.id = invitation_audit_log.invitation_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Organisers can insert audit entries (server actions write on their behalf).
CREATE POLICY "Organisers can insert invitation audit entries"
  ON public.invitation_audit_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.events e ON e.id = inv.event_id
      WHERE inv.id = invitation_audit_log.invitation_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Co-hosts (all roles): read-only.
CREATE POLICY "Members can read invitation audit log for co-hosted events"
  ON public.invitation_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = invitation_audit_log.invitation_id
        AND em.member_id = auth.uid()
    )
  );
