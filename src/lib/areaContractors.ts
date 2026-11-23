// Who works in your area: every contractor with permitted work in the ZIP,
// what kind of work, and the streets they've worked on. From San José's
// permit records (contractor_permits). Streets, never house numbers: the
// homeowner sees "worked on Lenora Ave", not a neighbor's address.
// Pure; tested in areaContractors.test.ts. Loaded by useAreaContractors.ts.
import { workKind } from "./houseReport";

export type AreaPermit = {
  contractor_id: string | null;
  address: string | null;
  work_type: string | null;
  description: string | null;
  issued_date: string | null;
};

export type AreaCrew = {
  id: string;
  name: string;
  count: number;
  lastYear: number;
  latest: string | null;
  kinds: string[];
  streets: { name: string; count: number }[];
};

const SUFFIX: Record<string, string> = { av: "Ave", ave: "Ave", st: "St", dr: "Dr", rd: "Rd", ln: "Ln", ct: "Ct", wy: "Way", way: "Way", bl: "Blvd", blvd: "Blvd", pl: "Pl", cr: "Cir", cir: "Cir", pkwy: "Pkwy", ter: "Ter" };

/** "5343 LENORA AV" → "Lenora Ave". The house number never leaves this function. */
export const streetOf = (address: string | null | undefined): string | null => {
  if (!address) return null;
  const rest = address
    .trim()
    .replace(/^\d+[a-z]?(-\d+)?\s+/i, "")
    .split(/[,#]/)[0]
    // Unit numbers are as good as an address: drop them ("KIMBER CT 66", "MAIN ST APT 4B", "ELM ST UNIT 2").
    .replace(/\s+(apt|unit|ste|suite|bldg|spc|space|no)\.?\s*\S+$/i, "")
    .replace(/(\s+[a-z]?\d+[a-z]?)+$/i, "")
    .trim();
  if (!rest || /^\d/.test(rest)) return null;
  return rest
    .toLowerCase()
    .split(/\s+/)
    .map((w) => SUFFIX[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

/** "BAY BUILDERS & REMODELING" → "Bay Builders & Remodeling". */
const tidy = (s: string) => {
  const t = s.trim();
  const flipped = /^[A-Z'-]+, [A-Z'-]+$/.test(t) ? t.split(", ").reverse().join(" ") : t;
  return flipped === flipped.toUpperCase()
    ? flipped.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Lp|Dba|Hvac)\b/g, (m) => m.toUpperCase())
    : flipped;
};

export const areaContractors = (permits: AreaPermit[], names: Map<string, string>, now = new Date()): AreaCrew[] => {
  const yearAgo = now.getTime() - 365 * 864e5;
  const by = new Map<string, AreaPermit[]>();
  for (const p of permits) {
    if (!p.contractor_id || !names.has(p.contractor_id)) continue;
    by.set(p.contractor_id, [...(by.get(p.contractor_id) ?? []), p]);
  }
  return [...by.entries()]
    .map(([id, ps]) => {
      const kinds = new Map<string, number>();
      const streets = new Map<string, number>();
      for (const p of ps) {
        const k = workKind({ description: p.description, type: p.work_type });
        if (k !== "Other work") kinds.set(k, (kinds.get(k) ?? 0) + 1);
        const st = streetOf(p.address);
        if (st) streets.set(st, (streets.get(st) ?? 0) + 1);
      }
      const dates = ps.map((p) => p.issued_date).filter((d): d is string => !!d).sort();
      return {
        id,
        name: tidy(names.get(id)!),
        count: ps.length,
        lastYear: ps.filter((p) => p.issued_date && new Date(p.issued_date).getTime() >= yearAgo).length,
        latest: dates[dates.length - 1] ?? null,
        kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
        streets: [...streets.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      };
    })
    .sort((a, b) => b.count - a.count || (b.latest ?? "").localeCompare(a.latest ?? ""));
};

/** Has this crew worked on the homeowner's own street? */
export const onStreet = (crew: AreaCrew, street: string | null) => !!street && crew.streets.some((s) => s.name.toLowerCase() === street.toLowerCase());
