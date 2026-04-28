
-- Extend outreach_sends with unlock/pass timestamps
ALTER TABLE public.outreach_sends
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS passed_at timestamptz;

-- Push permission deferred flag on contractors
ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS push_permission_deferred boolean NOT NULL DEFAULT false;

-- ============================================================
-- contractor_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  outreach_send_id uuid,
  type text NOT NULL DEFAULT 'brief_received',
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractor_notifications_contractor ON public.contractor_notifications(contractor_id, created_at DESC);
ALTER TABLE public.contractor_notifications ENABLE ROW LEVEL SECURITY;

-- Contractor can read/update only their own. Identified via contractor_accounts.
CREATE POLICY "Contractors read own notifications"
  ON public.contractor_notifications FOR SELECT
  TO authenticated
  USING (
    contractor_id IN (
      SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Contractors update own notifications"
  ON public.contractor_notifications FOR UPDATE
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

-- Service role inserts via edge functions — public insert allowed (notifications are non-sensitive system rows)
CREATE POLICY "System inserts notifications"
  ON public.contractor_notifications FOR INSERT
  TO public
  WITH CHECK (true);

-- ============================================================
-- contractor_push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractor_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_contractor ON public.contractor_push_subscriptions(contractor_id) WHERE active = true;
ALTER TABLE public.contractor_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own push subs"
  ON public.contractor_push_subscriptions FOR ALL
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

-- ============================================================
-- contractor_payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  outreach_send_id uuid NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text,
  stripe_status text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_send ON public.contractor_payments(outreach_send_id);
ALTER TABLE public.contractor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read own payments"
  ON public.contractor_payments FOR SELECT
  TO authenticated
  USING (
    contractor_id IN (
      SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Contractors insert own payments"
  ON public.contractor_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id IN (
      SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- brief_annotations  (PRIVATE BY DESIGN — admins cannot read)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brief_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  outreach_send_id uuid NOT NULL,
  section_key text NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brief_annotations_lookup ON public.brief_annotations(contractor_id, outreach_send_id);
ALTER TABLE public.brief_annotations ENABLE ROW LEVEL SECURITY;

-- PRIVACY BY DESIGN: only the contractor who wrote the note can read or modify it.
-- No admin role bypass. No homeowner access. No other contractor access.
CREATE POLICY "Contractors read own annotations only"
  ON public.brief_annotations FOR SELECT
  TO authenticated
  USING (
    contractor_id IN (
      SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Contractors insert own annotations only"
  ON public.brief_annotations FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id IN (
      SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Contractors update own annotations only"
  ON public.brief_annotations FOR UPDATE
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

CREATE POLICY "Contractors delete own annotations only"
  ON public.brief_annotations FOR DELETE
  TO authenticated
  USING (
    contractor_id IN (
      SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_brief_annotations_updated
  BEFORE UPDATE ON public.brief_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- homeowner_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.homeowner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outreach_send_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_homeowner_notifications_user ON public.homeowner_notifications(user_id, created_at DESC);
ALTER TABLE public.homeowner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners read own notifications"
  ON public.homeowner_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Homeowners update own notifications"
  ON public.homeowner_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System inserts homeowner notifications"
  ON public.homeowner_notifications FOR INSERT
  TO public
  WITH CHECK (true);

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.contractor_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.homeowner_notifications;
