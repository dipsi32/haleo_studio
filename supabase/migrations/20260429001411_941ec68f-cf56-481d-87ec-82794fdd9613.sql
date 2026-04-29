
ALTER TABLE public.outreach_batches
  ADD COLUMN IF NOT EXISTS homeowner_user_id uuid;

CREATE TABLE IF NOT EXISTS public.brief_clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_send_id uuid NOT NULL,
  contractor_id uuid NOT NULL,
  homeowner_user_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('contractor','homeowner')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brief_clarifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read own brief clarifications"
  ON public.brief_clarifications FOR SELECT TO authenticated
  USING (contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Contractors send own brief clarifications"
  ON public.brief_clarifications FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'contractor'
    AND contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Homeowners read own brief clarifications"
  ON public.brief_clarifications FOR SELECT TO authenticated
  USING (homeowner_user_id = auth.uid());

CREATE POLICY "Homeowners reply on own brief clarifications"
  ON public.brief_clarifications FOR INSERT TO authenticated
  WITH CHECK (sender_role = 'homeowner' AND homeowner_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_brief_clarifications_send ON public.brief_clarifications(outreach_send_id, created_at);
