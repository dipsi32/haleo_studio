-- Cache for scraped cost-guide ranges (HomeAdvisor, Angi, Cost vs. Value)
CREATE TABLE public.cost_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code text NOT NULL,
  space_type text NOT NULL,
  scope text NOT NULL,
  low numeric NOT NULL,
  high numeric NOT NULL,
  average numeric NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_count int NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zip_code, space_type, scope)
);

CREATE INDEX idx_cost_guide_cache_lookup ON public.cost_guide_cache (zip_code, space_type, scope);

ALTER TABLE public.cost_guide_cache ENABLE ROW LEVEL SECURITY;

-- Read-only for everyone (no PII); writes only from edge functions (service role bypasses RLS)
CREATE POLICY "Cost guide cache readable by all"
  ON public.cost_guide_cache FOR SELECT
  USING (true);

-- Anonymized benchmark corpus from every analyzed proposal — the moat
CREATE TABLE public.proposal_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code text,
  space_type text NOT NULL,
  scope text NOT NULL,
  square_footage int,
  total_cost numeric NOT NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  contractor_name_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_benchmarks_cohort
  ON public.proposal_benchmarks (zip_code, space_type, scope);

ALTER TABLE public.proposal_benchmarks ENABLE ROW LEVEL SECURITY;

-- Aggregate reads only via service role; no direct client reads of individual rows
CREATE POLICY "Benchmarks admin read"
  ON public.proposal_benchmarks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));