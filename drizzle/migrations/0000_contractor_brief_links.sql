-- Contractor-owned brief links.
--
-- A contractor sends a prospect a Haleo link before the site visit. The
-- homeowner completes the normal brief, sees exactly who will receive it,
-- consents, and the brief lands in that contractor's inbox only (and free:
-- the contractor sourced the prospect). The homeowner's own choice of
-- contractor is honored, not re-run, and the brief stays theirs: they can
-- share it with anyone else later from their account.
--
-- Both entry points (homeowner picks contractors / contractor invites
-- homeowner) end in the same outreach_batches -> outreach_sends pipeline.
-- outreach_sends.source says which door a brief came through.

-- ============================================================
-- contractor_invites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  -- 64 bits of randomness; the token is the only secret in the link.
  token text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  -- Contractor's private nickname for the prospect ("Johnsons, Willow Glen").
  -- Never returned by the public RPC below.
  prospect_label text CHECK (prospect_label IS NULL OR char_length(prospect_label) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 days'),
  revoked_at timestamptz,
  first_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  -- Set when the homeowner sends the brief. Plain uuid (no FK) because
  -- outreach_sends.invite_id already points back here.
  outreach_send_id uuid
);

CREATE INDEX IF NOT EXISTS idx_contractor_invites_contractor
  ON public.contractor_invites(contractor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_invites TO authenticated;
GRANT ALL ON public.contractor_invites TO service_role;

ALTER TABLE public.contractor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read own invites"
  ON public.contractor_invites FOR SELECT
  TO authenticated
  USING (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Contractors create own invites"
  ON public.contractor_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Contractors update own invites"
  ON public.contractor_invites FOR UPDATE
  TO authenticated
  USING (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
  )
  WITH CHECK (
    contractor_id IN (SELECT contractor_id FROM public.contractor_accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage invites"
  ON public.contractor_invites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- A contractor may only relabel or revoke an invite. Everything else
-- (opened/completed timestamps, the linked send) is written by the
-- functions below, so a contractor can't fake funnel numbers.
REVOKE UPDATE ON public.contractor_invites FROM authenticated;
GRANT UPDATE (prospect_label, revoked_at) ON public.contractor_invites TO authenticated;

-- ============================================================
-- outreach_sends: which door did this brief come through?
-- ============================================================
ALTER TABLE public.outreach_sends
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'homeowner_match'
    CHECK (source IN ('homeowner_match', 'contractor_invite')),
  ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.contractor_invites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_sends_invite ON public.outreach_sends(invite_id) WHERE invite_id IS NOT NULL;

-- ============================================================
-- contractor_accounts: fit criteria ("buy box") for the deal read
-- { min_budget_k, min_sqft, project_types: [..] }. Owner-editable through
-- the existing "Contractors update own account" policy.
-- ============================================================
ALTER TABLE public.contractor_accounts
  ADD COLUMN IF NOT EXISTS buy_box jsonb;

-- ============================================================
-- Public lookup: who sent this link, and is it still usable?
-- Returns nothing about the prospect or the contractor's private label.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_invite_public(_token text)
RETURNS TABLE (
  status text,
  contractor_id uuid,
  contractor_slug text,
  contractor_name text,
  contractor_company text,
  contractor_city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN i.revoked_at IS NOT NULL THEN 'revoked'
      WHEN i.completed_at IS NOT NULL THEN 'completed'
      WHEN i.expires_at < now() THEN 'expired'
      ELSE 'open'
    END AS status,
    c.id,
    c.slug,
    c.name,
    c.company,
    c.city
  FROM public.contractor_invites i
  JOIN public.contractors c ON c.id = i.contractor_id
  WHERE i.token = _token
  LIMIT 1
$$;

-- ============================================================
-- Funnel ping when the homeowner opens the link.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_invite_opened(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.contractor_invites
  SET first_opened_at = COALESCE(first_opened_at, now()),
      open_count = open_count + 1
  WHERE token = _token
    AND revoked_at IS NULL
    AND expires_at > now()
$$;

-- ============================================================
-- Deliver an invited brief. Runs as definer so the homeowner can't pick a
-- different contractor, skip the invite checks, or mark the brief unlocked
-- on someone else's send. Safe to call twice: the same homeowner re-sending
-- gets the existing send back.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_invited_brief(
  _token text,
  _brief_snapshot jsonb,
  _neighborhood text,
  _homeowner_name text,
  _session_id text,
  _personal_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite public.contractor_invites%ROWTYPE;
  v_contractor public.contractors%ROWTYPE;
  v_batch_id uuid;
  v_send_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _brief_snapshot IS NULL OR jsonb_typeof(_brief_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'invalid_brief';
  END IF;
  IF pg_column_size(_brief_snapshot) > 200000 THEN
    RAISE EXCEPTION 'brief_too_large';
  END IF;

  SELECT * INTO v_invite
  FROM public.contractor_invites
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked';
  END IF;

  IF v_invite.completed_at IS NOT NULL THEN
    -- Same homeowner pressing send again: hand back what already exists.
    IF v_invite.outreach_send_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.outreach_sends s
      JOIN public.outreach_batches b ON b.id = s.batch_id
      WHERE s.id = v_invite.outreach_send_id
        AND b.homeowner_user_id = v_uid
    ) THEN
      RETURN v_invite.outreach_send_id;
    END IF;
    RAISE EXCEPTION 'invite_used';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  SELECT * INTO v_contractor FROM public.contractors WHERE id = v_invite.contractor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  INSERT INTO public.outreach_batches (
    session_id, homeowner_name, homeowner_email, neighborhood,
    brief_snapshot, recipient_count, homeowner_user_id
  )
  VALUES (
    COALESCE(NULLIF(left(_session_id, 80), ''), 'invite'),
    NULLIF(left(_homeowner_name, 120), ''),
    public.current_user_email(),
    NULLIF(left(_neighborhood, 120), ''),
    _brief_snapshot,
    1,
    v_uid
  )
  RETURNING id INTO v_batch_id;

  INSERT INTO public.outreach_sends (
    batch_id, contractor_id, contractor_name, contractor_email, personal_note,
    status, is_simulated, sent_at, unlocked_at, source, invite_id
  )
  VALUES (
    v_batch_id,
    v_contractor.id,
    COALESCE(v_contractor.company, v_contractor.name),
    v_contractor.email,
    NULLIF(left(_personal_note, 500), ''),
    'sent',
    false,
    now(),
    now(),            -- free: the contractor sourced this prospect
    'contractor_invite',
    v_invite.id
  )
  RETURNING id INTO v_send_id;

  UPDATE public.contractor_invites
  SET completed_at = now(), outreach_send_id = v_send_id
  WHERE id = v_invite.id;

  RETURN v_send_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_invited_brief(text, jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_invited_brief(text, jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invite_opened(text) TO anon, authenticated;