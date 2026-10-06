-- Break the RLS recursion between outreach_sends and outreach_batches.
--
-- 20260526165859 gave each table a policy that sub-selects the other:
--   outreach_batches "Assigned contractor reads batch"  -> reads outreach_sends
--   outreach_sends   "Homeowner reads own batch sends"  -> reads outreach_batches
-- Postgres expands the policies of the table inside each sub-select, so any
-- signed-in SELECT on either table fails with
--   ERROR: infinite recursion detected in policy for relation "outreach_sends"
-- That takes down the contractor inbox and the homeowner's sent-brief views.
--
-- Fix: do the cross-table lookups inside SECURITY DEFINER helpers (which run
-- without RLS), the same pattern as has_role() and current_user_email().
-- The access rules are unchanged: a homeowner sees their own batches and the
-- sends in them; a contractor sees the batches they were sent.

CREATE OR REPLACE FUNCTION public.is_batch_homeowner(_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.outreach_batches b
    WHERE b.id = _batch_id
      AND (
        b.homeowner_user_id = auth.uid()
        OR lower(b.homeowner_email) = lower(public.current_user_email())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_batch_contractor(_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.outreach_sends s
    JOIN public.contractor_accounts ca ON ca.contractor_id = s.contractor_id
    WHERE s.batch_id = _batch_id
      AND ca.user_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_batch_homeowner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_batch_contractor(uuid) TO authenticated;

DROP POLICY IF EXISTS "Assigned contractor reads batch" ON public.outreach_batches;
CREATE POLICY "Assigned contractor reads batch"
ON public.outreach_batches
FOR SELECT
TO authenticated
USING (public.is_batch_contractor(id));

DROP POLICY IF EXISTS "Homeowner reads own batch sends" ON public.outreach_sends;
CREATE POLICY "Homeowner reads own batch sends"
ON public.outreach_sends
FOR SELECT
TO authenticated
USING (public.is_batch_homeowner(batch_id));

DROP POLICY IF EXISTS "Homeowner updates own batch sends" ON public.outreach_sends;
CREATE POLICY "Homeowner updates own batch sends"
ON public.outreach_sends
FOR UPDATE
TO authenticated
USING (public.is_batch_homeowner(batch_id))
WITH CHECK (public.is_batch_homeowner(batch_id));
