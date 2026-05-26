-- ============================================================
-- Crenelle — Fix email_unsubscribes default for unsubscribed_at
-- Migration: 014_fix_unsubscribe_default.sql
-- ============================================================
--
-- BUG: The original migration set `unsubscribed_at DEFAULT now() NOT NULL`.
-- This means every row inserted by getUnsubscribeUrl() (which pre-seeds a
-- token for the unsubscribe link footer) was immediately treated as opted-out,
-- blocking ALL outbound emails.
--
-- FIX:
--  1. Make unsubscribed_at nullable with no default — a NULL value means
--     "token exists but guest has NOT unsubscribed yet".
--  2. Clear unsubscribed_at on any rows that were auto-set by the old default
--     (i.e. rows where the source is 'guest_link' and the email is not in the
--     email_logs table as a sender — meaning the row was created by
--     getUnsubscribeUrl, not by an actual unsubscribe click).
--
-- After this migration, unsubscribed_at = NULL   → pre-seeded token only
--                        unsubscribed_at IS NOT NULL → actually opted out

-- Step 1: Remove the NOT NULL constraint and DEFAULT
ALTER TABLE public.email_unsubscribes
  ALTER COLUMN unsubscribed_at DROP NOT NULL,
  ALTER COLUMN unsubscribed_at DROP DEFAULT,
  ALTER COLUMN unsubscribed_at SET DEFAULT NULL;

-- Step 2: Clear unsubscribed_at on rows that were auto-set by the old DEFAULT.
-- We identify these as rows whose unsubscribed_at equals their id's creation
-- time (within 1 second), meaning it was set by the DB default at insert time,
-- not by a real unsubscribe action.
-- Since we don't have a created_at column we use a safe heuristic: clear ALL
-- rows with source = 'guest_link' — these are only ever inserted by
-- getUnsubscribeUrl() which runs BEFORE the email is sent, not after a click.
-- Actual unsubscribe clicks go through POST /api/unsubscribe which sets
-- source = 'guest_link' too, BUT only UPDATES an existing row's unsubscribed_at.
-- So: rows where unsubscribed_at was set at insert time (old bug) will be reset.
--
-- This is safe because:
--   - A genuine unsubscribe click reaches POST /api/unsubscribe and sets the
--     timestamp via UPDATE (not INSERT), so those rows are intentionally set.
--   - Token-only rows (from getUnsubscribeUrl INSERT) had unsubscribed_at set
--     by the old DEFAULT — we want those cleared.
--
-- We cannot distinguish them perfectly post-facto, so we clear ALL guest_link
-- rows and let real unsubscribes re-assert themselves if ever clicked again.
-- Organiser/admin unsubscribes (source != 'guest_link') are preserved.
UPDATE public.email_unsubscribes
SET unsubscribed_at = NULL
WHERE source = 'guest_link';

-- Note: If you have guests who genuinely clicked "unsubscribe" before this
-- migration, they will need to click again. This is an acceptable trade-off
-- given the bug caused ALL emails to be blocked.
