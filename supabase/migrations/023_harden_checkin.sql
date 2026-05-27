-- Migration: Harden invitations for production check-in
-- =======================================================

BEGIN;

-- ── 1. ADD COLUMNS TO invitations ────────────────────────────────────────────

ALTER TABLE public.invitations
  ADD COLUMN qr_token       text        NOT NULL UNIQUE
                            DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN checked_in_at  timestamptz,
  ADD COLUMN checked_in_by  uuid
                            REFERENCES auth.users(id);

-- ── 2. ADD COLUMN TO events ───────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN timezone text NOT NULL DEFAULT 'Africa/Lagos';

-- ── 3. UNIQUE PARTIAL INDEX + CHECK-IN GUARD TRIGGER ─────────────────────────

-- Prevents a checked-in invitation from having its checked_in_at
-- replaced by a second stamp (e.g. two scanners firing concurrently).
-- The partial index makes any double-stamp visible at the storage layer;
-- the trigger catches the race before the index is evaluated.

CREATE UNIQUE INDEX idx_invitations_one_checkin
  ON public.invitations (id)
  WHERE checked_in_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_single_checkin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.checked_in_at IS NOT NULL
     AND NEW.checked_in_at IS NOT NULL
     AND OLD.checked_in_at IS DISTINCT FROM NEW.checked_in_at
  THEN
    RAISE EXCEPTION 'invitation_already_checked_in'
      USING DETAIL = 'invitation ' || OLD.id || ' was already checked in at '
                     || OLD.checked_in_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_checkin
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_checkin();

-- ── 4. INDEXES ────────────────────────────────────────────────────────────────

-- Scanner QR lookup — equality search, must be fast
CREATE INDEX idx_invitations_qr_token
  ON public.invitations (qr_token);

-- Active invitations per event — check-in dashboard queries
CREATE INDEX idx_invitations_event_active
  ON public.invitations (event_id, status)
  WHERE status = 'active';

-- Tier capacity accounting — excludes cancelled rows
CREATE INDEX idx_invitations_tier_not_cancelled
  ON public.invitations (ticket_tier_id, status)
  WHERE status != 'cancelled';

COMMIT;
