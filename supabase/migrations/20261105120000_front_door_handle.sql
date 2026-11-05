-- A front-door link a contractor is proud to share:
--   haleo.pages.dev/us-creative-builders   (from the name on their account)
--   haleo.pages.dev/uscb                   (or one they choose)
-- instead of /c/bakhtiary-mehdi-1d0f. The old /c/:slug links keep working.

-- "US Creative Builders" -> "us-creative-builders". Stable, so it can be
-- compared in a WHERE clause.
CREATE OR REPLACE FUNCTION public.front_door_key(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(trim(BOTH '-' FROM regexp_replace(lower(coalesce(_name, '')), '[^a-z0-9]+', '-', 'g')), '')
$$;

-- The name a contractor chose. Lowercase letters, digits and single hyphens,
-- 3 to 40 characters. Unique across contractors.
ALTER TABLE public.contractor_accounts
  ADD COLUMN IF NOT EXISTS front_door_handle text;

ALTER TABLE public.contractor_accounts
  DROP CONSTRAINT IF EXISTS contractor_accounts_front_door_handle_check;
ALTER TABLE public.contractor_accounts
  ADD CONSTRAINT contractor_accounts_front_door_handle_check
  CHECK (front_door_handle IS NULL OR front_door_handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(front_door_handle) BETWEEN 3 AND 40);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_accounts_front_door_handle_key
  ON public.contractor_accounts (front_door_handle)
  WHERE front_door_handle IS NOT NULL;

-- Which contractor a front-door link names. A chosen handle wins, then the
-- name on their account, then the permit-record slug of old links. Only
-- contractors with an account have a front door.
CREATE OR REPLACE FUNCTION public.resolve_front_door(_key text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.contractors c
  JOIN public.contractor_accounts a ON a.contractor_id = c.id
  WHERE a.front_door_handle = lower(_key)
     OR c.slug = _key
     OR public.front_door_key(a.company_name) = lower(_key)
  ORDER BY (a.front_door_handle = lower(_key)) DESC NULLS LAST,
           (c.slug = _key) DESC NULLS LAST,
           a.created_at ASC
  LIMIT 1
$$;

-- The public view of a front door now takes any of those names.
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
  WHERE c.id = public.resolve_front_door(_slug)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_front_door_public(text) TO anon, authenticated;

-- Starting a project resolves the same way. Everything else is unchanged
-- from 20261103120000 (owner, hourly cap, source labels).
CREATE OR REPLACE FUNCTION public.open_front_door(_slug text, _source text DEFAULT 'website')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor_id uuid := public.resolve_front_door(_slug);
  v_owner uuid;
  v_source text := CASE WHEN _source IN ('website', 'google', 'text') THEN _source ELSE 'other' END;
  v_token text;
BEGIN
  IF v_contractor_id IS NULL THEN
    RAISE EXCEPTION 'front_door_not_found';
  END IF;

  SELECT a.user_id INTO v_owner
  FROM public.contractor_accounts a
  WHERE a.contractor_id = v_contractor_id
  ORDER BY a.created_at ASC
  LIMIT 1;

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
      ELSE 'From your link'
    END,
    v_source
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_front_door(text, text) TO anon, authenticated;
