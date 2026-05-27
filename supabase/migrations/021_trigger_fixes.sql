-- ============================================================
-- Crenelle — Trigger Correctness Fixes
-- Migration: 021_trigger_fixes.sql
-- ============================================================
--
-- Fixes three issues identified in review of 018 and 019:
--
--   FIX 1 (trigger order):
--     PostgreSQL fires BEFORE triggers alphabetically by name.
--     'c' (check_tier_capacity) fired before 'e' (enforce_status_transition),
--     meaning capacity arithmetic ran against an unvalidated NEW.status.
--     Status guard must fire first.
--     Solution: rename both triggers with numeric prefixes
--     ('1_' < '2_' in ASCII) so the status check always precedes
--     the capacity check.
--
--   FIX 2 (audit log on INSERT):
--     log_invitation_change() only fired AFTER UPDATE.
--     Initial invitation creation produced no audit row.
--     Solution: add log_invitation_insert() + AFTER INSERT trigger.
--
--   FIX 3 (soft-deleted tier guard):
--     check_tier_capacity() did not check deleted_at on ticket_tiers.
--     A new invitation could be booked against a soft-deleted tier.
--     Solution: RAISE EXCEPTION 'tier_soft_deleted' when deleted_at
--     IS NOT NULL. Existing invitations on soft-deleted tiers are
--     unaffected at check-in (correct — soft-delete means no new
--     sales, not ticket revocation).
--
-- Dependencies: 018_tier_capacity_triggers.sql,
--               019_invitation_audit_trigger.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- FIX 1 — Trigger naming: enforce execution order
-- ════════════════════════════════════════════════════════════
--
-- PostgreSQL guarantees alphabetical ordering for BEFORE triggers
-- with the same timing, event, and table (docs: §43.2).
-- We need: status transition (1_) → capacity check (2_).

-- Drop old names
DROP TRIGGER IF EXISTS trigger_check_tier_capacity        ON public.invitations;
DROP TRIGGER IF EXISTS trigger_enforce_status_transition  ON public.invitations;

-- Recreate with ordered prefixes.
-- Functions themselves are unchanged — only trigger names change.

CREATE TRIGGER trigger_1_enforce_status_transition
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_status_transition();

CREATE TRIGGER trigger_2_check_tier_capacity
  BEFORE INSERT OR UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_tier_capacity();

-- ════════════════════════════════════════════════════════════
-- FIX 2 — Audit log on INSERT
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_invitation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.invitation_audit_log (
    invitation_id,
    changed_by,
    old_status,    -- NULL: no prior state on creation
    new_status,
    old_tier_id,   -- NULL: no prior tier on creation
    new_tier_id,
    reason
  ) VALUES (
    NEW.id,
    auth.uid(),           -- NULL for service-role / bulk inserts
    NULL,
    NEW.status,
    NULL,
    NEW.ticket_tier_id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_3_log_invitation_insert ON public.invitations;

-- Numbered '3_' so it sorts after the two BEFORE triggers;
-- AFTER triggers fire after all BEFORE triggers regardless, but
-- consistent naming avoids confusion if more AFTER triggers are added.
CREATE TRIGGER trigger_3_log_invitation_insert
  AFTER INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invitation_insert();

-- Rename the UPDATE audit trigger to match the numbering convention
DROP TRIGGER IF EXISTS trigger_log_invitation_change ON public.invitations;

CREATE TRIGGER trigger_4_log_invitation_change
  AFTER UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invitation_change();

-- ════════════════════════════════════════════════════════════
-- FIX 3 — Soft-deleted tier guard in check_tier_capacity
-- ════════════════════════════════════════════════════════════
--
-- Replaces the function body in-place (CREATE OR REPLACE).
-- The BEFORE trigger binding (trigger_2_check_tier_capacity)
-- is already in place above — no trigger DDL change needed here.

CREATE OR REPLACE FUNCTION public.check_tier_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity    integer;
  v_deleted_at  timestamptz;
  v_active_count bigint;
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
  -- Also fetch deleted_at to guard against soft-deleted tiers.
  SELECT capacity, deleted_at
    INTO v_capacity, v_deleted_at
    FROM public.ticket_tiers
   WHERE id = NEW.ticket_tier_id
     FOR UPDATE;

  -- Guard: tier was soft-deleted — no new capacity-consuming rows allowed.
  -- Existing invitations on this tier remain valid and check in normally;
  -- soft-delete means "close to new bookings", not "revoke issued tickets".
  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'tier_soft_deleted'
      USING
        DETAIL  = format(
                    'Tier %s has been removed and is no longer accepting invitations.',
                    NEW.ticket_tier_id
                  ),
        ERRCODE = 'P0001';
  END IF;

  -- No capacity limit on this tier — nothing further to check
  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Derive the live allocated count, excluding the row being updated
  -- on UPDATE (prevents double-counting the existing party_size).
  -- On INSERT, NEW.id does not yet exist in the table — clause is a
  -- safe no-op.
  SELECT COALESCE(SUM(party_size), 0)
    INTO v_active_count
    FROM public.invitations
   WHERE ticket_tier_id = NEW.ticket_tier_id
     AND status IN ('active', 'checked_in', 'pending')
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
