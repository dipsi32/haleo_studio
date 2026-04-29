-- Add rich profile fields for contractor "My Studio" page
ALTER TABLE public.contractor_accounts
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS public_email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS houzz text,
  ADD COLUMN IF NOT EXISTS yelp text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS promo_text text,
  ADD COLUMN IF NOT EXISTS gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS years_in_business int,
  ADD COLUMN IF NOT EXISTS service_areas text,
  ADD COLUMN IF NOT EXISTS specialties text;

-- Storage bucket for contractor gallery photos (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contractor-gallery', 'contractor-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Contractor gallery public read" ON storage.objects;
CREATE POLICY "Contractor gallery public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'contractor-gallery');

-- Contractors upload to their own folder (folder = user_id)
DROP POLICY IF EXISTS "Contractor uploads own gallery" ON storage.objects;
CREATE POLICY "Contractor uploads own gallery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contractor-gallery'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Contractor updates own gallery" ON storage.objects;
CREATE POLICY "Contractor updates own gallery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'contractor-gallery'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Contractor deletes own gallery" ON storage.objects;
CREATE POLICY "Contractor deletes own gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contractor-gallery'
  AND auth.uid()::text = (storage.foldername(name))[1]
);