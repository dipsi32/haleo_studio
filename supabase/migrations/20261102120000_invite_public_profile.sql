-- The invite page opens with who is coming: the contractor's own profile
-- (tagline, logo, years, specialties, a few photos of their work), not just
-- their name. contractor_accounts isn't publicly readable (20260525050626
-- removed that), so these fields come through this token-gated function,
-- and only for the contractor the link belongs to.
DROP FUNCTION IF EXISTS public.get_invite_public(text);

CREATE FUNCTION public.get_invite_public(_token text)
RETURNS TABLE (
  status text,
  contractor_id uuid,
  contractor_slug text,
  contractor_name text,
  contractor_company text,
  contractor_city text,
  contractor_tagline text,
  contractor_logo_url text,
  contractor_years_in_business integer,
  contractor_specialties text,
  contractor_gallery_urls jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN i.revoked_at IS NOT NULL THEN 'revoked'
      WHEN i.completed_at IS NOT NULL THEN 'completed'
      WHEN i.expires_at < now() THEN 'expired'
      ELSE 'open'
    END AS status,
    c.id,
    c.slug,
    c.name,
    c.company,
    c.city,
    a.tagline,
    a.logo_url,
    a.years_in_business,
    a.specialties,
    CASE
      WHEN jsonb_typeof(a.gallery_urls) = 'array'
        THEN (SELECT COALESCE(jsonb_agg(g.e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(a.gallery_urls) e LIMIT 3) g)
      ELSE '[]'::jsonb
    END
  FROM public.contractor_invites i
  JOIN public.contractors c ON c.id = i.contractor_id
  LEFT JOIN public.contractor_accounts a ON a.contractor_id = c.id
  WHERE i.token = _token
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_public(text) TO anon, authenticated;
