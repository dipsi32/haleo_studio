-- A contractor's front door: one permanent address (/c/:slug) they can put
-- on their website, Google Business Profile or text replies. Opening it costs
-- nothing. When a visitor starts a project, open_front_door() mints a normal
-- one-person invite, so every existing rule (only this contractor receives
-- the brief, the homeowner keeps it) applies unchanged.
--
-- The contractor's brand color (contractor_accounts.branding.color) themes
-- the pages their client sees, so the planner feels like their own site.

-- ============================================================
-- Brand color: a plain #RRGGBB, or nothing.
-- ============================================================
ALTER TABLE public.contractor_accounts
  DROP CONSTRAINT IF EXISTS contractor_accounts_branding_color_check;
ALTER TABLE public.contractor_accounts
  ADD CONSTRAINT contractor_accounts_branding_color_check
  CHECK (branding->>'color' IS NULL OR branding->>'color' ~ '^#[0-9a-fA-F]{6}$');

-- ============================================================
-- Which door an invite came through. 'direct' = a link the contractor
-- made for one prospect; the rest come from the front door.
-- ============================================================
ALTER TABLE public.contractor_invites
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'direct'
    CHECK (source IN ('direct', 'website', 'google', 'text', 'other'));

CREATE INDEX IF NOT EXISTS idx_contractor_invites_front_door
  ON public.contractor_invites(contractor_id, created_at DESC)
  WHERE source <> 'direct';

-- ============================================================
-- Public view of a front door: who it belongs to and how it looks.
-- Only contractors with an account (claimed) have one.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_front_door_public(_slug text)
RETURNS TABLE (
  contractor_id uuid,
  contractor_slug text,
  contractor_name text,
  contractor_company text,
  contractor_city text,
  contractor_tagline text,
  contractor_logo_url text,
  contractor_years_in_business integer,
  contractor_specialties text,
  contractor_gallery_urls jsonb,
  contractor_brand_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.slug,
    c.name,
    COALESCE(NULLIF(a.company_name, ''), c.company),
    c.city,
    a.tagline,
    a.logo_url,
    a.years_in_business,
    a.specialties,
    CASE
      WHEN jsonb_typeof(a.gallery_urls) = 'array'
        THEN (SELECT COALESCE(jsonb_agg(g.e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(a.gallery_urls) e LIMIT 3) g)
      ELSE '[]'::jsonb
    END,
    a.branding->>'color'
  FROM public.contractors c
  JOIN public.contractor_accounts a ON a.contractor_id = c.id
  WHERE c.slug = _slug
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_front_door_public(text) TO anon, authenticated;

-- ============================================================
-- A visitor starts a project: mint their own invite and return its token.
-- Capped per contractor per hour so a bot can't flood the links list.
-- ============================================================
CREATE OR REPLACE FUNCTION public.open_front_door(_slug text, _source text DEFAULT 'website')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor_id uuid;
  v_owner uuid;
  v_source text := CASE WHEN _source IN ('website', 'google', 'text') THEN _source ELSE 'other' END;
  v_token text;
BEGIN
  SELECT c.id, a.user_id INTO v_contractor_id, v_owner
  FROM public.contractors c
  JOIN public.contractor_accounts a ON a.contractor_id = c.id
  WHERE c.slug = _slug
  LIMIT 1;

  IF v_contractor_id IS NULL THEN
    RAISE EXCEPTION 'front_door_not_found';
  END IF;

  IF (
    SELECT count(*) FROM public.contractor_invites
    WHERE contractor_id = v_contractor_id
      AND source <> 'direct'
      AND created_at > now() - interval '1 hour'
  ) >= 60 THEN
    RAISE EXCEPTION 'front_door_busy';
  END IF;

  INSERT INTO public.contractor_invites (contractor_id, created_by, prospect_label, source)
  VALUES (
    v_contractor_id,
    v_owner,
    CASE v_source
      WHEN 'website' THEN 'From your website'
      WHEN 'google' THEN 'From Google'
      WHEN 'text' THEN 'From a text'
      ELSE 'From your front door'
    END,
    v_source
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_front_door(text, text) TO anon, authenticated;

-- ============================================================
-- The invite page carries the brand color too.
-- ============================================================
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
  contractor_gallery_urls jsonb,
  contractor_brand_color text,
  invite_source text
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
    -- The name they gave their account ("US Creative Builders") over the permit name.
    COALESCE(NULLIF(a.company_name, ''), c.company),
    c.city,
    a.tagline,
    a.logo_url,
    a.years_in_business,
    a.specialties,
    CASE
      WHEN jsonb_typeof(a.gallery_urls) = 'array'
        THEN (SELECT COALESCE(jsonb_agg(g.e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(a.gallery_urls) e LIMIT 3) g)
      ELSE '[]'::jsonb
    END,
    a.branding->>'color',
    i.source
  FROM public.contractor_invites i
  JOIN public.contractors c ON c.id = i.contractor_id
  LEFT JOIN public.contractor_accounts a ON a.contractor_id = c.id
  WHERE i.token = _token
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_public(text) TO anon, authenticated;
