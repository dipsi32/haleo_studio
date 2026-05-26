
-- outreach_batches: remove public read, scope to owner / assigned contractor / admin
DROP POLICY IF EXISTS "Anyone can read batches" ON public.outreach_batches;

CREATE POLICY "Homeowner reads own batch"
ON public.outreach_batches
FOR SELECT
TO authenticated
USING (
  homeowner_user_id = auth.uid()
  OR lower(homeowner_email) = lower(public.current_user_email())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Assigned contractor reads batch"
ON public.outreach_batches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.outreach_sends s
    JOIN public.contractor_accounts ca ON ca.contractor_id = s.contractor_id
    WHERE s.batch_id = outreach_batches.id
      AND ca.user_id = auth.uid()
  )
);

-- outreach_sends: remove public read & public update
DROP POLICY IF EXISTS "Anyone can read sends" ON public.outreach_sends;
DROP POLICY IF EXISTS "Anyone can update sends" ON public.outreach_sends;

CREATE POLICY "Assigned contractor reads send"
ON public.outreach_sends
FOR SELECT
TO authenticated
USING (
  contractor_id IN (
    SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Homeowner reads own batch sends"
ON public.outreach_sends
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.outreach_batches b
    WHERE b.id = outreach_sends.batch_id
      AND (
        b.homeowner_user_id = auth.uid()
        OR lower(b.homeowner_email) = lower(public.current_user_email())
      )
  )
);

CREATE POLICY "Assigned contractor updates send"
ON public.outreach_sends
FOR UPDATE
TO authenticated
USING (
  contractor_id IN (
    SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  contractor_id IN (
    SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Homeowner updates own batch sends"
ON public.outreach_sends
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.outreach_batches b
    WHERE b.id = outreach_sends.batch_id
      AND (
        b.homeowner_user_id = auth.uid()
        OR lower(b.homeowner_email) = lower(public.current_user_email())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.outreach_batches b
    WHERE b.id = outreach_sends.batch_id
      AND (
        b.homeowner_user_id = auth.uid()
        OR lower(b.homeowner_email) = lower(public.current_user_email())
      )
  )
);

CREATE POLICY "Admins manage outreach sends"
ON public.outreach_sends
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
