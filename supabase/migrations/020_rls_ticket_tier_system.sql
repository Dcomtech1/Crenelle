-- ============================================================
-- Crenelle — Refined RLS for ticket_tiers, invitations,
--            invitation_audit_log
-- Migration: 020_rls_ticket_tier_system.sql
-- ============================================================
--
-- This migration tightens policies introduced across 001, 016,
-- and 017, and adds the guest role as a first-class actor.
--
-- Changes per table:
--
-- ticket_tiers (017):
--   DROP  "Organisers manage their own ticket tiers"  (FOR ALL → includes DELETE)
--   ADD   explicit SELECT / INSERT / UPDATE policies
--   KEEP  "Members can read ticket tiers for co-hosted events"
--   KEEP  "Public can read public ticket tiers"  (covers guest SELECT)
--   RESULT: hard DELETE is now permitted by zero policies
--
-- invitations (001, 016):
--   DROP  "Organizers manage invitations for their events"  (FOR ALL)
--   DROP  "Public can read invitations"  (USING true — too broad)
--   DROP  "Co-organisers can manage invitations"  (FOR ALL)
--   ADD   explicit organiser SELECT / INSERT / UPDATE
--   ADD   explicit co-organiser SELECT / INSERT / UPDATE
--   ADD   guest SELECT (own invitation only)
--   KEEP  "Members can read invitations for co-hosted events"  (015)
--   RESULT: hard DELETE permitted by zero policies; guests see only
--           their own row; unauthenticated callers have no read access
--
-- invitation_audit_log (017):
--   DROP  "Organisers can insert invitation audit entries"
--   ADD   authenticated INSERT (any logged-in user; trigger is
--         SECURITY DEFINER so it already bypasses RLS, but
--         application-layer explicit inserts — e.g. setting reason —
--         need this policy)
--   KEEP  "Organisers can read invitation audit log"
--   KEEP  "Members can read invitation audit log for co-hosted events"
--   RESULT: guests have no access; INSERT is open to authenticated
--           sessions; service_role bypasses RLS by default
--
-- Dependencies: 001, 015, 016, 017
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ticket_tiers
-- ════════════════════════════════════════════════════════════

-- Remove the over-broad FOR ALL policy (it authorises DELETE)
DROP POLICY IF EXISTS "Organisers manage their own ticket tiers"
  ON public.ticket_tiers;

-- Organisers: SELECT their own event's tiers (including soft-deleted,
-- so they can audit / un-delete via app layer if needed)
CREATE POLICY "Organisers can select their own ticket tiers"
  ON public.ticket_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Organisers: INSERT new tiers
CREATE POLICY "Organisers can insert ticket tiers"
  ON public.ticket_tiers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- Organisers: UPDATE (soft-delete is an UPDATE of deleted_at)
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

-- No DELETE policy is created → hard DELETE is blocked for all roles
-- (service_role bypasses RLS and can still hard-delete if ever needed
-- via a direct admin operation).

-- Existing policies retained (no DROP needed):
--   "Members can read ticket tiers for co-hosted events"  (017)
--   "Public can read public ticket tiers"                 (017)
--   ^ The "Public" policy covers the guest SELECT requirement:
--     is_public = true AND deleted_at IS NULL is already enforced there.

-- ════════════════════════════════════════════════════════════
-- invitations
-- ════════════════════════════════════════════════════════════

-- ── Drop policies that grant DELETE or are too permissive ─────

-- 001: FOR ALL → includes DELETE
DROP POLICY IF EXISTS "Organizers manage invitations for their events"
  ON public.invitations;

-- 001: USING(true) → any role can read any invitation
DROP POLICY IF EXISTS "Public can read invitations"
  ON public.invitations;

-- 016: FOR ALL → includes DELETE (co-organiser path)
DROP POLICY IF EXISTS "Co-organisers can manage invitations"
  ON public.invitations;

-- ── Organiser: scoped SELECT / INSERT / UPDATE ────────────────

CREATE POLICY "Organisers can select invitations for their events"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invitations.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organisers can insert invitations for their events"
  ON public.invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invitations.event_id
        AND e.organizer_id = auth.uid()
    )
  );

-- UPDATE covers soft-cancel (SET status = 'cancelled') and all
-- other legitimate mutations. Hard DELETE has no policy.
CREATE POLICY "Organisers can update invitations for their events"
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

-- ── Co-organiser: scoped SELECT / INSERT / UPDATE ─────────────
-- Replaces the dropped FOR ALL from 016.

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

-- ── Guest: read own invitation only ───────────────────────────
-- auth.uid() matches invitations.guest_id because guests are
-- Supabase Auth users whose UUID is stored there at registration.
-- Guests have zero write access — all mutations go through the
-- organiser or service_role (scan API).

CREATE POLICY "Guests can select their own invitation"
  ON public.invitations FOR SELECT
  USING (
    guest_id = auth.uid()
  );

-- Retained from 015 (no change needed):
--   "Members can read invitations for co-hosted events"

-- ════════════════════════════════════════════════════════════
-- invitation_audit_log
-- ════════════════════════════════════════════════════════════

-- ── Replace the narrow organiser-only INSERT with an
--    authenticated INSERT so application code can set `reason` ─

DROP POLICY IF EXISTS "Organisers can insert invitation audit entries"
  ON public.invitation_audit_log;

-- Any authenticated session may insert an audit entry.
-- The trigger (SECURITY DEFINER) already bypasses RLS for its own
-- inserts; this policy covers explicit application-layer inserts
-- (e.g. organiser sets a reason string via server action).
-- Guests are excluded: auth.uid() must not be NULL, and the
-- invitation must belong to an event the caller is associated with.
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
          -- organiser path
          e.organizer_id = auth.uid()
          OR
          -- co-host path (any role may write an audit note)
          EXISTS (
            SELECT 1 FROM public.event_members em
            WHERE em.event_id = e.id
              AND em.member_id = auth.uid()
          )
        )
    )
  );

-- Retained from 017 (no change needed):
--   "Organisers can read invitation audit log"
--   "Members can read invitation audit log for co-hosted events"
--
-- Guests have no SELECT or INSERT policy on this table → zero access.
