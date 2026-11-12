-- Claiming a contractor profile, done on the server.
--
-- The old claim flow wrote to public.contractors from the browser. Since
-- the May row-level-security lockdown those writes silently did nothing:
-- the profile never linked to the new account, the contractor role was
-- never granted, and /pro/links (their own link) stayed out of reach.
--
-- claim_contractor_profile() does the whole claim in one place, after the
-- person has signed in with their email:
--   1. checks the license number against the profile (on the server, not
--      just in the browser); for profiles built from permit records with no
--      license on file, records the one they give for an admin to confirm,
--   2. refuses if another account already holds this profile,
--   3. links the account, grants the contractor role, marks it claimed and
--      sets the email Haleo uses to reach them.
--
-- It also closes a gap: a signed-in user could point their own
-- contractor_accounts row at any contractor and read that contractor's
-- leads. Only this function (or an admin) can set contractor_id now.

-- The license number a claimant gave for a profile that came from city
-- permit records without one. Kept apart from license_number, which the
-- permit import uses as the record's key. An admin can confirm it with CSLB.
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS claimed_license_number text;

CREATE OR REPLACE FUNCTION public.claim_contractor_profile(_contractor_id uuid, _license text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_row public.contractors%ROWTYPE;
  v_holder uuid;
  v_entered text;
  v_on_file text;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.contractors WHERE id = _contractor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_entered := regexp_replace(coalesce(_license, ''), '\D', '', 'g');
  v_on_file := regexp_replace(coalesce(v_row.license_number, ''), '\D', '', 'g');
  IF coalesce(v_row.license_number, '') !~ '^[0-9][0-9 -]*$' THEN
    -- Profiles built from city permit records carry a placeholder
    -- ("SJ-BAKHTIARY-MEHDI") instead of a license number. The claimant
    -- supplies it; it must look like a CSLB number and not belong to another
    -- profile. Stored as claimed_license_number for an admin to confirm.
    IF v_entered !~ '^[0-9]{5,8}$' THEN
      RAISE EXCEPTION 'license_mismatch';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.contractors
      WHERE (license_number = v_entered OR claimed_license_number = v_entered) AND id <> _contractor_id
    ) THEN
      RAISE EXCEPTION 'license_in_use';
    END IF;
    UPDATE public.contractors SET claimed_license_number = v_entered WHERE id = _contractor_id;
  ELSIF v_entered = '' OR v_entered <> v_on_file THEN
    RAISE EXCEPTION 'license_mismatch';
  END IF;

  SELECT user_id INTO v_holder
  FROM public.contractor_accounts
  WHERE contractor_id = _contractor_id AND user_id <> v_uid
  LIMIT 1;
  IF v_holder IS NOT NULL THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  INSERT INTO public.contractor_accounts (user_id, contractor_id, company_name)
  VALUES (v_uid, _contractor_id, coalesce(nullif(v_row.company, ''), v_row.name))
  ON CONFLICT (user_id) DO UPDATE
    SET contractor_id = EXCLUDED.contractor_id,
        company_name = coalesce(public.contractor_accounts.company_name, EXCLUDED.company_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'contractor')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.contractors
  SET claimed = true,
      claimed_at = coalesce(claimed_at, now()),
      claim_completed_at = coalesce(claim_completed_at, now()),
      notification_email = coalesce(nullif(v_email, ''), notification_email),
      notification_preference = coalesce(notification_preference, 'email')
  WHERE id = _contractor_id;

  RETURN v_row.slug;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_contractor_profile(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_contractor_profile(uuid, text) TO authenticated;

-- ============================================================
-- Only the claim function or an admin can attach an account to a
-- contractor. Everything else about the account stays the owner's to edit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_contractor_account_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (
       (TG_OP = 'INSERT' AND NEW.contractor_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.contractor_id IS DISTINCT FROM OLD.contractor_id)
     ) THEN
    RAISE EXCEPTION 'contractor_link_locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_contractor_account_link ON public.contractor_accounts;
CREATE TRIGGER guard_contractor_account_link
  BEFORE INSERT OR UPDATE ON public.contractor_accounts
  FOR EACH ROW EXECUTE FUNCTION public.guard_contractor_account_link();
