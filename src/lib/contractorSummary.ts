// A contractor's record, read the way a homeowner weighs a contractor:
//   Can I trust them?          license, sign-offs, how recent
//   Have they done my job?     what they do, by kind
//   Have they worked near me?  the streets (never house numbers)
//   What did they do lately?   their latest jobs
// From San José's permit records. Pure; tested in contractorSummary.test.ts.
import { workKind } from "./houseReport";
import { streetOf } from "./areaContractors";

export type SummaryPermit = {
  work_type: string | null;
  description: string | null;
  address: string | null;
  zip: string | null;
  issued_date: string | null;
  completed_date: string | null;
  status: string | null;
};

export type ContractorSummary = {
  total: number;
  since: number | null;
  latest: string | null;
  lastYear: number;
  /** Permits the city signed off, and ones that expired without a final. */
  finaled: number;
  expired: number;
  open: number;
  /** Of the permits that are done one way or another, the share the city signed off. Null when too few to say. */
  signedOffShare: number | null;
  kinds: { kind: string; count: number }[];
  streets: { name: string; count: number; yours: boolean }[];
  inZip: number;
  recent: { kind: string; street: string | null; date: string | null; state: "finaled" | "expired" | "open" }[];
};

const stateOf = (p: SummaryPermit): "finaled" | "expired" | "open" =>
  p.completed_date || /final/i.test(p.status ?? "") ? "finaled" : /expired/i.test(p.status ?? "") ? "expired" : "open";

export const contractorSummary = (
  permits: SummaryPermit[],
  o: { zip?: string | null; street?: string | null; now?: Date; recent?: number } = {},
): ContractorSummary => {
  const now = o.now ?? new Date();
  const sorted = [...permits].sort((a, b) => String(b.issued_date ?? "").localeCompare(String(a.issued_date ?? "")));
  const years = sorted.map((p) => p.issued_date?.slice(0, 4)).filter((y): y is string => !!y && /^\d{4}$/.test(y)).map(Number);
  const states = sorted.map(stateOf);
  const finaled = states.filter((s) => s === "finaled").length;
  const expired = states.filter((s) => s === "expired").length;
  const kinds = new Map<string, number>();
  const streets = new Map<string, number>();
  for (const p of sorted) {
    const k = workKind({ description: p.description, type: p.work_type });
    if (k !== "Other work") kinds.set(k, (kinds.get(k) ?? 0) + 1);
    const st = streetOf(p.address);
    if (st) streets.set(st, (streets.get(st) ?? 0) + 1);
  }
  const yours = (o.street ?? "").toLowerCase();
  return {
    total: sorted.length,
    since: years.length ? Math.min(...years) : null,
    latest: sorted[0]?.issued_date ?? null,
    lastYear: sorted.filter((p) => p.issued_date && now.getTime() - new Date(p.issued_date).getTime() < 365 * 864e5).length,
    finaled,
    expired,
    open: sorted.length - finaled - expired,
    signedOffShare: finaled + expired >= 3 ? finaled / (finaled + expired) : null,
    kinds: [...kinds.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    streets: [...streets.entries()]
      .map(([name, count]) => ({ name, count, yours: !!yours && name.toLowerCase() === yours }))
      .sort((a, b) => Number(b.yours) - Number(a.yours) || b.count - a.count),
    inZip: o.zip ? sorted.filter((p) => p.zip === o.zip).length : 0,
    recent: sorted.slice(0, o.recent ?? 8).map((p) => {
      const k = workKind({ description: p.description, type: p.work_type });
      return { kind: k === "Other work" ? (p.work_type || "Permitted work") : k, street: streetOf(p.address), date: p.issued_date, state: stateOf(p) };
    }),
  };
};
