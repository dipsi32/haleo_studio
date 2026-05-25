
-- ============================================================
-- LOCKDOWN: trust/license data tables (writes -> service+admin)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert address violations" ON public.address_code_violations;
DROP POLICY IF EXISTS "Anyone can update address violations" ON public.address_code_violations;
CREATE POLICY "Admins manage address violations" ON public.address_code_violations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert trust signals" ON public.contractor_trust_signals;
DROP POLICY IF EXISTS "Anyone can update trust signals" ON public.contractor_trust_signals;
CREATE POLICY "Admins manage trust signals" ON public.contractor_trust_signals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert import runs" ON public.cslb_import_runs;
DROP POLICY IF EXISTS "Anyone can update import runs" ON public.cslb_import_runs;
DROP POLICY IF EXISTS "Anyone can read import runs" ON public.cslb_import_runs;
CREATE POLICY "Admins manage cslb import runs" ON public.cslb_import_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert cslb licenses" ON public.cslb_licenses;
DROP POLICY IF EXISTS "Anyone can update cslb licenses" ON public.cslb_licenses;
CREATE POLICY "Admins manage cslb licenses" ON public.cslb_licenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert status alerts" ON public.cslb_status_alerts;
DROP POLICY IF EXISTS "Anyone can update status alerts" ON public.cslb_status_alerts;
DROP POLICY IF EXISTS "Anyone can read status alerts" ON public.cslb_status_alerts;
CREATE POLICY "Admins manage cslb status alerts" ON public.cslb_status_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- contractors: scope writes to admin + claimed owner
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert contractors" ON public.contractors;
DROP POLICY IF EXISTS "Anyone can update contractors" ON public.contractors;

CREATE POLICY "Admins manage contractors" ON public.contractors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Claimed owner updates own contractor row" ON public.contractors
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_accounts ca
      WHERE ca.contractor_id = contractors.id
        AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractor_accounts ca
      WHERE ca.contractor_id = contractors.id
        AND ca.user_id = auth.uid()
    )
  );

-- ============================================================
-- contractor_accounts: remove blanket public read
-- ============================================================
DROP POLICY IF EXISTS "Public read contractor profile fields" ON public.contractor_accounts;

-- ============================================================
-- proposal_analyses: scope to owner + assigned contractor
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert proposal analyses" ON public.proposal_analyses;
DROP POLICY IF EXISTS "Anyone can update proposal analyses" ON public.proposal_analyses;
DROP POLICY IF EXISTS "Anyone can read proposal analyses" ON public.proposal_analyses;

CREATE POLICY "Owner reads own proposal analyses" ON public.proposal_analyses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner inserts own proposal analyses" ON public.proposal_analyses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner updates own proposal analyses" ON public.proposal_analyses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Assigned contractor reads proposal analysis" ON public.proposal_analyses
  FOR SELECT TO authenticated
  USING (
    outreach_send_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.outreach_sends s
      JOIN public.contractor_accounts ca ON ca.contractor_id = s.contractor_id
      WHERE s.id = proposal_analyses.outreach_send_id
        AND ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage proposal analyses" ON public.proposal_analyses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- space_analyses: only backend writes; no client access
-- (client never reads/writes this table directly)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create space analyses" ON public.space_analyses;
DROP POLICY IF EXISTS "Anyone can read space analyses" ON public.space_analyses;
DROP POLICY IF EXISTS "Anyone can update space analyses" ON public.space_analyses;

CREATE POLICY "Admins manage space analyses" ON public.space_analyses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- storage: proposals bucket scoped to owner folder
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users read proposals" ON storage.objects;
CREATE POLICY "Owner reads own proposal file" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'proposals'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Authenticated users upload proposals" ON storage.objects;
CREATE POLICY "Owner uploads own proposal file" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proposals'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- revoke EXECUTE on trigger-only definer function
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
