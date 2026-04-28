
-- =============================================
-- proposal_analyses table (ClearContract base + Haleo linking columns)
-- =============================================
CREATE TABLE IF NOT EXISTS public.proposal_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE,
  user_id uuid,

  -- ClearContract analysis payload
  contractor_name text,
  total_cost numeric,
  space_type text,
  verdict text,
  pricing_data jsonb DEFAULT '{}'::jsonb,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  file_path text,
  tier text DEFAULT 'free',
  risk_score integer,
  risk_breakdown jsonb DEFAULT '{}'::jsonb,
  roadmap jsonb DEFAULT '[]'::jsonb,
  next_actions jsonb DEFAULT '[]'::jsonb,
  permit_data jsonb DEFAULT '{}'::jsonb,
  license_data jsonb DEFAULT '{}'::jsonb,

  -- Haleo linking columns (new)
  outreach_send_id uuid,
  brief_id uuid,
  contractor_id uuid,
  red_flags jsonb DEFAULT '[]'::jsonb,
  pushback_language jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  analysis_jsonb jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_analyses_user_id ON public.proposal_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_analyses_outreach_send_id ON public.proposal_analyses(outreach_send_id);
CREATE INDEX IF NOT EXISTS idx_proposal_analyses_brief_id ON public.proposal_analyses(brief_id);

ALTER TABLE public.proposal_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read proposal analyses"
ON public.proposal_analyses FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can insert proposal analyses"
ON public.proposal_analyses FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update proposal analyses"
ON public.proposal_analyses FOR UPDATE TO public USING (true);

CREATE TRIGGER update_proposal_analyses_updated_at
BEFORE UPDATE ON public.proposal_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- outreach_sends new columns
-- =============================================
ALTER TABLE public.outreach_sends
  ADD COLUMN IF NOT EXISTS proposal_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_pdf_url text,
  ADD COLUMN IF NOT EXISTS proposal_structured jsonb,
  ADD COLUMN IF NOT EXISTS proposal_source text,
  ADD COLUMN IF NOT EXISTS proposal_analysis_id uuid,
  ADD COLUMN IF NOT EXISTS homeowner_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS homeowner_approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_outreach_sends_proposal_analysis_id
  ON public.outreach_sends(proposal_analysis_id);

-- =============================================
-- activity_logs (used by useActivityTracker)
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  action text NOT NULL DEFAULT 'visit',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own activity"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own activity"
ON public.activity_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- proposals storage bucket (private)
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposals', 'proposals', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users upload proposals"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proposals');

CREATE POLICY "Authenticated users read proposals"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proposals');

CREATE POLICY "Authenticated users update own proposals"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'proposals' AND auth.uid()::text = (storage.foldername(name))[1]);
