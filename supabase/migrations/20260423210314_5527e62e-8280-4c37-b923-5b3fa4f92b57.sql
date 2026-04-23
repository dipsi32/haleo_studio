
-- Canonical CSLB license store (Layer 1 + Layer 2 share this table)
CREATE TABLE IF NOT EXISTS public.cslb_licenses (
  license_number text PRIMARY KEY,
  business_name text,
  licensee_name text,
  license_status text,
  classifications text[],
  issue_date date,
  expiration_date date,
  bond_status text,
  bond_amount numeric,
  workers_comp_status text,
  has_disciplinary_action boolean DEFAULT false,
  disciplinary_notes text,
  data_source text NOT NULL DEFAULT 'fallback', -- firecrawl | bulk_import | fallback
  raw_data jsonb,
  last_verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cslb_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cslb licenses"
  ON public.cslb_licenses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cslb licenses"
  ON public.cslb_licenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cslb licenses"
  ON public.cslb_licenses FOR UPDATE USING (true);

CREATE TRIGGER update_cslb_licenses_updated_at
  BEFORE UPDATE ON public.cslb_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cslb_licenses_status ON public.cslb_licenses(license_status);
CREATE INDEX IF NOT EXISTS idx_cslb_licenses_verified_at ON public.cslb_licenses(last_verified_at);

-- Bulk-import run log
CREATE TABLE IF NOT EXISTS public.cslb_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text,
  records_seen integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  status_changes integer NOT NULL DEFAULT 0,
  errors text,
  status text NOT NULL DEFAULT 'pending', -- pending | running | succeeded | failed
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone
);

ALTER TABLE public.cslb_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read import runs"
  ON public.cslb_import_runs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert import runs"
  ON public.cslb_import_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update import runs"
  ON public.cslb_import_runs FOR UPDATE USING (true);

-- Admin alerts when a surfaced contractor's status changes
CREATE TABLE IF NOT EXISTS public.cslb_status_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number text NOT NULL,
  contractor_id uuid,
  previous_status text,
  new_status text,
  detected_via text NOT NULL DEFAULT 'bulk_import', -- bulk_import | firecrawl
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cslb_status_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read status alerts"
  ON public.cslb_status_alerts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert status alerts"
  ON public.cslb_status_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update status alerts"
  ON public.cslb_status_alerts FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_cslb_status_alerts_acknowledged
  ON public.cslb_status_alerts(acknowledged, created_at DESC);
