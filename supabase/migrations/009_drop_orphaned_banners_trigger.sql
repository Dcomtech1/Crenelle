-- Migration: 009_drop_orphaned_banners_trigger.sql
-- Drops the database-level storage objects deletion trigger which is blocked by Supabase Storage protections
-- Cleanups are now handled cleanly at the server application layer (Next.js Server Actions)

DROP TRIGGER IF EXISTS cleanup_orphaned_event_banners_trigger ON public.events;
DROP FUNCTION IF EXISTS public.cleanup_orphaned_event_banners();
