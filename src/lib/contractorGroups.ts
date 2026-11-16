// How the match page groups contractors, so a homeowner sees two honest,
// different kinds of evidence instead of one leaderboard:
//
//   1. "Most permits for jobs like yours": contractors associated with the
//      most permit records for this kind of work. Up to three.
//   2. "Others who've worked in your neighborhood": smaller or less frequent
//      on the record, but with permitted jobs in their ZIP. Up to three.
//
// Permit volume is evidence of relevant experience, never "the best". For
// jobs that usually don't need a permit (paint, flooring, a refresh), the
// city's records can't show who has done them, so the neighborhood group
// leads. Also: a cost range from what was declared on nearby permits.
// Pure; tested in contractorGroups.test.ts.
import type { IntakeData } from "@/lib/intake";
import type { JobFit } from "@/lib/jobFit";

type PermitLike = { zip?: string | null; issued_date?: string | null; address?: string | null; valuation?: number | null; work_type?: string | null; description?: string | null };
export type Groupable = { id: string; permits: PermitLike[]; matchCount: number; fit: JobFit };

export const GROUP_SIZE = 3;

const zipOf = (p: PermitLike) => (p.zip ?? "").slice(0, 5);
export const nearbyCount = (t: Groupable, zip: string | null | undefined) => (zip ? t.permits.filter((p) => zipOf(p) === zip).length : 0);
const latestNearby = (t: Groupable, zip: string) =>
  t.permits.filter((p) => zipOf(p) === zip).map((p) => p.issued_date ?? "").sort().pop() ?? "";

/** Jobs that usually don't need a permit: city records can't show who has done them. */
export const permitLight = (d: Pick<IntakeData, "scope" | "goalNote" | "goals" | "rooms">): boolean => {
  // Mirrors SCOPE_OPTIONS.permitLikely in intake.ts: only a refresh usually skips permits.
  if (d.scope) return d.scope === "refresh";
  const note = (d.goalNote ?? "").toLowerCase();
  const light = /\b(paint\w*|flooring|floors?|refinish\w*|backsplash|wallpaper|carpet|cabinet refacing|countertops?)\b/.test(note);
  const heavy = /\b(remodel\w*|addition|adu|move (a )?wall|load[- ]bearing|structural|plumbing|electrical|panel|roof|foundation)\b/.test(note);
  return light && !heavy && !(d.goals ?? []).length;
};

export const groupContractors = <T extends Groupable>(
  list: T[],
  zip: string | null | undefined,
  opts: { permitLight?: boolean } = {},
): { experienced: T[]; neighborhood: T[]; rest: T[] } => {
  const clean = list.filter((t) => !t.fit.flag);
  const taken = new Set<string>();
  const near = () =>
    zip
      ? clean
          .filter((t) => !taken.has(t.id) && nearbyCount(t, zip) > 0)
          .sort((a, b) => nearbyCount(b, zip) - nearbyCount(a, zip) || latestNearby(b, zip).localeCompare(latestNearby(a, zip)))
          .slice(0, GROUP_SIZE)
      : [];
  const take = (xs: T[]) => {
    xs.forEach((t) => taken.add(t.id));
    return xs;
  };

  let experienced: T[];
  let neighborhood: T[];
  if (opts.permitLight) {
    // Permits can't show who has done this job: the neighborhood leads, then
    // whoever has the most permitted work overall.
    neighborhood = take(near());
    experienced = take(
      clean
        .filter((t) => !taken.has(t.id) && t.permits.length > 0)
        .sort((a, b) => b.permits.length - a.permits.length || b.fit.rank - a.fit.rank)
        .slice(0, GROUP_SIZE),
    );
  } else {
    experienced = take(
      clean
        .filter((t) => t.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount || b.fit.rank - a.fit.rank)
        .slice(0, GROUP_SIZE),
    );
    neighborhood = take(near());
  }
  // Everyone else, flagged records last.
  const rest = [...list.filter((t) => !taken.has(t.id) && !t.fit.flag), ...list.filter((t) => t.fit.flag)];
  return { experienced, neighborhood, rest };
};

/** The most recent permitted job in their ZIP, as "Cabana Dr, Jun 2026" (street only, never the house number). */
export const nearbyLine = (t: Groupable, zip: string): string | null => {
  const p = t.permits.filter((x) => zipOf(x) === zip).sort((a, b) => (b.issued_date ?? "").localeCompare(a.issued_date ?? ""))[0];
  if (!p) return null;
  const street = (p.address ?? "").split(",")[0].replace(/^\d+[a-z]?(-\d+)?\s+/i, "").trim();
  const when = p.issued_date ? new Date(p.issued_date).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
  const titled = street ? street.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null;
  return [titled, when].filter(Boolean).join(", ") || null;
};

/**
 * What was declared on nearby permits for this kind of work: the middle half
 * of recent valuations. Declared values are what owners and contractors told
 * the city, usually below the final contract price, so it's a floor to
 * calibrate against, never a quote. Null when there are too few to say.
 */
export const MIN_COST_SAMPLE = 5;
export const declaredCost = (
  permits: PermitLike[],
  keywords: string[],
  now: Date = new Date(),
): { n: number; low: number; mid: number; high: number } | null => {
  const since = now.getTime() - 3 * 365 * 864e5;
  const hay = (p: PermitLike) => `${p.work_type ?? ""} ${p.description ?? ""}`.toLowerCase();
  const vals = permits
    .filter((p) => (p.valuation ?? 0) >= 1000 && (!p.issued_date || new Date(p.issued_date).getTime() >= since))
    .filter((p) => keywords.length === 0 || keywords.some((k) => hay(p).includes(k.toLowerCase())))
    .map((p) => p.valuation as number)
    .sort((a, b) => a - b);
  if (vals.length < MIN_COST_SAMPLE) return null;
  const q = (f: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(f * (vals.length - 1))))];
  const round = (v: number) => (v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100);
  return { n: vals.length, low: round(q(0.25)), mid: round(q(0.5)), high: round(q(0.75)) };
};

export const money = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`);
