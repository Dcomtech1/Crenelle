-- Migration: Add timezone column to events
-- =========================================
-- Stores the IANA timezone of the event (e.g. 'Africa/Lagos', 'Europe/London').
-- Used by the pg_cron auto-end job to compute the correct UTC cutoff per event.
-- Default matches the existing UI fallback in page.tsx (line 334).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Lagos';

COMMENT ON COLUMN public.events.timezone IS
  'IANA timezone identifier for the event date/time. Auto-detected from organiser browser at creation.';
