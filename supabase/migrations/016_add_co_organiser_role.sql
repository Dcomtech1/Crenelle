-- ============================================================
-- Crenelle — Add co_organiser role to team access
-- Migration: 016_add_co_organiser_role.sql
-- ============================================================
--
-- Adds a third co-host tier:
--
--   viewer          — read-only
--   scanner_manager — viewer + manage scanner links
--   co_organiser    — scanner_manager + add/edit guests + send invitations
--
-- Permission chain is strictly additive:
--   viewer ⊂ scanner_manager ⊂ co_organiser ⊂ owner

-- ── Widen the role CHECK constraint ──────────────────────────
ALTER TABLE public.event_members
  DROP CONSTRAINT IF EXISTS event_members_role_check;

ALTER TABLE public.event_members
  ADD CONSTRAINT event_members_role_check
  CHECK (role IN ('viewer', 'scanner_manager', 'co_organiser'));

-- ── guests: co_organisers can INSERT and UPDATE ───────────────
CREATE POLICY "Co-organisers can manage guests"
  ON public.guests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guests.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guests.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );

-- ── invitations: co_organisers can INSERT, UPDATE, DELETE ────
CREATE POLICY "Co-organisers can manage invitations"
  ON public.invitations FOR ALL
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

-- ── scanner_links: co_organisers also get full management ────
-- (They inherit scanner_manager capabilities)
CREATE POLICY "Co-organisers can manage scanner links"
  ON public.scanner_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = scanner_links.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = scanner_links.event_id
        AND em.member_id = auth.uid()
        AND em.role = 'co_organiser'
    )
  );
