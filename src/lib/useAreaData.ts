// Loads the two drill-downs under a home's record:
//   useCrewRecords: each contractor who worked on THIS house, with their
//     wider San José record (how many permits, how recent).
//   useAreaContractors: everyone with permitted work in the ZIP, loaded only
//     when the homeowner asks for it.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { areaContractors, type AreaCrew, type AreaPermit } from "@/lib/areaContractors";

export type CrewRecord = { raw: string; id: string | null; permitCount: number | null; lastPermit: string | null };

const words = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !["INC", "LLC", "CO", "CORP", "THE", "AND", "DBA"].includes(w));

/** Each house contractor, matched to their San José record by name. */
export const useCrewRecords = (names: string[]): Record<string, CrewRecord> => {
  const [out, setOut] = useState<Record<string, CrewRecord>>({});
  const key = names.join("|");
  useEffect(() => {
    if (!names.length) return;
    let alive = true;
    (async () => {
      const found: Record<string, CrewRecord> = {};
      await Promise.all(
        names.slice(0, 6).map(async (raw) => {
          const w = words(raw).slice(0, 3);
          if (!w.length) return;
          const pattern = `%${w.join("%")}%`;
          const { data } = await supabase
            .from("contractors")
            .select("id, company, name, permit_count, last_permit_date")
            .or(`company.ilike.${pattern},name.ilike.${pattern}`)
            .order("permit_count", { ascending: false })
            .limit(1);
          const row = (data ?? [])[0] as { id: string; permit_count: number | null; last_permit_date: string | null } | undefined;
          found[raw] = { raw, id: row?.id ?? null, permitCount: row?.permit_count ?? null, lastPermit: row?.last_permit_date ?? null };
        }),
      );
      if (alive) setOut(found);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return out;
};

export type AreaState = {
  /** "growing": showing what we have while the city's full read of the ZIP is still coming in. */
  status: "idle" | "loading" | "growing" | "done" | "failed";
  crews: AreaCrew[];
  permits: number;
};

/**
 * Everyone with permitted work in the ZIP. Shows what's on hand at once; if
 * that's thin, reads the ZIP from the city in the background (the first read
 * of a ZIP can take a couple of minutes) and fills in when it lands.
 */
export const useAreaContractors = (zip: string, enabled: boolean): AreaState => {
  const [state, setState] = useState<AreaState>({ status: "idle", crews: [], permits: 0 });
  useEffect(() => {
    if (!enabled || !/^\d{5}$/.test(zip)) return;
    let alive = true;
    setState((s) => ({ ...s, status: "loading" }));
    const read = async (): Promise<{ crews: AreaCrew[]; permits: number }> => {
      const { data } = await supabase
        .from("contractor_permits")
        .select("contractor_id, address, work_type, description, issued_date")
        .eq("zip", zip)
        .order("issued_date", { ascending: false })
        .limit(1000);
      const permits = (data ?? []) as AreaPermit[];
      const ids = [...new Set(permits.map((p) => p.contractor_id).filter((id): id is string => !!id))];
      const names = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 150) {
        const { data: cs } = await supabase.from("contractors").select("id, company, name").in("id", ids.slice(i, i + 150));
        for (const c of (cs ?? []) as { id: string; company: string | null; name: string | null }[]) {
          const n = c.company?.trim() || c.name?.trim();
          if (n) names.set(c.id, n);
        }
      }
      return { crews: areaContractors(permits, names), permits: permits.length };
    };
    (async () => {
      const first = await read();
      // Plenty on hand: done. Otherwise show it now and read the ZIP from the city meanwhile.
      if (first.permits >= 100) {
        if (alive) setState({ status: "done", ...first });
        return;
      }
      if (alive) setState({ status: first.permits ? "growing" : "loading", ...first });
      await supabase.functions.invoke("fetch-sj-permits", { body: { zip, area: true } }).catch(() => undefined);
      const full = await read();
      if (alive) setState({ status: full.permits ? "done" : "failed", ...full });
    })().catch(() => alive && setState({ status: "failed", crews: [], permits: 0 }));
    return () => {
      alive = false;
    };
  }, [zip, enabled]);
  return state;
};
