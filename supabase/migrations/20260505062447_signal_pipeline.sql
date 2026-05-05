-- ─────────────────────────────────────────────────────────────────────────────
-- Trust-signal pipeline: SQL functions + pg_cron
--
-- compute_contractor_signals(id)
--   Cross-references contractor_permits addresses with address_code_violations,
--   computes expired-without-final rate, upserts contractor_trust_signals.
--   Mirrors the normalization in supabase/functions/fetch-sj-violations/index.ts.
--
-- refresh_signals_for_contractors(ids[])
--   Batch wrapper — one call, N contractors. Used by fetch-sj-permits after
--   a permit import so signals are fresh before the next DB read.
--
-- refresh_stale_contractor_signals(max_age_hours)
--   Full sweep: every contractor missing a signals row or last computed
--   > max_age_hours ago. Called weekly by pg_cron.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_contractor_signals(p_contractor_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff              DATE    := (NOW() - INTERVAL '18 months')::DATE;
  v_addresses           TEXT[];
  v_addresses_checked   INTEGER;
  v_open_violations     INTEGER := 0;
  v_addrs_with_viol     INTEGER := 0;
  v_expired             INTEGER := 0;
  v_old_enough          INTEGER := 0;
BEGIN
  -- Normalize permit addresses to match how address_code_violations stores them.
  -- Mirrors TypeScript normalize(): strip ", San Jose..." suffix, collapse
  -- whitespace, lowercase, keep only strings that start with a digit + space.
  SELECT ARRAY_AGG(DISTINCT norm)
  INTO v_addresses
  FROM (
    SELECT
      lower(trim(regexp_replace(
        regexp_replace(address, ',\s*[Ss]an\s+[Jj]ose.*$', '', 'g'),
        '\s+', ' ', 'g'
      ))) AS norm
    FROM contractor_permits
    WHERE contractor_id = p_contractor_id
      AND address IS NOT NULL
      AND address ~ '\S'
  ) sub
  WHERE norm ~ '^\d+\s';

  v_addresses_checked := COALESCE(array_length(v_addresses, 1), 0);

  IF v_addresses_checked > 0 THEN
    SELECT
      COALESCE(SUM(acv.open_case_count), 0),
      COUNT(*) FILTER (WHERE acv.open_case_count > 0)
    INTO v_open_violations, v_addrs_with_viol
    FROM address_code_violations acv
    WHERE acv.address = ANY(v_addresses);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE completed_date IS NULL),
    COUNT(*)
  INTO v_expired, v_old_enough
  FROM contractor_permits
  WHERE contractor_id = p_contractor_id
    AND issued_date IS NOT NULL
    AND issued_date::DATE < v_cutoff;

  INSERT INTO contractor_trust_signals (
    contractor_id,
    open_code_violations,
    addresses_with_violations,
    addresses_checked,
    expired_without_final,
    permits_old_enough,
    last_calculated_at,
    updated_at
  ) VALUES (
    p_contractor_id,
    v_open_violations,
    v_addrs_with_viol,
    v_addresses_checked,
    COALESCE(v_expired, 0),
    COALESCE(v_old_enough, 0),
    NOW(),
    NOW()
  )
  ON CONFLICT (contractor_id) DO UPDATE SET
    open_code_violations      = EXCLUDED.open_code_violations,
    addresses_with_violations = EXCLUDED.addresses_with_violations,
    addresses_checked         = EXCLUDED.addresses_checked,
    expired_without_final     = EXCLUDED.expired_without_final,
    permits_old_enough        = EXCLUDED.permits_old_enough,
    last_calculated_at        = NOW(),
    updated_at                = NOW();
END;
$$;


CREATE OR REPLACE FUNCTION public.refresh_signals_for_contractors(
  p_contractor_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_id    UUID;
BEGIN
  FOREACH v_id IN ARRAY p_contractor_ids LOOP
    PERFORM public.compute_contractor_signals(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.refresh_stale_contractor_signals(
  max_age_hours INTEGER DEFAULT 168
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_id    UUID;
BEGIN
  FOR v_id IN
    SELECT c.id
    FROM contractors c
    LEFT JOIN contractor_trust_signals cts ON cts.contractor_id = c.id
    WHERE cts.contractor_id IS NULL
       OR cts.last_calculated_at < NOW() - (max_age_hours || ' hours')::INTERVAL
    ORDER BY c.permit_count DESC
  LOOP
    PERFORM public.compute_contractor_signals(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;


-- Weekly sweep: Sunday 03:00 UTC.
-- Uses cached address_code_violations data (24h TTL, refreshed on profile views).
SELECT cron.schedule(
  'weekly-contractor-signal-refresh',
  '0 3 * * 0',
  $$SELECT public.refresh_stale_contractor_signals(168)$$
);
