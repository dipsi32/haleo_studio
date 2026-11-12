-- Pilot measurement: what we need to answer the launch scorecard.
--
--   1. Did we capture all eligible inquiries?       weekly inquiry count vs links used
--   2. Did homeowners participate without friction? link views → starts → sends, ease
--   3. Did contractors take a specific next step?   pursue / clarify / pass per brief
--   4. Better than their normal intake?             compared with the baseline taken at kickoff
--   5. Less effort, fewer late mismatches?          effort answer, how the visit matched the brief
--   6. Business and homeowner experience healthy?   won / lost / value, homeowner ease
--   7. Did they use it again, and pay?              active weeks, would-pay answer, paying
--
-- Everything is a one-tap answer in the product, stored here, and rolled up
-- for admins by admin_pilot_scorecard(). Nothing in it rates a homeowner.

-- ============================================================
-- The pilot itself: who, since when, and their numbers before Haleo.
-- Admin-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractor_pilots (
  contractor_id uuid PRIMARY KEY REFERENCES public.contractors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'paused', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  -- Their normal intake, asked at kickoff, all per month unless noted:
  -- inquiries, visits, jobs_won, minutes_per_lead (texts + calls before a
  -- visit), late_mismatches_per_10_visits.
  baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_offered_monthly numeric CHECK (price_offered_monthly IS NULL OR price_offered_monthly >= 0),
  paying_since timestamptz,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_pilots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pilots" ON public.contractor_pilots;
CREATE POLICY "Admins manage pilots" ON public.contractor_pilots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- What the contractor did with each brief. One row per brief, filled in
-- over time: the call (pursue / clarify / pass), whether it saved effort,
-- how the visit matched the brief, and how it ended.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brief_outcomes (
  outreach_send_id uuid PRIMARY KEY REFERENCES public.outreach_sends(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  decision text CHECK (decision IN ('pursue', 'clarify', 'pass')),
  decision_reasons text[] NOT NULL DEFAULT '{}',
  decided_at timestamptz,
  effort text CHECK (effort IN ('saved_a_lot', 'saved_some', 'no_difference', 'more_work')),
  visit_match text CHECK (visit_match IN ('as_expected', 'small_surprise', 'big_mismatch', 'no_visit')),
  mismatch_note text CHECK (mismatch_note IS NULL OR char_length(mismatch_note) <= 300),
  visit_reported_at timestamptz,
  result text CHECK (result IN ('won', 'lost', 'open')),
  contract_value_k numeric CHECK (contract_value_k IS NULL OR (contract_value_k >= 0 AND contract_value_k < 100000)),
  result_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_outcomes_contractor ON public.brief_outcomes(contractor_id);

ALTER TABLE public.brief_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractor reads own outcomes" ON public.brief_outcomes;
CREATE POLICY "Contractor reads own outcomes" ON public.brief_outcomes
  FOR SELECT TO authenticated
  USING (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- A contractor writes outcomes only for briefs that were sent to them.
DROP POLICY IF EXISTS "Contractor writes own outcomes" ON public.brief_outcomes;
CREATE POLICY "Contractor writes own outcomes" ON public.brief_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.outreach_sends s WHERE s.id = outreach_send_id AND s.contractor_id = brief_outcomes.contractor_id)
  );

DROP POLICY IF EXISTS "Contractor updates own outcomes" ON public.brief_outcomes;
CREATE POLICY "Contractor updates own outcomes" ON public.brief_outcomes
  FOR UPDATE TO authenticated
  USING (contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()))
  WITH CHECK (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.outreach_sends s WHERE s.id = outreach_send_id AND s.contractor_id = brief_outcomes.contractor_id)
  );

DROP POLICY IF EXISTS "Admins manage outcomes" ON public.brief_outcomes;
CREATE POLICY "Admins manage outcomes" ON public.brief_outcomes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- What the contractor tells us outside a single brief: how many inquiries
-- came in this week (any channel, so we know what Haleo didn't see), and
-- whether they'd pay to keep it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractor_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('weekly_inquiries', 'would_pay', 'comment')),
  -- weekly_inquiries: {inquiries, sent_link}; would_pay: {answer: yes|maybe|no, price}; comment: {text}
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  week_start date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pg_column_size(value) < 4000)
);

-- One weekly count per contractor per week (week_start is null for the
-- other kinds, and nulls never collide).
CREATE UNIQUE INDEX IF NOT EXISTS uq_contractor_feedback_week
  ON public.contractor_feedback(contractor_id, kind, week_start);

ALTER TABLE public.contractor_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractor reads own feedback" ON public.contractor_feedback;
CREATE POLICY "Contractor reads own feedback" ON public.contractor_feedback
  FOR SELECT TO authenticated
  USING (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Contractor writes own feedback" ON public.contractor_feedback;
CREATE POLICY "Contractor writes own feedback" ON public.contractor_feedback
  FOR INSERT TO authenticated
  WITH CHECK (contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Contractor updates own feedback" ON public.contractor_feedback;
CREATE POLICY "Contractor updates own feedback" ON public.contractor_feedback
  FOR UPDATE TO authenticated
  USING (contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()))
  WITH CHECK (contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid()));

-- ============================================================
-- How the homeowner found it: one tap after sending.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.homeowner_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_send_id uuid REFERENCES public.outreach_sends(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  ease text NOT NULL CHECK (ease IN ('easy', 'okay', 'hard')),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homeowner_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Homeowner leaves feedback" ON public.homeowner_feedback;
CREATE POLICY "Homeowner leaves feedback" ON public.homeowner_feedback
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- They can add a note to the rating they just left, and nothing else.
DROP POLICY IF EXISTS "Homeowner reads own feedback" ON public.homeowner_feedback;
CREATE POLICY "Homeowner reads own feedback" ON public.homeowner_feedback
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Homeowner adds a note" ON public.homeowner_feedback;
CREATE POLICY "Homeowner adds a note" ON public.homeowner_feedback
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins read homeowner feedback" ON public.homeowner_feedback;
CREATE POLICY "Admins read homeowner feedback" ON public.homeowner_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- The homeowner funnel: link seen → started → sent.
-- ============================================================
ALTER TABLE public.contractor_invites ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_invite_started(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.contractor_invites
  SET started_at = COALESCE(started_at, now())
  WHERE token = _token AND revoked_at IS NULL AND expires_at > now()
$$;
GRANT EXECUTE ON FUNCTION public.mark_invite_started(text) TO anon, authenticated;

-- Front-door page views, one counter per contractor per day.
CREATE TABLE IF NOT EXISTS public.front_door_views (
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (contractor_id, day)
);
ALTER TABLE public.front_door_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read front door views" ON public.front_door_views;
CREATE POLICY "Admins read front door views" ON public.front_door_views
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.mark_front_door_viewed(_contractor_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.front_door_views (contractor_id, day, views)
  SELECT _contractor_id, current_date, 1
  WHERE EXISTS (SELECT 1 FROM public.contractor_accounts WHERE contractor_id = _contractor_id)
  ON CONFLICT (contractor_id, day) DO UPDATE SET views = public.front_door_views.views + 1
$$;
GRANT EXECUTE ON FUNCTION public.mark_front_door_viewed(uuid) TO anon, authenticated;

-- ============================================================
-- The scorecard: raw counts per pilot contractor since their start.
-- The app turns these into the seven answers (src/lib/pilotScorecard.ts).
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_pilot_scorecard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(r) ORDER BY r.started_at), '[]'::jsonb) INTO v_out
  FROM (
    SELECT
      p.contractor_id,
      coalesce(nullif(c.company, ''), c.name) AS name,
      c.slug,
      c.claimed,
      p.status,
      p.started_at,
      p.baseline,
      p.price_offered_monthly,
      p.paying_since,
      -- Q1
      (SELECT coalesce(sum((f.value->>'inquiries')::numeric), 0) FROM contractor_feedback f
        WHERE f.contractor_id = p.contractor_id AND f.kind = 'weekly_inquiries' AND f.created_at >= p.started_at) AS inquiries_reported,
      (SELECT coalesce(sum((f.value->>'sent_link')::numeric), 0) FROM contractor_feedback f
        WHERE f.contractor_id = p.contractor_id AND f.kind = 'weekly_inquiries' AND f.created_at >= p.started_at) AS links_reported,
      (SELECT count(*) FROM contractor_feedback f
        WHERE f.contractor_id = p.contractor_id AND f.kind = 'weekly_inquiries' AND f.created_at >= p.started_at) AS weeks_reported,
      -- Q2
      (SELECT coalesce(sum(v.views), 0) FROM front_door_views v WHERE v.contractor_id = p.contractor_id AND v.day >= p.started_at::date) AS front_door_views,
      (SELECT count(*) FROM contractor_invites i WHERE i.contractor_id = p.contractor_id AND i.source = 'direct' AND i.created_at >= p.started_at) AS links_made,
      (SELECT count(*) FROM contractor_invites i WHERE i.contractor_id = p.contractor_id AND i.source = 'direct' AND i.first_opened_at IS NOT NULL AND i.created_at >= p.started_at) AS links_opened,
      (SELECT count(*) FROM contractor_invites i WHERE i.contractor_id = p.contractor_id AND i.created_at >= p.started_at
        AND (i.started_at IS NOT NULL OR i.source <> 'direct')) AS intakes_started,
      (SELECT count(*) FROM outreach_sends s WHERE s.contractor_id = p.contractor_id AND s.source = 'contractor_invite' AND s.created_at >= p.started_at) AS briefs_sent,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (i.completed_at - coalesce(i.started_at, i.created_at))) / 60)
        FROM contractor_invites i WHERE i.contractor_id = p.contractor_id AND i.completed_at IS NOT NULL AND i.created_at >= p.started_at) AS median_minutes_to_send,
      (SELECT jsonb_build_object(
          'easy', count(*) FILTER (WHERE h.ease = 'easy'),
          'okay', count(*) FILTER (WHERE h.ease = 'okay'),
          'hard', count(*) FILTER (WHERE h.ease = 'hard'))
        FROM homeowner_feedback h WHERE h.contractor_id = p.contractor_id AND h.created_at >= p.started_at) AS homeowner_ease,
      -- Q3, Q5, Q6
      (SELECT jsonb_build_object(
          'decided', count(*) FILTER (WHERE o.decision IS NOT NULL),
          'pursue', count(*) FILTER (WHERE o.decision = 'pursue'),
          'clarify', count(*) FILTER (WHERE o.decision = 'clarify'),
          'pass', count(*) FILTER (WHERE o.decision = 'pass'),
          'median_hours_to_decision', percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (o.decided_at - s.created_at)) / 3600)
            FILTER (WHERE o.decided_at IS NOT NULL),
          'effort_answers', count(*) FILTER (WHERE o.effort IS NOT NULL),
          'saved_a_lot', count(*) FILTER (WHERE o.effort = 'saved_a_lot'),
          'saved_some', count(*) FILTER (WHERE o.effort = 'saved_some'),
          'no_difference', count(*) FILTER (WHERE o.effort = 'no_difference'),
          'more_work', count(*) FILTER (WHERE o.effort = 'more_work'),
          'visits', count(*) FILTER (WHERE o.visit_match IN ('as_expected', 'small_surprise', 'big_mismatch')),
          'as_expected', count(*) FILTER (WHERE o.visit_match = 'as_expected'),
          'small_surprise', count(*) FILTER (WHERE o.visit_match = 'small_surprise'),
          'big_mismatch', count(*) FILTER (WHERE o.visit_match = 'big_mismatch'),
          'won', count(*) FILTER (WHERE o.result = 'won'),
          'lost', count(*) FILTER (WHERE o.result = 'lost'),
          'open', count(*) FILTER (WHERE o.result = 'open'),
          'won_value_k', coalesce(sum(o.contract_value_k) FILTER (WHERE o.result = 'won'), 0))
        FROM brief_outcomes o JOIN outreach_sends s ON s.id = o.outreach_send_id
        WHERE o.contractor_id = p.contractor_id AND s.created_at >= p.started_at) AS outcomes,
      -- Q7
      (SELECT count(DISTINCT date_trunc('week', t.ts)) FROM (
          SELECT i.created_at AS ts FROM contractor_invites i WHERE i.contractor_id = p.contractor_id AND i.source = 'direct' AND i.created_at >= p.started_at
          UNION ALL SELECT s.created_at FROM outreach_sends s WHERE s.contractor_id = p.contractor_id AND s.source = 'contractor_invite' AND s.created_at >= p.started_at
          UNION ALL SELECT o.decided_at FROM brief_outcomes o WHERE o.contractor_id = p.contractor_id AND o.decided_at >= p.started_at
        ) t) AS active_weeks,
      (SELECT max(t.ts) FROM (
          SELECT i.created_at AS ts FROM contractor_invites i WHERE i.contractor_id = p.contractor_id
          UNION ALL SELECT s.created_at FROM outreach_sends s WHERE s.contractor_id = p.contractor_id
          UNION ALL SELECT o.updated_at FROM brief_outcomes o WHERE o.contractor_id = p.contractor_id
        ) t) AS last_activity,
      (SELECT f.value FROM contractor_feedback f WHERE f.contractor_id = p.contractor_id AND f.kind = 'would_pay'
        ORDER BY f.created_at DESC LIMIT 1) AS would_pay
    FROM public.contractor_pilots p
    JOIN public.contractors c ON c.id = p.contractor_id
  ) r;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pilot_scorecard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pilot_scorecard() TO authenticated;

-- Row-level security above decides who sees what; these grants just let
-- signed-in users reach the tables at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_pilots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.brief_outcomes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contractor_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeowner_feedback TO authenticated;
GRANT SELECT ON public.front_door_views TO authenticated;
