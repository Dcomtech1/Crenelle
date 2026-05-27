-- Migration: Capacity enforcement and status transition triggers
-- (re-homed with a/b naming convention)
-- ==============================================================
--
-- Functions enforce_tier_capacity() and enforce_status_transition()
-- are fully defined here. Both were originally created in 018 and
-- patched in 021 (soft-deleted tier guard, ordering fix).
--
-- This migration:
--   - Drops all prior trigger bindings on invitations for these two
--     functions (018 names, 021 names) so this file is the sole
--     source of truth.
--   - Recreates functions with up-to-date logic (021 state).
--   - Binds them as trigger_a_ / trigger_b_ so alphabetical ordering
--     guarantees: status transition fires before capacity check.
-- ==============================================================

BEGIN;

-- ── Drop all prior trigger bindings ──────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_check_tier_capacity           ON public.invitations;
DROP TRIGGER IF EXISTS trigger_enforce_status_transition     ON public.invitations;
DROP TRIGGER IF EXISTS trigger_1_enforce_status_transition   ON public.invitations;
DROP TRIGGER IF EXISTS trigger_2_check_tier_capacity         ON public.invitations;

-- ── Function: enforce_status_transition() ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only relevant when status is actually changing
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- checked_in is terminal — no further transitions permitted
  IF OLD.status = 'checked_in' THEN
    RAISE EXCEPTION 'invalid_status_transition'
      USING
        DETAIL  = format(
                    'Cannot transition from checked_in to %s. '
                    'checked_in is a terminal state.',
                    NEW.status
                  ),
        ERRCODE = 'P0001';
  END IF;

  -- cancelled → only active is permitted (explicit reinstatement)
  IF OLD.status = 'cancelled' AND NEW.status != 'active' THEN
    RAISE EXCEPTION 'invalid_status_transition'
      USING
        DETAIL  = format(
                    'Cannot transition from cancelled to %s. '
                    'Only active (reinstatement) is permitted.',
                    NEW.status
                  ),
        ERRCODE = 'P0001';
  END IF;

  -- expired → only cancelled is permitted (administrative cleanup)
  IF OLD.status = 'expired' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'invalid_status_transition'
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

-- ── Function: enforce_tier_capacity() ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_tier_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity     integer;
  v_deleted_at   timestamptz;
  v_active_count bigint;
BEGIN
  -- Skip: no tier assigned
  IF NEW.ticket_tier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip: statuses that do not consume capacity
  IF NEW.status IN ('cancelled', 'expired') THEN
    RETURN NEW;
  END IF;

  -- Lock tier row to serialise concurrent inserts/updates;
  -- fetch capacity and soft-delete flag in one shot
  SELECT capacity, deleted_at
    INTO v_capacity, v_deleted_at
    FROM public.ticket_tiers
   WHERE id = NEW.ticket_tier_id
     FOR UPDATE;

  -- Guard: soft-deleted tiers accept no new capacity-consuming rows
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'tier_soft_deleted'
      USING
        DETAIL  = format(
                    'Tier %s has been removed and is no longer accepting invitations.',
                    NEW.ticket_tier_id
                  ),
        ERRCODE = 'P0001';
  END IF;

  -- Unlimited capacity — nothing further to check
  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Derive live allocated count; exclude self on UPDATE
  -- (NEW.id does not yet exist in the table on INSERT — safe no-op)
  SELECT COALESCE(SUM(party_size), 0)
    INTO v_active_count
    FROM public.invitations
   WHERE ticket_tier_id = NEW.ticket_tier_id
     AND status NOT IN ('cancelled', 'expired')
     AND id != NEW.id;

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

-- ── Trigger bindings (a < b in ASCII → status fires first) ───────────────────

CREATE TRIGGER trigger_a_enforce_status_transition
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_status_transition();

CREATE TRIGGER trigger_b_enforce_tier_capacity
  BEFORE INSERT OR UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tier_capacity();

COMMIT;
