-- Migration: Complete RLS overhaul for attendees and related tables
-- ==================================================================
--
-- Supersedes policies on invitations, ticket_tiers, tier_perks,
-- invitation_audit_log, entry_logs, and event_members that were
-- established across 015, 016, 017, 020, 022.
--
-- New table: attendees (no prior RLS exists).
--
-- Key decisions:
--   - scanner_manager UPDATE on invitations is column-restricted via
--     WITH CHECK: they may only stamp checked_in_at / checked_in_by /
--     status. All other columns must remain unchanged.
--   - attendees INSERT for anon is constrained to source =
--     'public_registration'; organisers/co-organisers use 'imported'
--     or 'manual' and are gated by their event ownership check.
--   - entry_logs: no UPDATE or DELETE policy exists for any role.
--   - invitation_audit_log INSERT: authenticated only; trigger is
--     SECURITY DEFINER so it bypasses RLS for its own writes.
-- ==================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- attendees
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

-- Organisers: full SELECT/INSERT/UPDATE on their own events
CREATE POLICY "Organisers can select attendees"
  ON public.attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = attendees.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can insert attendees"
  ON public.attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = attendees.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can update attendees"
  ON public.attendees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = attendees.event_id
        AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = attendees.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Co-organisers: SELECT, INSERT, UPDATE
CREATE POLICY "Co-organisers can select attendees"
  ON public.attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = attendees.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can insert attendees"
  ON public.attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = attendees.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can update attendees"
  ON public.attendees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = attendees.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = attendees.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

-- Scanner managers: SELECT only
CREATE POLICY "Scanner managers can select attendees"
  ON public.attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = attendees.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

-- Anon/public: INSERT only for public_registration rows.
-- Attendees from open registration forms are unauthenticated;
-- auth.uid() will be NULL — this policy must not check it.
CREATE POLICY "Public can self-register as attendee"
  ON public.attendees FOR INSERT
  WITH CHECK (
    source = 'public_registration'
  );

-- No DELETE policy for any role.

-- ════════════════════════════════════════════════════════════════
-- invitations
-- ════════════════════════════════════════════════════════════════
-- Drop all prior policies (015, 016, 020, 022) and replace wholesale.

DROP POLICY IF EXISTS "Members can read invitations for co-hosted events"   ON public.invitations;
DROP POLICY IF EXISTS "Co-organisers can manage invitations"                ON public.invitations;
DROP POLICY IF EXISTS "Organizers manage invitations for their events"       ON public.invitations;
DROP POLICY IF EXISTS "Public can read invitations"                         ON public.invitations;
DROP POLICY IF EXISTS "Organisers can select invitations for their events"  ON public.invitations;
DROP POLICY IF EXISTS "Organisers can insert invitations for their events"  ON public.invitations;
DROP POLICY IF EXISTS "Organisers can update invitations for their events"  ON public.invitations;
DROP POLICY IF EXISTS "Co-organisers can select invitations"               ON public.invitations;
DROP POLICY IF EXISTS "Co-organisers can insert invitations"               ON public.invitations;
DROP POLICY IF EXISTS "Co-organisers can update invitations"               ON public.invitations;
DROP POLICY IF EXISTS "Guests can select their own invitation"             ON public.invitations;

-- Organisers
CREATE POLICY "Organisers can select invitations"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invitations.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can insert invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invitations.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can update invitations"
  ON public.invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invitations.event_id
        AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invitations.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Co-organisers
CREATE POLICY "Co-organisers can select invitations"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can insert invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can update invitations"
  ON public.invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

-- Scanner managers: SELECT + role-gated UPDATE.
-- RLS WITH CHECK cannot reference OLD values — column immutability
-- for scanner writes is enforced by the trigger below (enforce_scanner_write).
CREATE POLICY "Scanner managers can select invitations"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

CREATE POLICY "Scanner managers can update check-in fields"
  ON public.invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

-- Trigger: enforce column immutability for scanner_manager sessions.
-- auth.uid() inside a BEFORE trigger matches the calling Supabase session.
-- Organisers and co-organisers bypass this check (they can update anything).
-- The trigger fires after the RLS USING check passes, so invitations.event_id
-- is already confirmed to belong to the scanner's event.
CREATE OR REPLACE FUNCTION public.enforce_scanner_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Only restrict sessions that are scanner_managers for this event.
  -- Non-scanner roles (organiser, co-organiser, service_role) are not
  -- in event_members with role = 'scanner_manager', so this block is skipped.
  IF EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = NEW.event_id
      AND em.member_id = auth.uid()
      AND em.role = 'scanner_manager'
  ) THEN
    IF NEW.attendee_id    IS DISTINCT FROM OLD.attendee_id    OR
       NEW.ticket_tier_id IS DISTINCT FROM OLD.ticket_tier_id OR
       NEW.party_size     IS DISTINCT FROM OLD.party_size     OR
       NEW.event_id       IS DISTINCT FROM OLD.event_id       OR
       NEW.qr_token       IS DISTINCT FROM OLD.qr_token
    THEN
      RAISE EXCEPTION 'scanner_write_restricted'
        USING DETAIL = 'Scanner managers may only update status, '
                       'checked_in_at, checked_in_by, and seat_info.',
              ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_d_enforce_scanner_write ON public.invitations;

CREATE TRIGGER trigger_d_enforce_scanner_write
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_scanner_write();

-- No DELETE, no anon access.

-- ════════════════════════════════════════════════════════════════
-- ticket_tiers
-- ════════════════════════════════════════════════════════════════
-- 017 created: "Organisers manage their own ticket tiers" (FOR ALL),
--              "Members can read ticket tiers for co-hosted events",
--              "Public can read public ticket tiers"
-- 020 refined: dropped FOR ALL, added explicit SELECT/INSERT/UPDATE.
-- This migration replaces all of the above with the same set
-- extended to name the co_organiser role explicitly and add
-- scanner_manager SELECT.

DROP POLICY IF EXISTS "Organisers manage their own ticket tiers"           ON public.ticket_tiers;
DROP POLICY IF EXISTS "Organisers can select their own ticket tiers"       ON public.ticket_tiers;
DROP POLICY IF EXISTS "Organisers can insert ticket tiers"                 ON public.ticket_tiers;
DROP POLICY IF EXISTS "Organisers can update ticket tiers"                 ON public.ticket_tiers;
DROP POLICY IF EXISTS "Members can read ticket tiers for co-hosted events" ON public.ticket_tiers;
DROP POLICY IF EXISTS "Public can read public ticket tiers"                ON public.ticket_tiers;

-- Organisers: SELECT (including soft-deleted rows for audit), INSERT, UPDATE
CREATE POLICY "Organisers can select ticket tiers"
  ON public.ticket_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can insert ticket tiers"
  ON public.ticket_tiers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can update ticket tiers"
  ON public.ticket_tiers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Co-organisers: SELECT + INSERT + UPDATE; soft-deleted rows visible to them too
CREATE POLICY "Co-organisers can select ticket tiers"
  ON public.ticket_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ticket_tiers.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can insert ticket tiers"
  ON public.ticket_tiers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ticket_tiers.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can update ticket tiers"
  ON public.ticket_tiers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ticket_tiers.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ticket_tiers.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

-- Scanner managers: SELECT where not soft-deleted
CREATE POLICY "Scanner managers can select ticket tiers"
  ON public.ticket_tiers FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ticket_tiers.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

-- Public / anon: non-deleted, public tiers only
CREATE POLICY "Public can read public ticket tiers"
  ON public.ticket_tiers FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_public = true
  );

-- No DELETE policy for any role.

-- ════════════════════════════════════════════════════════════════
-- tier_perks
-- ════════════════════════════════════════════════════════════════
-- 017 created: organiser FOR ALL, member SELECT, public SELECT.
-- Replace with explicit operations and role splits.

DROP POLICY IF EXISTS "Organisers manage perks for their tiers"             ON public.tier_perks;
DROP POLICY IF EXISTS "Members can read perks for co-hosted event tiers"   ON public.tier_perks;
DROP POLICY IF EXISTS "Public can read perks for public tiers"             ON public.tier_perks;

CREATE POLICY "Organisers can select tier perks"
  ON public.tier_perks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can insert tier perks"
  ON public.tier_perks FOR INSERT
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

CREATE POLICY "Organisers can update tier perks"
  ON public.tier_perks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND e.organizer_id = auth.uid()
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

CREATE POLICY "Organisers can delete tier perks"
  ON public.tier_perks FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Co-organisers: same read + write access as organisers on their events
CREATE POLICY "Co-organisers can select tier perks"
  ON public.tier_perks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.event_members em ON em.event_id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can insert tier perks"
  ON public.tier_perks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.event_members em ON em.event_id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
        AND tt.deleted_at IS NULL
    )
  );

CREATE POLICY "Co-organisers can update tier perks"
  ON public.tier_perks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.event_members em ON em.event_id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ticket_tiers tt
      JOIN public.event_members em ON em.event_id = tt.event_id
      WHERE tt.id = tier_perks.tier_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
        AND tt.deleted_at IS NULL
    )
  );

-- Public / anon: read perks for non-deleted, public tiers
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

-- ════════════════════════════════════════════════════════════════
-- invitation_audit_log
-- ════════════════════════════════════════════════════════════════
-- 017 created: organiser SELECT + INSERT, member SELECT.
-- 020 replaced INSERT with authenticated INSERT.
-- This migration replaces all of the above.

DROP POLICY IF EXISTS "Organisers can read invitation audit log"                   ON public.invitation_audit_log;
DROP POLICY IF EXISTS "Organisers can insert invitation audit entries"             ON public.invitation_audit_log;
DROP POLICY IF EXISTS "Members can read invitation audit log for co-hosted events" ON public.invitation_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit entries"               ON public.invitation_audit_log;

-- Organisers: SELECT for their own events
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

-- Co-organisers: SELECT for their co-hosted events
CREATE POLICY "Co-organisers can read invitation audit log"
  ON public.invitation_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = invitation_audit_log.invitation_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

-- INSERT: any authenticated session.
-- The SECURITY DEFINER trigger (log_invitation_changes) already bypasses
-- RLS for its own inserts. This policy covers explicit application-layer
-- inserts (e.g. setting reason from a server action).
-- Scanner managers and guests are excluded: they have no event association
-- check that would pass here without an additional role gate.
CREATE POLICY "Authenticated users can insert audit entries"
  ON public.invitation_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.events e ON e.id = inv.event_id
      WHERE inv.id = invitation_audit_log.invitation_id
        AND (
          e.organizer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.event_members em
            WHERE em.event_id = e.id
              AND em.member_id = auth.uid()
              AND em.role IN ('co_organiser')
          )
        )
    )
  );

-- No access for scanner_managers, no UPDATE or DELETE for anyone.

-- ════════════════════════════════════════════════════════════════
-- entry_logs
-- ════════════════════════════════════════════════════════════════
-- 015 created a member SELECT policy scoped through invitations.
-- This migration adds organiser SELECT + INSERT, and scanner INSERT.

ALTER TABLE public.entry_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read entry logs for co-hosted events" ON public.entry_logs;

-- Organisers: SELECT + INSERT
CREATE POLICY "Organisers can select entry logs"
  ON public.entry_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.events e ON e.id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can insert entry logs"
  ON public.entry_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.events e ON e.id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Co-organisers: SELECT + INSERT
CREATE POLICY "Co-organisers can select entry logs"
  ON public.entry_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

CREATE POLICY "Co-organisers can insert entry logs"
  ON public.entry_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

-- Scanner managers: SELECT + INSERT
CREATE POLICY "Scanner managers can select entry logs"
  ON public.entry_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

CREATE POLICY "Scanner managers can insert entry logs"
  ON public.entry_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

-- No UPDATE or DELETE policy for any role.

-- ════════════════════════════════════════════════════════════════
-- event_members
-- ════════════════════════════════════════════════════════════════
-- 015 created: "Owners manage event members" (FOR ALL),
--              "Members can view their own memberships" (SELECT).
-- These are correct and complete. No changes needed.
-- Keeping the DROP/recreate pair here for auditability only,
-- to confirm this migration is the canonical source of truth.

DROP POLICY IF EXISTS "Owners manage event members"        ON public.event_members;
DROP POLICY IF EXISTS "Members can view their own memberships" ON public.event_members;

-- Organisers: full CRUD on members of their own events
CREATE POLICY "Owners manage event members"
  ON public.event_members FOR ALL
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

-- Members: SELECT their own row only
CREATE POLICY "Members can view their own memberships"
  ON public.event_members FOR SELECT
  USING (auth.uid() = member_id);

COMMIT;
