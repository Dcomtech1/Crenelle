-- Migration: Fix soft-deleted tier guard in enforce_tier_capacity()
-- ==================================================================
--
-- Bug: enforce_tier_capacity() raised tier_soft_deleted on any UPDATE
-- that set status to a non-terminal value (e.g. 'checked_in') when
-- the invitation's tier had been soft-deleted. This blocked legitimate
-- check-in operations for guests who already hold valid invitations.
--
-- Fix: scope the soft-delete guard to INSERT and to UPDATE operations
-- where ticket_tier_id is being changed. A check-in UPDATE (tier
-- unchanged, only status/checked_in_at/checked_in_by changing) is
-- now allowed through for soft-deleted tiers — the invitation is
-- already issued and the guest is entitled to entry.
--
-- "soft-delete means close to new bookings, not revoke existing tickets."
-- (established in 021_trigger_fixes.sql, §FIX 3)
-- ==================================================================

BEGIN;

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
  -- fetch capacity and soft-delete flag in one shot.
  SELECT capacity, deleted_at
    INTO v_capacity, v_deleted_at
    FROM public.ticket_tiers
   WHERE id = NEW.ticket_tier_id
     FOR UPDATE;

  -- Guard: soft-deleted tiers reject new bookings and tier reassignments.
  -- Applies to:
  --   INSERT           — always a new booking attempt
  --   UPDATE where ticket_tier_id is changing — reassignment to a removed tier
  -- Does NOT apply to:
  --   UPDATE where ticket_tier_id is unchanged — e.g. check-in stamping,
  --   status transitions on an already-issued invitation. Guests holding
  --   active invitations against a soft-deleted tier are entitled to entry.
  IF v_deleted_at IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE'
           AND OLD.ticket_tier_id IS DISTINCT FROM NEW.ticket_tier_id)
    THEN
      RAISE EXCEPTION 'tier_soft_deleted'
        USING
          DETAIL  = format(
                      'Tier %s has been removed and is no longer accepting invitations.',
                      NEW.ticket_tier_id
                    ),
          ERRCODE = 'P0001';
    END IF;
    -- Tier unchanged on this UPDATE (check-in or status path).
    -- Capacity arithmetic is also irrelevant — party_size hasn't changed.
    RETURN NEW;
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

COMMIT;
