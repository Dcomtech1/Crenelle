-- Migration: 008_cleanup_orphaned_banners.sql
-- Automatically purges legacy or orphaned banner assets from Supabase Storage (storage.objects)
-- when an event is deleted or its banner_url is updated.

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_event_banners()
RETURNS TRIGGER AS $$
DECLARE
  old_filename TEXT;
BEGIN
  -- Trigger logic runs on DELETE or UPDATE when the banner_url is modified
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND OLD.banner_url IS DISTINCT FROM NEW.banner_url) THEN
    -- Check if OLD.banner_url is a Supabase Storage banner URL
    IF OLD.banner_url IS NOT NULL AND OLD.banner_url LIKE '%/storage/v1/object/public/banners/%' THEN
      -- Extract the exact filename using POSIX regex (excluding query parameters)
      old_filename := substring(OLD.banner_url from '/storage/v1/object/public/banners/([^?#]+)');
      
      IF old_filename IS NOT NULL AND old_filename <> '' THEN
        -- Deleting the row in storage.objects natively triggers the physical storage file deletion in Supabase
        DELETE FROM storage.objects 
        WHERE bucket_id = 'banners' 
          AND name = old_filename;
      END IF;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the AFTER UPDATE OR DELETE trigger on the events table
DROP TRIGGER IF EXISTS cleanup_orphaned_event_banners_trigger ON public.events;
CREATE TRIGGER cleanup_orphaned_event_banners_trigger
  AFTER UPDATE OR DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_event_banners();
