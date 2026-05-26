-- ============================================================
-- Crenelle — Team Access / Co-Host Collaboration
-- Migration: 015_team_access.sql
-- ============================================================
--
-- Enables event organisers to invite co-hosts (existing Crenelle
-- users) with one of two roles:
--
--   viewer          — read-only access to event data
--   scanner_manager — viewer + can manage scanner links
--
-- Co-hosts cannot edit/delete the event, send emails, or see
-- other events owned by the organiser.

-- ── event_members table ───────────────────────────────────────
CREATE TABLE public.event_members (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text        NOT NULL DEFAULT 'viewer'
                            CHECK (role IN ('viewer', 'scanner_manager')),
  invited_by    uuid        NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate membership
  UNIQUE (event_id, member_id)
);

-- Fast lookup: "what events is this user a co-host on?"
CREATE INDEX event_members_member_id_idx
  ON public.event_members (member_id);

-- Fast lookup: "who is co-hosting this event?"
CREATE INDEX event_members_event_id_idx
  ON public.event_members (event_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- Owner can fully manage membership for their events
CREATE POLICY "Owners manage event members"
  ON public.event_members FOR ALL
  USING (auth.uid() = organizer_id);

-- Members can read their own membership rows
CREATE POLICY "Members can view their own memberships"
  ON public.event_members FOR SELECT
  USING (auth.uid() = member_id);

-- ── Extend events RLS: members can read events they co-host ──
CREATE POLICY "Members can read co-hosted events"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = events.id
        AND em.member_id = auth.uid()
    )
  );

-- ── Extend guests RLS: members can read guests ───────────────
CREATE POLICY "Members can read guests for co-hosted events"
  ON public.guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guests.event_id
        AND em.member_id = auth.uid()
    )
  );

-- ── Extend invitations RLS: members can read invitations ─────
CREATE POLICY "Members can read invitations for co-hosted events"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = invitations.event_id
        AND em.member_id = auth.uid()
    )
  );

-- ── Extend scanner_links RLS: members can read all, scanner_managers can mutate
CREATE POLICY "Members can read scanner links for co-hosted events"
  ON public.scanner_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = scanner_links.event_id
        AND em.member_id = auth.uid()
    )
  );

CREATE POLICY "Scanner managers can manage scanner links"
  ON public.scanner_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = scanner_links.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'scanner_manager'
    )
  );

-- ── Extend entry_logs RLS: members can read entry logs ───────
CREATE POLICY "Members can read entry logs for co-hosted events"
  ON public.entry_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.invitations inv
      JOIN public.event_members em ON em.event_id = inv.event_id
      WHERE inv.id = entry_logs.invitation_id
        AND em.member_id = auth.uid()
    )
  );

-- ── registrations: members can read for co-hosted events ─────
CREATE POLICY "Members can read registrations for co-hosted events"
  ON public.registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = registrations.event_id
        AND em.member_id = auth.uid()
    )
  );
