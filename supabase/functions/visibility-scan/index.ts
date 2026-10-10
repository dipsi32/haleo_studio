// Visibility scan: where does this contractor show up when a homeowner searches
// for a general contractor or a remodel in their city?
//
// Three sources, each measured the way its owner allows:
//   - Google: Places API text search (the order Google returns for the query).
//   - Yelp: Fusion API business search, best_match order.
//   - AI assistants: each model is asked the same homeowner question several
//     times and we count how often the business is named. This is the model's
//     answer from memory, not a live web search, and the UI says so.
// Angi has no public API, so it is not measured and we don't guess.
//
// A channel without credentials reports "unavailable" instead of failing, so
// the dashboard never shows a number we didn't measure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildQueries, findMatch, normalizeName, type Target } from "../_shared/visibility.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COOLDOWN_HOURS = 12;
const AI_RUNS_PER_QUERY = 4;
const AI_MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini" },
  { id: "openai/gpt-5-mini", label: "ChatGPT" },
];

type Listing = { name: string; rating: number | null; reviews: number | null; url: string | null; phone?: string | null; website?: string | null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const publicListing = (l: Listing) => ({ name: l.name, rating: l.rating, reviews: l.reviews, url: l.url });

function searchPerQuery(q: { key: string; text: string }, list: Listing[], target: Target) {
  const m = findMatch(target, list);
  return {
    key: q.key,
    text: q.text,
    rank: m.index >= 0 ? m.index + 1 : null,
    total: list.length,
    confidence: m.confidence,
    listing: m.index >= 0 ? publicListing(list[m.index]) : null,
    // Never list the contractor as their own rival.
    top: list.filter((_, i) => i !== m.index).slice(0, 5).map(publicListing),
  };
}

async function googleSearch(text: string, key: string): Promise<Listing[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({ textQuery: text, pageSize: 20 }),
  });
  if (!r.ok) throw new Error(`google ${r.status}`);
  const j = await r.json();
  return (j.places ?? []).map((p: any) => ({
    name: p.displayName?.text ?? "",
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    url: p.googleMapsUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
  }));
}

async function yelpSearch(term: string, city: string, key: string): Promise<Listing[]> {
  const u = new URL("https://api.yelp.com/v3/businesses/search");
  u.searchParams.set("term", term);
  u.searchParams.set("location", city);
  u.searchParams.set("categories", "contractors,generalcontractors,homeservices");
  u.searchParams.set("sort_by", "best_match");
  u.searchParams.set("limit", "20");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`yelp ${r.status}`);
  const j = await r.json();
  return (j.businesses ?? []).map((b: any) => ({
    name: b.name ?? "",
    rating: b.rating ?? null,
    reviews: b.review_count ?? null,
    url: b.url ?? null,
    phone: b.phone ?? null,
  }));
}

async function askModel(model: string, question: string, key: string): Promise<string[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You answer homeowners' questions about hiring local contractors. Reply with ONLY a JSON array of up to 5 business names you would recommend, best first. No other text. If you do not know of specific businesses, reply [].",
        },
        { role: "user", content: question },
      ],
    }),
  });
  if (!r.ok) throw new Error(`ai ${model} ${r.status}`);
  const j = await r.json();
  const text: string = j.choices?.[0]?.message?.content ?? "[]";
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Who is asking? The contractor is derived from the caller's own account,
    // never from the request body.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "not_signed_in" }, 401);

    const { data: acct } = await admin
      .from("contractor_accounts")
      .select("contractor_id, company_name, phone, website, specialties")
      .eq("user_id", userId)
      .maybeSingle();
    if (!acct?.contractor_id) return json({ error: "no_contractor_account" }, 403);

    const { data: c } = await admin
      .from("contractors")
      .select("id, name, company, city, phone, website, specialty")
      .eq("id", acct.contractor_id)
      .maybeSingle();
    if (!c) return json({ error: "contractor_not_found" }, 404);

    // Cost control: one scan per cooldown window.
    const { data: last } = await admin
      .from("visibility_scans")
      .select("created_at")
      .eq("contractor_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      const next = new Date(last.created_at).getTime() + COOLDOWN_HOURS * 3_600_000;
      if (Date.now() < next) return json({ error: "cooldown", next_allowed_at: new Date(next).toISOString() }, 429);
    }

    const city = (c.city ?? "").trim() || "San Jose";
    const queries = buildQueries(city, `${acct.specialties ?? ""} ${c.specialty ?? ""}`);
    const target: Target = {
      names: [c.company, c.name, acct.company_name].filter((x): x is string => !!x && !!x.trim()),
      phone: acct.phone ?? c.phone,
      website: acct.website ?? c.website,
    };

    const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const yelpKey = Deno.env.get("YELP_API_KEY");
    const aiKey = Deno.env.get("LOVABLE_API_KEY");

    const searchChannel = async (
      keyPresent: boolean,
      reason: string,
      fetcher: (q: { key: string; text: string }) => Promise<Listing[]>,
    ) => {
      if (!keyPresent) return { status: "unavailable", reason };
      try {
        const lists = await Promise.all(queries.map((q) => fetcher(q)));
        return { status: "ok", perQuery: queries.map((q, i) => searchPerQuery(q, lists[i], target)) };
      } catch (e) {
        console.error("search channel failed", e);
        return { status: "unavailable", reason: "The service didn't answer. Try again later." };
      }
    };

    const aiChannel = async () => {
      if (!aiKey) return { status: "unavailable", reason: "Not connected yet." };
      try {
        const models = await Promise.all(
          AI_MODELS.map(async (m) => {
            const perQuery = await Promise.all(
              queries.map(async (q) => {
                const question = `I'm a homeowner in ${city} planning a big project. ${q.text.charAt(0).toUpperCase()}${q.text.slice(1)}: who would you recommend?`;
                const runs = await Promise.all(
                  Array.from({ length: AI_RUNS_PER_QUERY }, () => askModel(m.id, question, aiKey).catch(() => null)),
                );
                const ok = runs.filter((r): r is string[] => r !== null);
                const tally = new Map<string, { name: string; count: number }>();
                let mentioned = 0;
                for (const names of ok) {
                  const hit = findMatch(target, names.map((name) => ({ name })));
                  if (hit.index >= 0 && hit.confidence !== "none") mentioned++;
                  names.forEach((n, i) => {
                    if (i === hit.index) return;
                    const k = normalizeName(n).join(" ");
                    if (!k) return;
                    const cur = tally.get(k);
                    if (cur) cur.count++;
                    else tally.set(k, { name: n, count: 1 });
                  });
                }
                return {
                  key: q.key,
                  text: q.text,
                  runs: ok.length,
                  mentioned,
                  named: [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 5),
                };
              }),
            );
            return { id: m.id, label: m.label, perQuery };
          }),
        );
        return { status: "ok", models };
      } catch (e) {
        console.error("ai channel failed", e);
        return { status: "unavailable", reason: "The service didn't answer. Try again later." };
      }
    };

    const [google, yelp, ai] = await Promise.all([
      searchChannel(!!googleKey, "Not connected yet.", (q) => googleSearch(q.text, googleKey!)),
      searchChannel(!!yelpKey, "Not connected yet.", (q) => yelpSearch(q.text, city, yelpKey!)),
      aiChannel(),
    ]);

    const results = { city, queries, google, yelp, ai };
    const { data: row, error } = await admin
      .from("visibility_scans")
      .insert({ contractor_id: c.id, city, results })
      .select("id, contractor_id, created_at, city, results")
      .single();
    if (error) throw error;

    return json({ scan: row });
  } catch (e) {
    console.error("visibility-scan error", e);
    return json({ error: "scan_failed" }, 500);
  }
});
