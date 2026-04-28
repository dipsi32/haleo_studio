-- 1. Add 'contractor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contractor';

-- 2. Create contractor_accounts table
CREATE TABLE IF NOT EXISTS public.contractor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  company_name text,
  logo_url text,
  portfolio_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read own account"
  ON public.contractor_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Contractors update own account"
  ON public.contractor_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Contractors insert own account"
  ON public.contractor_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage contractor accounts"
  ON public.contractor_accounts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contractor_accounts_updated_at
  BEFORE UPDATE ON public.contractor_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Update handle_new_user to auto-link contractors by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Founder admin
  IF NEW.email = 'deepa.dinakar@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Link pilot row by email
  UPDATE public.pilot_users
  SET user_id = NEW.id
  WHERE email = NEW.email AND user_id IS NULL;

  -- Auto-link contractor by email
  SELECT id, COALESCE(company, name) INTO matched_contractor_id, matched_contractor_name
  FROM public.contractors
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF matched_contractor_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'contractor')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.contractor_accounts (user_id, contractor_id, company_name)
    VALUES (NEW.id, matched_contractor_id, matched_contractor_name)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;