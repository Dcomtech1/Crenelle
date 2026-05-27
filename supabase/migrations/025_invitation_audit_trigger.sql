-- Migration: Unified invitation audit log trigger
-- ================================================
--
-- Supersedes:
--   019_invitation_audit_trigger.sql  (UPDATE-only, no party_size tracking)
--   021_trigger_fixes.sql FIX 2       (INSERT trigger added separately)
--
-- This migration drops all prior audit trigger bindings and replaces
-- them with a single function that handles both INSERT and UPDATE,
-- including party_size change detection.
--
-- Trigger is named trigger_c_log_invitation_changes so it sorts
-- after trigger_a_ (status) and trigger_b_ (capacity) — AFTER
-- triggers fire after all BEFORE triggers regardless of name, but
-- consistent numbering prevents confusion if more are added.
-- ================================================

BEGIN;

-- ── Drop all prior audit trigger bindings ────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_log_invitation_change    ON public.invitations;
DROP TRIGGER IF EXISTS trigger_3_log_invitation_insert  ON public.invitations;
DROP TRIGGER IF EXISTS trigger_4_log_invitation_change  ON public.invitations;

-- ── Function: log_invitation_changes() ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_invitation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := NULL;
BEGIN

  -- ── INSERT path ────────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invitation_audit_log (
      invitation_id,
      changed_by,
      old_status,
      new_status,
      old_tier_id,
      new_tier_id,
      reason
    ) VALUES (
      NEW.id,
      auth.uid(),           -- NULL for service-role / bulk inserts; never errors
      NULL,
      NEW.status,
      NULL,
      NEW.ticket_tier_id,
      NULL
    );
    RETURN NEW;
  END IF;

  -- ── UPDATE path ────────────────────────────────────────────────────────────
  -- Bail early if none of the tracked columns changed.
  IF (OLD.status         IS NOT DISTINCT FROM NEW.status)
     AND (OLD.ticket_tier_id IS NOT DISTINCT FROM NEW.ticket_tier_id)
     AND (OLD.party_size      IS NOT DISTINCT FROM NEW.party_size)
  THEN
    RETURN NEW;
  END IF;

  -- Derive reason when only party_size changed.
  -- If status or tier also changed, reason stays NULL so the caller
  -- can set it explicitly via the application layer.
  IF (OLD.status         IS NOT DISTINCT FROM NEW.status)
     AND (OLD.ticket_tier_id IS NOT DISTINCT FROM NEW.ticket_tier_id)
     AND (OLD.party_size      IS DISTINCT FROM  NEW.party_size)
  THEN
    v_reason := 'party_size_updated';
  END IF;

  INSERT INTO public.invitation_audit_log (
    invitation_id,
    changed_by,
    old_status,
    new_status,
    old_tier_id,
    new_tier_id,
    reason
  ) VALUES (
    NEW.id,
    auth.uid(),
    OLD.status,
    NEW.status,
    OLD.ticket_tier_id,
    NEW.ticket_tier_id,
    v_reason
  );

  RETURN NEW;
END;
$$;

-- ── Trigger binding ───────────────────────────────────────────────────────────

CREATE TRIGGER trigger_c_log_invitation_changes
  AFTER INSERT OR UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invitation_changes();

COMMIT;
