-- ============================================================
-- Crenelle — Invitation Audit Log Trigger
-- Migration: 019_invitation_audit_trigger.sql
-- ============================================================
--
-- 1. Relaxes changed_by to nullable on invitation_audit_log.
--    The column was created NOT NULL in 017 but system/bulk
--    operations (payment webhooks, admin scripts) run outside
--    a user session, so auth.uid() returns NULL in those contexts.
--
-- 2. Adds log_invitation_change() — an AFTER UPDATE trigger
--    function that writes to invitation_audit_log whenever
--    status or ticket_tier_id changes.
--
-- Dependencies: 017_ticket_tiers.sql
-- ============================================================

-- ── 1. Make changed_by nullable ───────────────────────────────
-- Drop the FK first (it carries the NOT NULL implicitly via its
-- own constraint), then re-add it without NOT NULL.

ALTER TABLE public.invitation_audit_log
  ALTER COLUMN changed_by DROP NOT NULL;

-- ── 2. log_invitation_change() ────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_invitation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as the function owner so it can
SET search_path = public  -- always write regardless of caller's RLS
AS $$
BEGIN
  -- Only write if something meaningful actually changed.
  -- IS DISTINCT FROM is NULL-safe: NULL != NULL evaluates to FALSE
  -- with plain !=, but IS DISTINCT FROM correctly returns TRUE.
  IF (OLD.status IS NOT DISTINCT FROM NEW.status)
     AND (OLD.ticket_tier_id IS NOT DISTINCT FROM NEW.ticket_tier_id)
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.invitation_audit_log (
    invitation_id,
    changed_by,
    old_status,
    new_status,
    old_tier_id,
    new_tier_id,
    reason
    -- created_at defaults to now()
  ) VALUES (
    NEW.id,
    auth.uid(),      -- NULL when called from a service-role or bulk context
    OLD.status,
    NEW.status,
    OLD.ticket_tier_id,
    NEW.ticket_tier_id,
    NULL             -- application layer sets this explicitly when needed
  );

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_log_invitation_change ON public.invitations;

CREATE TRIGGER trigger_log_invitation_change
  AFTER UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invitation_change();
