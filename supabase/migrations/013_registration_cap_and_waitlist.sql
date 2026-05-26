-- ============================================================
-- GateKeeper — Registration Cap DB Constraint + Waitlist
-- Migration: 013_registration_cap_and_waitlist.sql
-- ============================================================

-- ── Part 1: Add waitlist status to registrations ─────────────
-- Extend the status CHECK to include 'waitlist'
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'waitlist'));

-- ── Part 2: DB-level registration cap enforcement ─────────────
-- This trigger fires BEFORE INSERT on registrations.
-- It counts non-rejected, non-waitlist registrations and raises
-- an exception if the count would exceed max_registrations.
--
-- The API already checks this at the application layer, but this
-- constraint protects against race conditions where two concurrent
-- requests both pass the app-level check and both insert.
--
-- Waitlisted entries do NOT count toward the cap — they are the
-- overflow queue and are only promoted when a spot opens.

CREATE OR REPLACE FUNCTION public.check_registration_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max   integer;
  v_count integer;
BEGIN
  -- Only enforce when status is NOT 'waitlist' or 'rejected'
  -- (waitlist entries bypass the cap — they are the overflow)
  IF NEW.status IN ('waitlist', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Fetch the cap for this event
  SELECT max_registrations
    INTO v_max
    FROM public.events
   WHERE id = NEW.event_id;

  -- No cap set → allow
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current non-rejected, non-waitlist registrations
  SELECT COUNT(*)
    INTO v_count
    FROM public.registrations
   WHERE event_id = NEW.event_id
     AND status NOT IN ('rejected', 'waitlist');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'REGISTRATION_CAP_REACHED'
      USING HINT = 'max_registrations limit has been reached for this event';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_registration_cap ON public.registrations;

CREATE TRIGGER trg_check_registration_cap
  BEFORE INSERT ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_registration_cap();

-- ── Part 3: Waitlist position helper ─────────────────────────
-- Returns the 1-based position of a registration in the waitlist
-- for its event, ordered by created_at ascending.
CREATE OR REPLACE FUNCTION public.get_waitlist_position(p_registration_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT row_number
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS row_number
    FROM public.registrations
    WHERE event_id = (SELECT event_id FROM public.registrations WHERE id = p_registration_id)
      AND status = 'waitlist'
  ) ranked
  WHERE id = p_registration_id;
$$;
