// Phase 1.5 — Parcel permit history lookup.
// Public function (verify_jwt = false). Given a street+city+state+zip, finds
// the parcel (APN) via the SJ permits dataset and pulls the full permit history
// for that parcel: every permit, every contractor, every open/finaled status.
// Cached in public.parcel_permit_history keyed on normalized address.
//
// Data source: data.sanjoseca.gov CKAN datastore, resource
// 761b7ae8-3be1-4ad6-923d-c7af6404a904 (active SJ building permits, ~20 yrs).
// Each row has ASSESSORS_PARCEL_NUMBER, so we resolve address -> APN -> full
// permit history.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SJ_RESOURCE = "761b7ae8-3be1-4ad6-923d-c7af6404a904";
const SJ_API = "https://data.sanjoseca.gov/api/3/action/datastore_search";
const SJ_SQL = "https://data.sanjoseca.gov/api/3/action/datastore_search_sql";

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface SJRecord {
  Status?: string;
  gx_location?: string;
  ASSESSORS_PARCEL_NUMBER?: string | null;
  CONTRACTOR?: string | null;
  FOLDERNUMBER?: string;
  FOLDERDESC?: string;
  SUBTYPEDESCRIPTION?: string;
  WORKDESCRIPTION?: string;
  ISSUEDATE?: string;
  FINALDATE?: string | null;
  PERMITVALUATION?: string;
}

function normalizeKey(a: Address): string {
  return [a.street, a.city, a.state, a.zip]
    .map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

const parseDate = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const parseLocation = (loc?: string): { address: string | null; zip: string | null } => {
  if (!loc) return { address: null, zip: null };
  const parts = loc.trim().split(",").map((p) => p.trim());
  const address = parts[0] && parts[0] !== "" ? parts[0].replace(/\s+/g, " ") : null;
  const last = parts[parts.length - 1] ?? "";
  const zipMatch = last.match(/(\d{5})(?:-\d{4})?/);
  return { address, zip: zipMatch ? zipMatch[1] : null };
};

const parseContractor = (raw?: string | null): string | null => {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^APPLICANT\/CONTRACTOR/i.test(t)) return null;
  if (/^OWNER[\s/]/i.test(t)) return null;
  return t.split(/\s{2,}/)[0]?.trim() ?? null;
};

// "1234 Main St" -> { num: "1234", street: "main st" }
function parseStreet(street?: string): { num: string; rest: string } | null {
  if (!street) return null;
  const m = street.trim().match(/^(\d+\w?)\s+(.+)$/);
  if (!m) return null;
  return { num: m[1], rest: m[2].toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "") };
}

function streetMatches(parsed: ReturnType<typeof parseStreet>, candidate: string | null): boolean {
  if (!parsed || !candidate) return false;
  const c = candidate.toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
  if (!c.startsWith(parsed.num + " ") && c !== parsed.num) return false;
  // first significant word of street name must appear
  const firstWord = parsed.rest.split(" ")[0];
  return c.includes(firstWord);
}

async function searchByAddressText(q: string, limit = 100): Promise<SJRecord[]> {
  const url = `${SJ_API}?resource_id=${SJ_RESOURCE}&q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = await res.json();
  if (!json.success) return [];
  return (json.result?.records ?? []) as SJRecord[];
}

async function searchByApn(apn: string, limit = 200): Promise<SJRecord[]> {
  // Use SQL endpoint for an exact-APN query.
  const sql = `SELECT * FROM "${SJ_RESOURCE}" WHERE "ASSESSORS_PARCEL_NUMBER" = '${apn.replace(/'/g, "''")}' LIMIT ${limit}`;
  const url = `${SJ_SQL}?sql=${encodeURIComponent(sql)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.success) return [];
    return (json.result?.records ?? []) as SJRecord[];
  } catch {
    return [];
  }
}

function isOpen(r: SJRecord): boolean {
  if (parseDate(r.FINALDATE)) return false;
  const s = (r.Status ?? "").toLowerCase();
  if (/final|closed|complete|withdrawn|expired|cancel/.test(s)) return false;
  return true;
}

function isExpiredWithoutFinal(r: SJRecord): boolean {
  if (parseDate(r.FINALDATE)) return false;
  const s = (r.Status ?? "").toLowerCase();
  if (/expired/.test(s)) return true;
  // Heuristic: issued >2 years ago, no final, status not active
  const issued = parseDate(r.ISSUEDATE);
  if (!issued) return false;
  const ageMs = Date.now() - new Date(issued).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 365 * 2 && !/active|issued|in review/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const address: Address = body.address ?? {};
    const force = body.force === true;

    if (!address.street || !address.city) {
      return new Response(JSON.stringify({ error: "address.street and address.city required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = normalizeKey(address);

    if (!force) {
      const { data: cached } = await supabase
        .from("parcel_permit_history")
        .select("*")
        .eq("address_key", key)
        .maybeSingle();
      if (cached) {
        return new Response(JSON.stringify({ cached: true, history: cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Only SJ today.
    const cityOk = (address.city ?? "").toLowerCase().includes("san jose");
    if (!cityOk) {
      const row = {
        address_key: key,
        street: address.street ?? null,
        city: address.city ?? null,
        state: address.state ?? null,
        zip: address.zip ?? null,
        lookup_succeeded: false,
        raw_response: { error: "out_of_coverage" },
      };
      await supabase.from("parcel_permit_history").upsert(row, { onConflict: "address_key" });
      return new Response(JSON.stringify({ cached: false, history: row }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Resolve APN from address text search.
    const parsed = parseStreet(address.street);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "could_not_parse_street" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = await searchByAddressText(`${parsed.num} ${parsed.rest.split(" ")[0]}`, 200);
    const addressHits = candidates.filter((r) => {
      const parsedLoc = parseLocation(r.gx_location);
      return streetMatches(parsed, parsedLoc.address);
    });

    // Pick the most common APN among hits.
    const apnCounts = new Map<string, number>();
    for (const r of addressHits) {
      const apn = (r.ASSESSORS_PARCEL_NUMBER ?? "").trim();
      if (apn) apnCounts.set(apn, (apnCounts.get(apn) ?? 0) + 1);
    }
    let apn: string | null = null;
    let max = 0;
    for (const [a, n] of apnCounts.entries()) {
      if (n > max) { max = n; apn = a; }
    }

    // 2. If we got an APN, pull the full parcel history.
    let allRecords: SJRecord[] = addressHits;
    if (apn) {
      const parcelRecords = await searchByApn(apn, 200);
      if (parcelRecords.length) {
        // Merge & dedupe by FOLDERNUMBER
        const seen = new Set<string>();
        const merged: SJRecord[] = [];
        for (const r of [...parcelRecords, ...addressHits]) {
          const k = r.FOLDERNUMBER ?? JSON.stringify(r);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
        }
        allRecords = merged;
      }
    }

    // 3. Build normalized permit objects.
    const permits = allRecords.map((r) => ({
      permit_number: r.FOLDERNUMBER ?? null,
      type: r.FOLDERDESC ?? null,
      subtype: r.SUBTYPEDESCRIPTION ?? null,
      description: r.WORKDESCRIPTION ?? null,
      contractor: parseContractor(r.CONTRACTOR),
      valuation: r.PERMITVALUATION ? Number(r.PERMITVALUATION) : null,
      issued_date: parseDate(r.ISSUEDATE),
      final_date: parseDate(r.FINALDATE),
      status: r.Status ?? null,
      is_open: isOpen(r),
      is_expired_without_final: isExpiredWithoutFinal(r),
    }));

    const contractors = Array.from(
      new Set(permits.map((p) => p.contractor).filter(Boolean) as string[]),
    );

    const openCount = permits.filter((p) => p.is_open).length;
    const expiredCount = permits.filter((p) => p.is_expired_without_final).length;
    const dates = permits.map((p) => p.issued_date).filter(Boolean) as string[];
    dates.sort();
    const oldest = dates[0] ?? null;
    const newest = dates[dates.length - 1] ?? null;

    // Also pull cached code violations for this address (best-effort).
    let violations: Array<Record<string, unknown>> = [];
    if (address.street) {
      const addrPattern = `${parsed.num} ${parsed.rest.split(" ")[0]}`;
      const { data: vs } = await supabase
        .from("address_code_violations")
        .select("address, open_case_count, violation_types, most_recent_open_date")
        .ilike("address", `${addrPattern}%`)
        .limit(5);
      violations = vs ?? [];
    }

    const row = {
      address_key: key,
      street: address.street ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      zip: address.zip ?? null,
      apn,
      permits,
      contractors,
      violations,
      permit_count: permits.length,
      open_permit_count: openCount,
      expired_without_final_count: expiredCount,
      most_recent_permit_date: newest,
      oldest_permit_date: oldest,
      lookup_succeeded: true,
      raw_response: { resolved_apn: apn, address_hit_count: addressHits.length },
      last_checked_at: new Date().toISOString(),
    };

    const { data: saved, error: saveErr } = await supabase
      .from("parcel_permit_history")
      .upsert(row, { onConflict: "address_key" })
      .select()
      .single();

    if (saveErr) {
      return new Response(JSON.stringify({ cached: false, history: row, save_error: saveErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ cached: false, history: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    console.error("lookup-parcel-history failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
