CREATE TABLE public.parcel_permit_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address_key text NOT NULL UNIQUE,
  street text,
  city text,
  state text,
  zip text,
  apn text,
  lat double precision,
  lng double precision,
  permits jsonb NOT NULL DEFAULT '[]'::jsonb,
  inspections jsonb NOT NULL DEFAULT '[]'::jsonb,
  contractors jsonb NOT NULL DEFAULT '[]'::jsonb,
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  permit_count integer NOT NULL DEFAULT 0,
  open_permit_count integer NOT NULL DEFAULT 0,
  expired_without_final_count integer NOT NULL DEFAULT 0,
  most_recent_permit_date date,
  oldest_permit_date date,
  lookup_succeeded boolean NOT NULL DEFAULT false,
  raw_response jsonb DEFAULT '{}'::jsonb,
  last_checked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.parcel_permit_history TO anon;
GRANT SELECT, INSERT, UPDATE ON public.parcel_permit_history TO authenticated;
GRANT ALL ON public.parcel_permit_history TO service_role;

ALTER TABLE public.parcel_permit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read parcel history"
  ON public.parcel_permit_history FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert parcel history"
  ON public.parcel_permit_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update parcel history"
  ON public.parcel_permit_history FOR UPDATE
  USING (true);

CREATE TRIGGER update_parcel_permit_history_updated_at
  BEFORE UPDATE ON public.parcel_permit_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_parcel_permit_history_apn ON public.parcel_permit_history(apn);