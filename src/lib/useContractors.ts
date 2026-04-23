// Hook: load contractors for the homeowner's project + zip.
// Triggers a backfill from San Jose Open Data on first load (or when the
// cache is stale), then reads the local DB for fast renders.
//
// CSLB verification flow (Layer 3 cache check) per contractor:
//   1. cslb_licenses row with last_verified_at within 24h         → use as-is
//   2. cslb_licenses row from bulk_import (any age)               → use, refresh in bg
//   3. legacy contractor_license_cache row                        → use, refresh in bg
//   4. nothing                                                    → verifying… → Firecrawl
//
// Background refreshes are kicked off in parallel and update state as they
// resolve so the UI swaps "verifying" pills for verified data live.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Contractor,
  type Permit,
  type LicenseStatus,
  type TrustScoreBreakdown,
  computeTrustScore,
  projectKeywords,
  cslbDeepLink,
} from "@/lib/contractors";
import type { IntakeData } from "@/lib/intake";

export type RankedContractor = {
  contractor: Contractor;
  permits: Permit[];
  license: LicenseStatus | null;
  score: TrustScoreBreakdown;
  matchCount: number;
  recentPermit: Permit | null;
  /** True while a Firecrawl verification request is in flight for this license. */
  verifying?: boolean;
};

type Status = "idle" | "loading" | "ready" | "error";

const isStaleZip = (lastFetched: number | null) => {
  if (!lastFetched) return true;
  return Date.now() - lastFetched > 6 * 60 * 60 * 1000; // 6h
};

const FETCH_KEY = "haleo:contractors:lastFetch";
const lastFetchFor = (zip: string): number | null => {
  try {
    const map = JSON.parse(localStorage.getItem(FETCH_KEY) ?? "{}") as Record<string, number>;
    return map[zip] ?? null;
  } catch { return null; }
};
const markFetched = (zip: string) => {
  try {
    const map = JSON.parse(localStorage.getItem(FETCH_KEY) ?? "{}") as Record<string, number>;
    map[zip] = Date.now();
    localStorage.setItem(FETCH_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
};

const CACHE_HOURS = 24;
const isFreshFirecrawl = (row: { data_source?: string | null; last_verified_at?: string | null }): boolean => {
  if (row.data_source !== "firecrawl" || !row.last_verified_at) return false;
  return Date.now() - new Date(row.last_verified_at).getTime() < CACHE_HOURS * 3600 * 1000;
};

// Convert a cslb_licenses row → the shared LicenseStatus shape used by the UI.
// We populate `scrape_succeeded` so all existing cslbSignals evaluators keep
// working. `last_verified_at` doubles as "last_checked_at" for legacy callers.
const toLicenseStatus = (row: {
  license_number: string;
  license_status?: string | null;
  business_name?: string | null;
  classifications?: string[] | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  has_disciplinary_action?: boolean | null;
  disciplinary_notes?: string | null;
  workers_comp_status?: string | null;
  bond_status?: string | null;
  data_source?: string | null;
  last_verified_at?: string | null;
}): LicenseStatus => ({
  license_number: row.license_number,
  status: row.license_status ?? null,
  business_name: row.business_name ?? null,
  classifications: row.classifications ?? null,
  issue_date: row.issue_date ?? null,
  expiration_date: row.expiration_date ?? null,
  has_disciplinary_action: !!row.has_disciplinary_action,
  disciplinary_notes: row.disciplinary_notes ?? null,
  workers_comp_status: row.workers_comp_status ?? null,
  bond_status: row.bond_status ?? null,
  // Treat firecrawl + bulk_import as verified data sources; fallback stays "unknown"
  scrape_succeeded: row.data_source === "firecrawl" || row.data_source === "bulk_import",
  last_checked_at: row.last_verified_at ?? new Date(0).toISOString(),
  deep_link: cslbDeepLink(row.license_number),
});

export const useContractors = (data: IntakeData) => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ranked, setRanked] = useState<RankedContractor[]>([]);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);
  // Track which licenses we've already kicked off a verify call for in this
  // session so we don't spam the edge function on re-renders.
  const verifyingRef = useRef<Set<string>>(new Set());

  const zip = data.address?.zip ?? "95110";
  const room = data.room;
  const keywords = projectKeywords(data);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        // 1. Backfill from San Jose Open Data if cache is stale
        if (isStaleZip(lastFetchFor(zip))) {
          setBackfillNote("Pulling permit data from San Jose Open Data…");
          try {
            const { data: bf, error: bfErr } = await supabase.functions.invoke("fetch-sj-permits", {
              body: { zip, room, limit: 200 },
            });
            if (!bfErr && bf?.ok) {
              markFetched(zip);
              setBackfillNote(`Indexed ${bf.contractors_upserted ?? 0} contractors from ${bf.filtered_rows ?? 0} permits in ${zip}.`);
            } else {
              setBackfillNote("Live permit feed unavailable — showing what's already indexed.");
            }
          } catch {
            setBackfillNote("Live permit feed unavailable — showing what's already indexed.");
          }
        }

        // 2. Read contractors with permits
        const { data: contractorsData, error: cErr } = await supabase
          .from("contractors")
          .select("*")
          .order("permit_count", { ascending: false })
          .limit(50);
        if (cErr) throw cErr;

        const contractors = (contractorsData ?? []) as Contractor[];
        if (contractors.length === 0) {
          if (!cancelled) {
            setRanked([]);
            setStatus("ready");
          }
          return;
        }

        // 3. Permits for these contractors
        const ids = contractors.map(c => c.id);
        const { data: permitsData } = await supabase
          .from("contractor_permits")
          .select("*")
          .in("contractor_id", ids)
          .order("issued_date", { ascending: false });
        const permits = (permitsData ?? []) as Permit[];

        // 4. CSLB licenses — prefer new cslb_licenses table, fall back to legacy cache
        const licenseNumbers = contractors.map(c => c.license_number).filter(Boolean);
        const [{ data: newRows }, { data: legacyRows }] = await Promise.all([
          supabase.from("cslb_licenses").select("*").in("license_number", licenseNumbers),
          supabase.from("contractor_license_cache").select("*").in("license_number", licenseNumbers),
        ]);
        const newByNum = new Map<string, NonNullable<typeof newRows>[number]>();
        (newRows ?? []).forEach(r => newByNum.set(r.license_number, r));
        const legacyByNum = new Map<string, NonNullable<typeof legacyRows>[number]>();
        (legacyRows ?? []).forEach(r => legacyByNum.set(r.license_number, r));

        const licensesByNum = new Map<string, LicenseStatus>();
        const licensesNeedingVerify: { num: string; reason: "missing" | "stale" | "bulk_only" }[] = [];
        for (const num of licenseNumbers) {
          const row = newByNum.get(num);
          if (row && isFreshFirecrawl(row)) {
            licensesByNum.set(num, toLicenseStatus(row));
            continue;
          }
          if (row && row.data_source === "bulk_import") {
            licensesByNum.set(num, toLicenseStatus(row));
            licensesNeedingVerify.push({ num, reason: "bulk_only" });
            continue;
          }
          if (row && row.data_source === "firecrawl") {
            // Have firecrawl data but it's stale — show it, refresh in bg
            licensesByNum.set(num, toLicenseStatus(row));
            licensesNeedingVerify.push({ num, reason: "stale" });
            continue;
          }
          // No new-table row — fall back to legacy if present
          const legacy = legacyByNum.get(num);
          if (legacy) {
            licensesByNum.set(num, {
              license_number: legacy.license_number,
              status: legacy.status,
              business_name: legacy.business_name,
              classifications: legacy.classifications,
              issue_date: legacy.issue_date,
              expiration_date: legacy.expiration_date,
              has_disciplinary_action: !!legacy.has_disciplinary_action,
              disciplinary_notes: legacy.disciplinary_notes,
              workers_comp_status: legacy.workers_comp_status,
              bond_status: legacy.bond_status,
              scrape_succeeded: !!legacy.scrape_succeeded,
              last_checked_at: legacy.last_checked_at,
              deep_link: cslbDeepLink(legacy.license_number),
            });
            licensesNeedingVerify.push({ num, reason: "stale" });
            continue;
          }
          licensesNeedingVerify.push({ num, reason: "missing" });
        }

        // 5. Rank with whatever data we have right now
        const buildRanked = (): RankedContractor[] => {
          const verifyingSet = verifyingRef.current;
          const out: RankedContractor[] = contractors.map(c => {
            const cPermits = permits.filter(p => p.contractor_id === c.id);
            const license = licensesByNum.get(c.license_number) ?? null;
            const score = computeTrustScore(c, cPermits, license, keywords);
            const matchCount = cPermits.filter(p => {
              const hay = `${p.work_type ?? ""} ${p.description ?? ""}`.toLowerCase();
              return keywords.some(k => hay.includes(k.toLowerCase()));
            }).length;
            const recentPermit = cPermits.find(p => p.issued_date) ?? null;
            const verifying = !license && verifyingSet.has(c.license_number);
            return { contractor: c, permits: cPermits, license, score, matchCount, recentPermit, verifying };
          });
          // Disciplinary records sort last; otherwise project match → trust score
          out.sort((a, b) => {
            const aBad = a.license?.scrape_succeeded && a.license.has_disciplinary_action ? 1 : 0;
            const bBad = b.license?.scrape_succeeded && b.license.has_disciplinary_action ? 1 : 0;
            if (aBad !== bBad) return aBad - bBad;
            if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            return b.score.total - a.score.total;
          });
          return out;
        };

        if (!cancelled) {
          setRanked(buildRanked());
          setStatus("ready");
        }

        // 6. Kick off Firecrawl verifications for licenses that need them.
        //    Limit concurrency to avoid blasting the edge function.
        const queue = licensesNeedingVerify.filter(({ num }) => !verifyingRef.current.has(num));
        queue.forEach(({ num }) => verifyingRef.current.add(num));
        // Re-render so cards without any data show the "verifying" state.
        if (queue.length > 0 && !cancelled) setRanked(buildRanked());

        const CONCURRENCY = 3;
        const runOne = async ({ num, reason }: { num: string; reason: string }) => {
          try {
            const { data: res } = await supabase.functions.invoke("verify-cslb-license", {
              body: { license: num, force: reason === "stale" || reason === "bulk_only" ? false : false },
            });
            if (res && res.ok) {
              licensesByNum.set(num, toLicenseStatus({
                license_number: num,
                license_status: res.license_status,
                business_name: res.business_name,
                classifications: res.classifications,
                issue_date: res.issue_date,
                expiration_date: res.expiration_date,
                has_disciplinary_action: res.has_disciplinary_action,
                disciplinary_notes: res.disciplinary_notes,
                workers_comp_status: res.workers_comp_status,
                bond_status: res.bond_status,
                data_source: res.data_source,
                last_verified_at: res.last_verified_at,
              }));
            }
          } catch (e) {
            // Network/edge errors → leave as unverified; UI handles deep-link fallback
            console.warn("verify-cslb-license failed", num, e);
          } finally {
            verifyingRef.current.delete(num);
            if (!cancelled) setRanked(buildRanked());
          }
        };

        // Simple p-limit: process the queue in chunks of CONCURRENCY.
        for (let i = 0; i < queue.length; i += CONCURRENCY) {
          if (cancelled) break;
          const chunk = queue.slice(i, i + CONCURRENCY);
          await Promise.all(chunk.map(runOne));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    };
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, room]);

  return { status, error, ranked, backfillNote, zip, keywords };
};
