// Fetches San Jose code-enforcement complaints for each address a contractor
// has worked at, using the city's public ArcGIS REST endpoint.
//
// Source: https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_PermitsAndComplaints/MapServer/1
// (Layer 1 = "Code Complaints (Open)" — currently-open enforcement cases)
//
// Flow per contractor:
//   1. Pull distinct job-site addresses from contractor_permits
//   2. For each, check address_code_violations cache (30-day TTL)
//   3. Cache miss → query ArcGIS where LOCATION LIKE '<street#> <street name>%'
//   4. Aggregate counts → upsert contractor_trust_signals
//
// All requests are read-only against a public dataset; no API key needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_LAYER =
  "https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_PermitsAndComplaints/MapServer/1/query";

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

type CodeCase = {
  open_date: string | null;
  close_date: string | null;
  disposition: string | null;
  case_status: string | null;
  violation_type: string | null;
  description: string | null;
  raw_location: string | null;
};

type AddressResult = {
  address: string;
  open_case_count: number;
  most_recent_open_date: string | null;
  violation_types: string[];
  cases: CodeCase[];
  from_cache: boolean;
};

// Normalize "123 MAIN ST" → "123 main st" (lowercased, single-spaced).
// We use only the street number + name as a LIKE prefix because the city's
// LOCATION field appends ", San Jose CA <zip>" which our permits don't have.
const normalizeForLike = (raw: string): string | null => {
  if (!raw) return null;
  // Strip trailing city/state/zip if present, collapse whitespace
  const cleaned = raw
    .replace(/,\s*san\s*jose.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  // Must start with a street number — otherwise the LIKE will be too broad
  if (!/^\d+\s/.test(cleaned)) return null;
  return cleaned.toLowerCase();
};

// Build SQL `where` clause. ArcGIS `LIKE` is case-insensitive when wrapped
// in UPPER(). We escape single quotes by doubling them.
const buildWhere = (addressPrefix: string): string => {
  const safe = addressPrefix.replace(/'/g, "''");
  return `UPPER(LOCATION) LIKE UPPER('${safe}%')`;
};

const queryArcgis = async (whereClause: string): Promise<Record<string, unknown>[]> => {
  const params = new URLSearchParams({
    where: whereClause,
    outFields: "LOCATION,OPENDATE,CLOSEDATE,DISPOSITION,CASESTATUS,VIOLATIONTYPE,DESCRIPTION",
    returnGeometry: "false",
    resultRecordCount: "50",
    f: "json",
  });
  const url = `${ARCGIS_LAYER}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Haleo/1.0 (contractor trust signals)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`ArcGIS ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`ArcGIS error: ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  return (data.features ?? []).map((f: { attributes: Record<string, unknown> }) => f.attributes);
};

const toIsoDate = (epochMs: unknown): string | null => {
  if (typeof epochMs !== "number") return null;
  return new Date(epochMs).toISOString().slice(0, 10);
};

const fetchForAddress = async (
  supabase: ReturnType<typeof createClient>,
  rawAddress: string,
): Promise<AddressResult | null> => {
  const prefix = normalizeForLike(rawAddress);
  if (!prefix) return null;

  // Check cache
  const { data: cached } = await supabase
    .from("address_code_violations")
    .select("*")
    .eq("address", prefix)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.last_checked_at).getTime() < CACHE_TTL_MS) {
    return {
      address: prefix,
      open_case_count: cached.open_case_count ?? 0,
      most_recent_open_date: cached.most_recent_open_date,
      violation_types: cached.violation_types ?? [],
      cases: (cached.raw_cases ?? []) as CodeCase[],
      from_cache: true,
    };
  }

  // Cache miss → query the city
  let attrs: Record<string, unknown>[] = [];
  try {
    attrs = await queryArcgis(buildWhere(prefix));
  } catch (e) {
    console.warn(`ArcGIS lookup failed for ${prefix}:`, e instanceof Error ? e.message : e);
    return null;
  }

  const cases: CodeCase[] = attrs.map(a => ({
    open_date: toIsoDate(a.OPENDATE),
    close_date: toIsoDate(a.CLOSEDATE),
    disposition: (a.DISPOSITION as string) ?? null,
    case_status: (a.CASESTATUS as string) ?? null,
    violation_type: (a.VIOLATIONTYPE as string) ?? null,
    description: (a.DESCRIPTION as string) ?? null,
    raw_location: (a.LOCATION as string) ?? null,
  }));

  // Layer is "Open" cases — but we still defensively filter on case_status
  const openCases = cases.filter(c => (c.case_status ?? "").toUpperCase() === "OPEN");
  const types = Array.from(
    new Set(openCases.map(c => c.violation_type).filter((v): v is string => !!v)),
  );
  const dates = openCases.map(c => c.open_date).filter((d): d is string => !!d).sort();
  const mostRecent = dates.length > 0 ? dates[dates.length - 1] : null;

  // Upsert cache
  await supabase
    .from("address_code_violations")
    .upsert(
      {
        address: prefix,
        open_case_count: openCases.length,
        most_recent_open_date: mostRecent,
        violation_types: types,
        raw_cases: cases,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "address" },
    );

  return {
    address: prefix,
    open_case_count: openCases.length,
    most_recent_open_date: mostRecent,
    violation_types: types,
    cases,
    from_cache: false,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contractor_id, address, force } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Single-address mode (debugging)
    if (address && !contractor_id) {
      const result = await fetchForAddress(supabase, address);
      return new Response(JSON.stringify({ ok: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contractor_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "contractor_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull this contractor's job-site addresses (most recent first, capped)
    const { data: permits, error: pErr } = await supabase
      .from("contractor_permits")
      .select("address, issued_date, completed_date")
      .eq("contractor_id", contractor_id)
      .not("address", "is", null)
      .order("issued_date", { ascending: false })
      .limit(50);
    if (pErr) throw pErr;

    const distinctAddresses = Array.from(
      new Set(
        (permits ?? [])
          .map(p => (p.address ?? "").trim())
          .filter(a => a.length > 5),
      ),
    ).slice(0, 15); // hard cap — 15 addresses keeps latency under ~5s

    // If forcing a refresh, blow away the cache rows for these prefixes first
    if (force) {
      const prefixes = distinctAddresses
        .map(normalizeForLike)
        .filter((p): p is string => !!p);
      if (prefixes.length > 0) {
        await supabase
          .from("address_code_violations")
          .update({ last_checked_at: new Date(0).toISOString() })
          .in("address", prefixes);
      }
    }

    // Run lookups serially to avoid hammering the city's server
    const results: AddressResult[] = [];
    for (const addr of distinctAddresses) {
      const r = await fetchForAddress(supabase, addr);
      if (r) results.push(r);
    }

    // Compute "expired without final" from existing permit data:
    // permits older than 18 months with no completed_date.
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
    const { data: oldPermits } = await supabase
      .from("contractor_permits")
      .select("issued_date, completed_date")
      .eq("contractor_id", contractor_id)
      .not("issued_date", "is", null)
      .lt("issued_date", eighteenMonthsAgo.toISOString().slice(0, 10));
    const permitsOldEnough = (oldPermits ?? []).length;
    const expiredWithoutFinal = (oldPermits ?? []).filter(p => !p.completed_date).length;

    const totalOpenCases = results.reduce((s, r) => s + r.open_case_count, 0);
    const addressesWithViolations = results.filter(r => r.open_case_count > 0).length;

    // Upsert rollup
    await supabase
      .from("contractor_trust_signals")
      .upsert(
        {
          contractor_id,
          open_code_violations: totalOpenCases,
          addresses_with_violations: addressesWithViolations,
          addresses_checked: results.length,
          expired_without_final: expiredWithoutFinal,
          permits_old_enough: permitsOldEnough,
          last_calculated_at: new Date().toISOString(),
        },
        { onConflict: "contractor_id" },
      );

    return new Response(
      JSON.stringify({
        ok: true,
        contractor_id,
        addresses_checked: results.length,
        open_code_violations: totalOpenCases,
        addresses_with_violations: addressesWithViolations,
        expired_without_final: expiredWithoutFinal,
        permits_old_enough: permitsOldEnough,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("fetch-sj-violations error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
