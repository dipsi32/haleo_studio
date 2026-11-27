-- "Which city next?": people outside San José vote for their city.
-- The tally is the demand map. Rows are private (emails live here); the
-- public sees totals only, through city_vote_tally().

CREATE TABLE IF NOT EXISTS public.city_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 60),
  state text CHECK (state IS NULL OR state ~ '^[A-Z]{2}$'),
  -- One key per city however it's typed ("palo alto|CA"), set by the app (src/lib/cityNext.ts).
  city_key text NOT NULL CHECK (char_length(city_key) BETWEEN 3 AND 70),
  zip text CHECK (zip IS NULL OR zip ~ '^\d{5}$'),
  email text CHECK (email IS NULL OR (char_length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  role text CHECK (role IS NULL OR role IN ('homeowner', 'contractor', 'realtor', 'other')),
  source text CHECK (source IS NULL OR char_length(source) <= 30),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.city_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can vote for a city" ON public.city_votes;
CREATE POLICY "Anyone can vote for a city"
  ON public.city_votes FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read city votes" ON public.city_votes;
CREATE POLICY "Admins read city votes"
  ON public.city_votes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS city_votes_city_key ON public.city_votes (city_key);
-- One vote per email per city (votes without an email aren't deduplicated).
CREATE UNIQUE INDEX IF NOT EXISTS city_votes_one_per_email ON public.city_votes (lower(email), city_key) WHERE email IS NOT NULL;

-- The public leaderboard: counts only, never who voted.
CREATE OR REPLACE FUNCTION public.city_vote_tally(max_rows integer DEFAULT 50)
RETURNS TABLE (city text, state text, city_key text, votes bigint, total_votes bigint, total_cities bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH grouped AS (
    SELECT
      mode() WITHIN GROUP (ORDER BY v.city) AS city,
      mode() WITHIN GROUP (ORDER BY v.state) AS state,
      v.city_key,
      count(*) AS votes,
      max(v.created_at) AS latest
    FROM public.city_votes v
    GROUP BY v.city_key
  )
  SELECT g.city, g.state, g.city_key, g.votes,
         sum(g.votes) OVER ()::bigint AS total_votes,
         count(*) OVER ()::bigint AS total_cities
  FROM grouped g
  ORDER BY g.votes DESC, g.latest DESC
  LIMIT least(greatest(coalesce(max_rows, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.city_vote_tally(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.city_vote_tally(integer) TO anon, authenticated;
