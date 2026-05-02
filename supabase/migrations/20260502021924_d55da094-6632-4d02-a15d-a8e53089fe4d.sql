
CREATE TABLE public.address_code_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  open_case_count INTEGER NOT NULL DEFAULT 0,
  most_recent_open_date DATE,
  violation_types TEXT[] DEFAULT '{}',
  raw_cases JSONB DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_address_code_violations_address ON public.address_code_violations (lower(address));

ALTER TABLE public.address_code_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read address violations"
  ON public.address_code_violations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert address violations"
  ON public.address_code_violations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update address violations"
  ON public.address_code_violations FOR UPDATE
  USING (true);


CREATE TABLE public.contractor_trust_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL UNIQUE,
  open_code_violations INTEGER NOT NULL DEFAULT 0,
  addresses_with_violations INTEGER NOT NULL DEFAULT 0,
  addresses_checked INTEGER NOT NULL DEFAULT 0,
  expired_without_final INTEGER NOT NULL DEFAULT 0,
  permits_old_enough INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_trust_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trust signals"
  ON public.contractor_trust_signals FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert trust signals"
  ON public.contractor_trust_signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update trust signals"
  ON public.contractor_trust_signals FOR UPDATE
  USING (true);

CREATE TRIGGER set_contractor_trust_signals_updated_at
  BEFORE UPDATE ON public.contractor_trust_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
