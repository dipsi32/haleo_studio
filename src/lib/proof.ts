// Counting a contractor's public permit record the way a homeowner reads it:
// by city, not zip. Familiarity with a city's inspection and permit process
// is what the homeowner is really buying.
import type { Permit } from "@/lib/contractors";

export type ProofPermit = Pick<Permit, "city" | "issued_date" | "completed_date" | "work_type" | "description">;

export type ProofSummary = {
  total: number;
  inCity: number;
  similar: number;
  finaled: number;
  lastIssued: string | null;
  firstIssued: string | null;
};

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

// Short keywords ("add") match whole words only, so "address" and "padding"
// don't read as additions. Longer ones match as prefixes ("addition" finds
// "additions"), the way the contractor matching already treats them.
const matchesKeyword = (haystack: string, keyword: string): boolean => {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  if (k.length > 3) return haystack.includes(k);
  return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);
};

export const summarizeProof = (permits: ProofPermit[], city: string | null, keywords: string[]): ProofSummary => {
  const local = city ? permits.filter((p) => norm(p.city) === norm(city)) : permits;
  const similar = local.filter((p) => {
    const hay = `${p.work_type ?? ""} ${p.description ?? ""}`.toLowerCase();
    return keywords.some((k) => matchesKeyword(hay, k));
  });
  const dates = local.map((p) => p.issued_date).filter((d): d is string => Boolean(d)).sort();
  return {
    total: permits.length,
    inCity: local.length,
    similar: similar.length,
    finaled: local.filter((p) => Boolean(p.completed_date)).length,
    lastIssued: dates.length ? dates[dates.length - 1] : null,
    firstIssued: dates.length ? dates[0] : null,
  };
};
