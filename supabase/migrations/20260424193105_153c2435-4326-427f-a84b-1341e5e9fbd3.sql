-- Helper: return current user's email without exposing auth.users to RLS evaluation
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid()
$$;

-- Replace the policy that referenced auth.users inline (which caused
-- "permission denied for table users" during admin upserts on pilot_users).
DROP POLICY IF EXISTS "Users link own pilot row" ON public.pilot_users;
CREATE POLICY "Users link own pilot row"
ON public.pilot_users
FOR UPDATE
TO authenticated
USING (email = public.current_user_email())
WITH CHECK (email = public.current_user_email());

-- Same treatment for the SELECT policy (uses inline subquery on auth.users).
DROP POLICY IF EXISTS "Users read own pilot row" ON public.pilot_users;
CREATE POLICY "Users read own pilot row"
ON public.pilot_users
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR email = public.current_user_email()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);