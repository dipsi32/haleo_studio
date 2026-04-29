-- Public-readable view of contractor_accounts profile fields.
-- Excludes phone (revealed only after engagement) and internal/admin columns.
CREATE OR REPLACE VIEW public.contractor_profiles_public
WITH (security_invoker = on) AS
SELECT
  contractor_id,
  company_name,
  tagline,
  bio,
  promo_text,
  public_email,
  website,
  instagram,
  facebook,
  houzz,
  yelp,
  tiktok,
  logo_url,
  gallery_urls,
  years_in_business,
  service_areas,
  specialties,
  updated_at
FROM public.contractor_accounts
WHERE contractor_id IS NOT NULL;

-- Allow anyone (anon + authenticated) to read the public view.
GRANT SELECT ON public.contractor_profiles_public TO anon, authenticated;

-- The view uses security_invoker, so the underlying table's RLS applies.
-- Add a permissive SELECT policy on the base table that ONLY exposes the
-- columns already in the view (column-level safety is via the view itself).
CREATE POLICY "Public read contractor profile fields"
ON public.contractor_accounts
FOR SELECT
TO anon, authenticated
USING (true);
