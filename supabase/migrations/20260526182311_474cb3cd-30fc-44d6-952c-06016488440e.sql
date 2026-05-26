CREATE TABLE public.address_risk_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address_key text NOT NULL UNIQUE,
  street text,
  city text,
  state text,
  zip text,
  lat double precision,
  lng double precision,
  fire_hazard_zone text,
  fire_hazard_class text,
  flood_zone text,
  flood_zone_description text,
  in_special_flood_hazard_area boolean DEFAULT false,
  seismic_hazard_zone text,
  seismic_hazard_type text,
  raw_response jsonb DEFAULT '{}'::jsonb,
  lookup_succeeded boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_address_risk_signals_address_key ON public.address_risk_signals(address_key);

GRANT SELECT, INSERT, UPDATE ON public.address_risk_signals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.address_risk_signals TO authenticated;
GRANT ALL ON public.address_risk_signals TO service_role;

ALTER TABLE public.address_risk_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read address risk signals"
  ON public.address_risk_signals FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert address risk signals"
  ON public.address_risk_signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update address risk signals"
  ON public.address_risk_signals FOR UPDATE
  USING (true);

CREATE TRIGGER update_address_risk_signals_updated_at
  BEFORE UPDATE ON public.address_risk_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();