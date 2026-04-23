// Hook: load contractors for the homeowner's project + zip.
// Triggers a backfill from San Jose Open Data on first load (or when
// the cache is stale), then reads the local DB for fast renders.
import { useEffect, useState } from "react";
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

export const useContractors = (data: IntakeData) => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ranked, setRanked] = useState<RankedContractor[]>([]);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);

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

        // 4. License cache
        const licenseNumbers = contractors.map(c => c.license_number).filter(Boolean);
        const { data: licensesData } = await supabase
          .from("contractor_license_cache")
          .select("*")
          .in("license_number", licenseNumbers);
        const licensesByNum = new Map<string, LicenseStatus>();
        (licensesData ?? []).forEach((l) => {
          licensesByNum.set(l.license_number, {
            ...l,
            deep_link: cslbDeepLink(l.license_number),
          } as LicenseStatus);
        });

        // 5. Rank
        const out: RankedContractor[] = contractors.map(c => {
          const cPermits = permits.filter(p => p.contractor_id === c.id);
          const license = licensesByNum.get(c.license_number) ?? null;
          const score = computeTrustScore(c, cPermits, license, keywords);
          const matchCount = cPermits.filter(p => {
            const hay = `${p.work_type ?? ""} ${p.description ?? ""}`.toLowerCase();
            return keywords.some(k => hay.includes(k.toLowerCase()));
          }).length;
          const recentPermit = cPermits.find(p => p.issued_date) ?? null;
          return { contractor: c, permits: cPermits, license, score, matchCount, recentPermit };
        });

        // Default sort: best match (project type weighted, then score)
        out.sort((a, b) => {
          if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
          return b.score.total - a.score.total;
        });

        if (!cancelled) {
          setRanked(out);
          setStatus("ready");
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
