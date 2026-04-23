-- Contractors discovered via permit data
CREATE TABLE public.contractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company TEXT,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  city TEXT,
  state TEXT DEFAULT 'CA',
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  permit_count INTEGER NOT NULL DEFAULT 0,
  last_permit_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_contractors_zip ON public.contractors(zip);
CREATE INDEX idx_contractors_specialty ON public.contractors(specialty);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read contractors" ON public.contractors FOR SELECT USING (true);
CREATE POLICY "Anyone can insert contractors" ON public.contractors FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update contractors" ON public.contractors FOR UPDATE USING (true);

CREATE TRIGGER update_contractors_updated_at
BEFORE UPDATE ON public.contractors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permits pulled by contractors
CREATE TABLE public.contractor_permits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  permit_number TEXT NOT NULL,
  work_type TEXT,
  description TEXT,
  valuation NUMERIC,
  address TEXT,
  city TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  issued_date DATE,
  completed_date DATE,
  status TEXT,
  source TEXT NOT NULL DEFAULT 'san_jose',
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source, permit_number)
);
CREATE INDEX idx_permits_contractor ON public.contractor_permits(contractor_id);
CREATE INDEX idx_permits_zip ON public.contractor_permits(zip);
CREATE INDEX idx_permits_issued ON public.contractor_permits(issued_date DESC);
CREATE INDEX idx_permits_work_type ON public.contractor_permits(work_type);

ALTER TABLE public.contractor_permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read permits" ON public.contractor_permits FOR SELECT USING (true);
CREATE POLICY "Anyone can insert permits" ON public.contractor_permits FOR INSERT WITH CHECK (true);

-- CSLB license verification cache (24h)
CREATE TABLE public.contractor_license_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_number TEXT NOT NULL UNIQUE,
  status TEXT,
  business_name TEXT,
  classifications TEXT[],
  issue_date DATE,
  expiration_date DATE,
  has_disciplinary_action BOOLEAN DEFAULT false,
  disciplinary_notes TEXT,
  workers_comp_status TEXT,
  bond_status TEXT,
  raw_response JSONB,
  scrape_succeeded BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_license_cache_number ON public.contractor_license_cache(license_number);

ALTER TABLE public.contractor_license_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read license cache" ON public.contractor_license_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert license cache" ON public.contractor_license_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update license cache" ON public.contractor_license_cache FOR UPDATE USING (true);

CREATE TRIGGER update_license_cache_updated_at
BEFORE UPDATE ON public.contractor_license_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Outreach batches (one per multi-contractor send action)
CREATE TABLE public.outreach_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  homeowner_name TEXT,
  homeowner_email TEXT,
  neighborhood TEXT,
  brief_snapshot JSONB NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_session ON public.outreach_batches(session_id);

ALTER TABLE public.outreach_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read batches" ON public.outreach_batches FOR SELECT USING (true);
CREATE POLICY "Anyone can insert batches" ON public.outreach_batches FOR INSERT WITH CHECK (true);

-- Outreach sends (one per contractor per batch)
CREATE TABLE public.outreach_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.outreach_batches(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  contractor_name TEXT,
  contractor_email TEXT,
  personal_note TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  is_simulated BOOLEAN NOT NULL DEFAULT true,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_sends_batch ON public.outreach_sends(batch_id);
CREATE INDEX idx_sends_contractor ON public.outreach_sends(contractor_id);

ALTER TABLE public.outreach_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sends" ON public.outreach_sends FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sends" ON public.outreach_sends FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sends" ON public.outreach_sends FOR UPDATE USING (true);

CREATE TRIGGER update_sends_updated_at
BEFORE UPDATE ON public.outreach_sends
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();