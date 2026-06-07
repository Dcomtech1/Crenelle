-- Migration: Hourly pg_cron job to auto-end past events
-- =======================================================
--
-- Requires: pg_cron extension (enable in Supabase Dashboard →
--           Database → Extensions → pg_cron)
--
-- Logic:
--   - If the event has a time set:
--       mark ended when (date + time) in the event's own timezone + 6h buffer < now()
--   - If no time set:
--       mark ended when the next day in the event's timezone has started
--
-- Only transitions 'live' and 'published' events — drafts are never touched.
-- Organisers who manually end early are unaffected (already 'ended').

SELECT cron.schedule(
  'auto-end-past-events',
  '0 * * * *',  -- every hour on the hour (UTC)
  $$
    UPDATE public.events
    SET    status = 'ended'
    WHERE  status IN ('live', 'published')
      AND (
        CASE
          WHEN time IS NOT NULL THEN
            -- Interpret the naive date+time as a wall-clock time in the event's timezone,
            -- convert to UTC, then add 6 hours grace for late-running / overnight events.
            (date + time)::timestamp AT TIME ZONE timezone
              + INTERVAL '6 hours'
              < now()
          ELSE
            -- No time specified: end at the start of the following day in the event's timezone.
            (date + INTERVAL '1 day')::timestamp AT TIME ZONE timezone
              < now()
        END
      );
  $$
);
