-- 1. Add columns to contractors
ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS claimed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_preference text CHECK (notification_preference IN ('email','sms')),
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS notification_phone text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invitation_source text CHECK (invitation_source IN ('admin_sms','admin_email','homeowner_referral','contractor_referral','direct')),
  ADD COLUMN IF NOT EXISTS profile_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_brief_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_brief_unlocked_at timestamptz;

CREATE INDEX IF NOT EXISTS contractors_slug_idx ON public.contractors(slug);

-- 2. Slug generator: lowercase, hyphenated company name + last-4 of license
CREATE OR REPLACE FUNCTION public.generate_contractor_slug(_name text, _license text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base text;
  tail text;
BEGIN
  base := lower(coalesce(_name, 'contractor'));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF base = '' THEN base := 'contractor'; END IF;
  tail := right(regexp_replace(coalesce(_license,''), '[^0-9]', '', 'g'), 4);
  IF tail = '' THEN tail := substr(md5(coalesce(_license,_name,'x')),1,4); END IF;
  RETURN base || '-' || tail;
END;
$$;

-- 3. Trigger to auto-fill slug
CREATE OR REPLACE FUNCTION public.set_contractor_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempt int := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;
  candidate := public.generate_contractor_slug(coalesce(NEW.company, NEW.name), NEW.license_number);
  WHILE EXISTS (SELECT 1 FROM public.contractors WHERE slug = candidate AND id <> coalesce(NEW.id, gen_random_uuid())) LOOP
    attempt := attempt + 1;
    candidate := public.generate_contractor_slug(coalesce(NEW.company, NEW.name), NEW.license_number) || '-' || attempt::text;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractors_set_slug ON public.contractors;
CREATE TRIGGER contractors_set_slug
  BEFORE INSERT OR UPDATE OF company, name, license_number ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.set_contractor_slug();

-- 4. Backfill slugs for existing rows (touch each row so trigger fires)
DO $$
DECLARE r record; candidate text; attempt int;
BEGIN
  FOR r IN SELECT id, company, name, license_number FROM public.contractors WHERE slug IS NULL LOOP
    attempt := 0;
    candidate := public.generate_contractor_slug(coalesce(r.company, r.name), r.license_number);
    WHILE EXISTS (SELECT 1 FROM public.contractors WHERE slug = candidate) LOOP
      attempt := attempt + 1;
      candidate := public.generate_contractor_slug(coalesce(r.company, r.name), r.license_number) || '-' || attempt::text;
    END LOOP;
    UPDATE public.contractors SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- After backfill, enforce NOT NULL
ALTER TABLE public.contractors ALTER COLUMN slug SET NOT NULL;

-- 5. Update handle_new_user to also flip claimed flag + claim timestamps when a user signs up matching a contractor email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_contractor_id uuid;
  matched_contractor_name text;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.email = 'deepa.dinakar@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.pilot_users
  SET user_id = NEW.id
  WHERE email = NEW.email AND user_id IS NULL;

  SELECT id, COALESCE(company, name) INTO matched_contractor_id, matched_contractor_name
  FROM public.contractors
  WHERE lower(email) = lower(NEW.email)
     OR lower(notification_email) = lower(NEW.email)
  LIMIT 1;

  IF matched_contractor_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'contractor')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.contractor_accounts (user_id, contractor_id, company_name)
    VALUES (NEW.id, matched_contractor_id, matched_contractor_name)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.contractors
    SET claimed = true,
        claimed_at = COALESCE(claimed_at, now()),
        claim_completed_at = COALESCE(claim_completed_at, now())
    WHERE id = matched_contractor_id;
  END IF;

  RETURN NEW;
END;
$$;