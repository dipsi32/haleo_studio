// SJ Code Enforcement — bulk snapshot strategy.
//
// The city's ArcGIS REST endpoint is fast for full-table dumps (no LIKE),
// but very slow when you ask for `LIKE 'street%'` queries because there's
// no index on the LOCATION text field.
//
// So we pull ALL currently-open code-complaint cases (~8k rows citywide)
// in one go, store one row per address in `address_code_violations`, and
// then per-contractor lookups become a fast indexed query against our
// own DB on `lower(address)`.
//
// Modes (POST body):
//   { "snapshot": true }                  → re-pull the full open-cases set
//                                           (skipped if the cache is < 24h old
//                                            unless `force: true`)
//   { "contractor_id": "<uuid>" }         → run snapshot if stale, then return
//                                           per-contractor aggregates

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_LAYER =
  "https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_PermitsAndComplaints/MapServer/1/query";

const SNAPSHOT_TTL_MS = 24 * 3600 * 1000; // 24h

type CodeCase = {
  open_date: string | null;
  close_date: string | null;
  disposition: string | null;
  case_status: string | null;
  violation_type: string | null;
  description: string | null;
};

const toIsoDate = (epochMs: unknown): string | null => {
  if (typeof epochMs !== "number") return null;
  return new Date(epochMs).toISOString().slice(0, 10);
};

// Normalize "1713 CANNA LN" or "1713 Canna Ln, San Jose CA 95124-1234"
// → "1713 canna ln" (lowercased, single-spaced, city/zip stripped).
const normalize = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const cleaned = raw
    .replace(/,\s*san\s*jose.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned || !/^\d+\s/.test(cleaned)) return null;
  return cleaned;
};

// Fetch one page with retry on transient failures.
const fetchPage = async (offset: number, page: number) => {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "LOCATION,OPENDATE,CLOSEDATE,DISPOSITION,CASESTATUS,VIOLATIONTYPE,DESCRIPTION",
    returnGeometry: "false",
    orderByFields: "OBJECTID",
    resultOffset: String(offset),
    resultRecordCount: String(page),
    f: "json",
  });
  const url = `${ARCGIS_LAYER}?${params.toString()}`;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Haleo/1.0 (contractor trust signals)" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);
      return data;
    } catch (e) {
      lastErr = e;
      console.log(`page ${offset} attempt ${attempt + 1} failed:`, e);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error("ArcGIS unknown error");
};

// Pull every page of the open-cases layer.
const fetchAllOpenCases = async (): Promise<{ address: string; case: CodeCase }[]> => {
  const all: { address: string; case: CodeCase }[] = [];
  let offset = 0;
  const PAGE = 1000; // smaller pages → fewer ArcGIS timeouts
  while (true) {
    const data = await fetchPage(offset, PAGE);
    const features: { attributes: Record<string, unknown> }[] = data.features ?? [];
    for (const f of features) {
      const a = f.attributes;
      const address = normalize(a.LOCATION as string);
      if (!address) continue;
      all.push({
        address,
        case: {
          open_date: toIsoDate(a.OPENDATE),
          close_date: toIsoDate(a.CLOSEDATE),
          disposition: (a.DISPOSITION as string) ?? null,
          case_status: (a.CASESTATUS as string) ?? null,
          violation_type: (a.VIOLATIONTYPE as string) ?? null,
          description: (a.DESCRIPTION as string) ?? null,
        },
      });
    }
    console.log(`fetched offset=${offset} count=${features.length} total=${all.length}`);
    if (!data.exceededTransferLimit || features.length < PAGE) break;
    offset += PAGE;
    if (offset > 50_000) break; // safety
  }
  return all;
};

// Group by address and upsert in batches.
const writeSnapshot = async (
  supabase: ReturnType<typeof createClient>,
  cases: { address: string; case: CodeCase }[],
): Promise<{ addresses: number }> => {
  const byAddr = new Map<string, CodeCase[]>();
  for (const { address, case: c } of cases) {
    if (!byAddr.has(address)) byAddr.set(address, []);
    byAddr.get(address)!.push(c);
  }

  const now = new Date().toISOString();
  const rows = Array.from(byAddr.entries()).map(([address, list]) => {
    const open = list.filter(c => (c.case_status ?? "").toUpperCase() === "OPEN");
    const dates = open.map(c => c.open_date).filter((d): d is string => !!d).sort();
    const types = Array.from(
      new Set(open.map(c => c.violation_type).filter((v): v is string => !!v)),
    );
    return {
      address,
      open_case_count: open.length,
      most_recent_open_date: dates.length ? dates[dates.length - 1] : null,
      violation_types: types,
      raw_cases: list,
      last_checked_at: now,
    };
  });

  // Upsert in chunks of 500 to stay under request size limits
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("address_code_violations")
      .upsert(chunk, { onConflict: "address" });
    if (error) throw error;
  }
  return { addresses: rows.length };
};

const isSnapshotFresh = async (supabase: ReturnType<typeof createClient>): Promise<boolean> => {
  const { data } = await supabase
    .from("address_code_violations")
    .select("last_checked_at")
    .order("last_checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  return Date.now() - new Date(data.last_checked_at).getTime() < SNAPSHOT_TTL_MS;
};

const computeContractorSignals = async (
  supabase: ReturnType<typeof createClient>,
  contractor_id: string,
) => {
  const { data: permits } = await supabase
    .from("contractor_permits")
    .select("address, issued_date, completed_date")
    .eq("contractor_id", contractor_id)
    .not("address", "is", null);

  const distinct = Array.from(
    new Set(
      (permits ?? [])
        .map(p => normalize(p.address))
        .filter((a): a is string => !!a),
    ),
  );

  let openCodeViolations = 0;
  let addressesWithViolations = 0;
  const violationDetails: { address: string; open_case_count: number; types: string[] }[] = [];

  if (distinct.length > 0) {
    const { data: vrows } = await supabase
      .from("address_code_violations")
      .select("address, open_case_count, violation_types")
      .in("address", distinct);
    for (const row of vrows ?? []) {
      if ((row.open_case_count ?? 0) > 0) {
        openCodeViolations += row.open_case_count;
        addressesWithViolations += 1;
        violationDetails.push({
          address: row.address,
          open_case_count: row.open_case_count,
          types: row.violation_types ?? [],
        });
      }
    }
  }

  // Expired-without-final: permits issued >18mo ago with no completed_date
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  const cutoff = eighteenMonthsAgo.toISOString().slice(0, 10);
  const oldEnough = (permits ?? []).filter(p => p.issued_date && p.issued_date < cutoff);
  const expiredWithoutFinal = oldEnough.filter(p => !p.completed_date).length;

  await supabase
    .from("contractor_trust_signals")
    .upsert(
      {
        contractor_id,
        open_code_violations: openCodeViolations,
        addresses_with_violations: addressesWithViolations,
        addresses_checked: distinct.length,
        expired_without_final: expiredWithoutFinal,
        permits_old_enough: oldEnough.length,
        last_calculated_at: new Date().toISOString(),
      },
      { onConflict: "contractor_id" },
    );

  return {
    contractor_id,
    addresses_checked: distinct.length,
    open_code_violations: openCodeViolations,
    addresses_with_violations: addressesWithViolations,
    expired_without_final: expiredWithoutFinal,
    permits_old_enough: oldEnough.length,
    violation_details: violationDetails,
  };
};

// Background snapshot runner — kicked off via EdgeRuntime.waitUntil so the
// caller doesn't have to hold the connection open for the full ArcGIS sweep.
const runSnapshotInBackground = async (supabase: ReturnType<typeof createClient>) => {
  try {
    console.log("snapshot: starting full open-cases sweep");
    const cases = await fetchAllOpenCases();
    const written = await writeSnapshot(supabase, cases);
    console.log(`snapshot: complete — ${written.addresses} addresses written`);
  } catch (e) {
    console.error("snapshot: failed", e);
  }
};

// deno-lint-ignore no-explicit-any
const edge: any = (globalThis as any).EdgeRuntime;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Probe: tiny request to verify ArcGIS reachability from this network.
    if (body.probe) {
      const probeUrl = `${ARCGIS_LAYER}?where=1%3D1&returnCountOnly=true&f=json`;
      const t0 = Date.now();
      try {
        const res = await fetch(probeUrl, { signal: AbortSignal.timeout(60_000) });
        const text = await res.text();
        return new Response(JSON.stringify({
          ok: true, probe: { status: res.status, ms: Date.now() - t0, body: text.slice(0, 500) }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({
          ok: false, probe: { ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Status check: how fresh is the snapshot, how many addresses cached?
    if (body.status) {
      const { count } = await supabase
        .from("address_code_violations")
        .select("address", { count: "exact", head: true });
      const { data: latest } = await supabase
        .from("address_code_violations")
        .select("last_checked_at")
        .order("last_checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return new Response(
        JSON.stringify({
          ok: true,
          cached_addresses: count ?? 0,
          last_checked_at: latest?.last_checked_at ?? null,
          fresh: latest ? Date.now() - new Date(latest.last_checked_at).getTime() < SNAPSHOT_TTL_MS : false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fresh = await isSnapshotFresh(supabase);
    const needSnapshot = !!body.snapshot || !!body.force || !fresh;

    // Kick the snapshot off in the background. Do NOT await it — ArcGIS sweep
    // can take 60-120s and would time out the HTTP request.
    if (needSnapshot) {
      if (edge?.waitUntil) {
        edge.waitUntil(runSnapshotInBackground(supabase));
      } else {
        runSnapshotInBackground(supabase);
      }
    }

    if (body.contractor_id) {
      // Compute against whatever's already cached. If nothing cached yet, the
      // numbers will be zero this call and accurate after the snapshot finishes.
      const signals = await computeContractorSignals(supabase, body.contractor_id);
      return new Response(
        JSON.stringify({
          ok: true,
          snapshot: { refreshed: needSnapshot, in_background: needSnapshot },
          ...signals,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot: { refreshed: needSnapshot, in_background: needSnapshot, was_fresh: fresh },
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
