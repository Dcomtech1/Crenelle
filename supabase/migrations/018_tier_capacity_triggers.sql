-- ============================================================
-- Crenelle — Tier Capacity & Status Transition Triggers
-- Migration: 018_tier_capacity_triggers.sql
-- ============================================================
--
-- Adds two BEFORE triggers on public.invitations:
--
--   trigger_check_tier_capacity
--     Fires BEFORE INSERT OR UPDATE.
--     Derives live capacity from existing rows — no reserved_count
--     column. Uses FOR UPDATE on ticket_tiers to serialise
--     concurrent inserts and prevent race conditions (same pattern
--     as the 004 entry_logs trigger).
--
--   trigger_enforce_status_transition
--     Fires BEFORE UPDATE only.
--     Guards the invitation_status state machine — prevents
--     illegal transitions that would corrupt check-in or payment
--     audit history.
--
-- Dependencies: 017_ticket_tiers.sql (invitation_status ENUM,
--   ticket_tiers table, party_size column on invitations).
-- ============================================================

-- ── 1. check_tier_capacity() ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_tier_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity      integer;
  v_active_count  bigint;
BEGIN
  -- Skip: no tier assigned to this invitation
  IF NEW.ticket_tier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip: statuses that do not consume capacity
  IF NEW.status IN ('cancelled', 'expired') THEN
    RETURN NEW;
  END IF;

  -- Lock the tier row to serialise concurrent inserts/updates.
  -- Any transaction that races here will wait until this one
  -- commits or rolls back, preventing double-booking.
  SELECT capacity
    INTO v_capacity
    FROM public.ticket_tiers
   WHERE id = NEW.ticket_tier_id
     FOR UPDATE;

  -- No capacity limit on this tier — nothing to check
  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Derive the live active count, excluding this row on UPDATE
  -- so self-updates (e.g. pending → active, same party_size) are
  -- not double-counted.
  SELECT COALESCE(SUM(party_size), 0)
    INTO v_active_count
    FROM public.invitations
   WHERE ticket_tier_id = NEW.ticket_tier_id
     AND status IN ('active', 'checked_in', 'pending')
     AND id != NEW.id;   -- safe for INSERT too: NEW.id is the
                         -- incoming UUID which does not yet exist

  -- Guard: ensure arithmetic is always non-negative
  v_active_count := GREATEST(0, v_active_count);

  IF (v_active_count + GREATEST(0, NEW.party_size)) > v_capacity THEN
    RAISE EXCEPTION 'tier_capacity_exceeded'
      USING
        DETAIL  = format(
                    'Tier %s has capacity %s; %s already allocated, requested %s more.',
                    NEW.ticket_tier_id,
                    v_capacity,
                    v_active_count,
                    NEW.party_size
                  ),
        ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate so the migration is safely re-entrant
DROP TRIGGER IF EXISTS trigger_check_tier_capacity ON public.invitations;

CREATE TRIGGER trigger_check_tier_capacity
  BEFORE INSERT OR UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_tier_capacity();

-- ── 2. enforce_status_transition() ───────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only relevant when the status column is actually changing
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- checked_in is a terminal state — no further transitions allowed.
  -- An admission is permanent; refunds/corrections must go through
  -- the invitation_audit_log and be handled at the application layer.
  IF OLD.status = 'checked_in' THEN
    RAISE EXCEPTION 'illegal_status_transition'
      USING
        DETAIL  = format(
                    'Cannot transition from checked_in to %s. '
                    'checked_in is a terminal state.',
                    NEW.status
                  ),
        ERRCODE = 'P0001';
  END IF;

  -- cancelled → only 'active' is permitted (explicit reinstatement).
  -- Reinstating to 'pending' would be ambiguous; to 'checked_in'
  -- or 'expired' is nonsensical.
  IF OLD.status = 'cancelled' AND NEW.status != 'active' THEN
    RAISE EXCEPTION 'illegal_status_transition'
      USING
        DETAIL  = format(
                    'Cannot transition from cancelled to %s. '
                    'Only active (reinstatement) is permitted.',
                    NEW.status
                  ),
        ERRCODE = 'P0001';
  END IF;

  -- expired → only 'cancelled' is permitted (administrative cleanup).
  -- Reinstating an expired invitation to active must not bypass
  -- payment or capacity checks — callers should create a new invitation.
  IF OLD.status = 'expired' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'illegal_status_transition'
      USING
        DETAIL  = format(
                    'Cannot transition from expired to %s. '
                    'Only cancelled is permitted from expired.',
                    NEW.status
                  ),
        ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate so the migration is safely re-entrant
DROP TRIGGER IF EXISTS trigger_enforce_status_transition ON public.invitations;

-- Fires BEFORE UPDATE only — INSERT always starts from scratch,
-- so no prior state to validate against.
CREATE TRIGGER trigger_enforce_status_transition
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_status_transition();
