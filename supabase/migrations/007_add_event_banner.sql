-- Migration: 007_add_event_banner.sql
-- Adds support for event banners: adds the banner_url column to public.events
-- and provisions a public Supabase Storage bucket for event banners.

-- 1. Add banner_url column to the events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS banner_url text;

-- 2. Create the "banners" storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for the "banners" bucket
-- Enable Public Read access for anyone to view banner images
CREATE POLICY "Public Read Banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

-- Enable Authenticated Organizers to manage files inside the "banners" bucket
CREATE POLICY "Organizer Manage Banners"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'banners')
WITH CHECK (bucket_id = 'banners');
