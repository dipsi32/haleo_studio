// The home's own record, as a homeowner (and their contractor) reads it:
// every permit pulled on this property, newest first, what the city signed
// off, and what was never finished. Built from the San Jose permit history
// for the parcel plus the city's inspection feed. Pure; tested in
// homeRecord.test.ts.

export type RecordPermitIn = {
  permit_number: string | null;
  type?: string | null;
  subtype?: string | null;
  description: string | null;
  contractor?: string | null;
  issued_date: string | null;
  final_date?: string | null;
  valuation?: number | null;
  status: string | null;
  is_open: boolean;
  is_expired_without_final: boolean;
  /** From the city's portal (city-record): the fuller story, when we have it. */
  what?: string | null;
  scope?: string | null;
  contractors?: string[];
  docs?: CityDoc[];
  applied?: string | null;
  expires?: string | null;
};

/** One imaged document on a permit, a direct link to the city's PDF. */
export type CityDoc = { id: string; kind: string; category: string | null; date: string | null; url: string };

export type InspectionIn = {
  folder_number: string;
  found: boolean;
  lifecycle?: "closed" | "in_inspection" | "stalled" | "expired_open" | "unknown";
  approvals?: { label: string; status: "complete" | "in_progress" | "pending" | "unknown" }[];
};

/** "cancelled": cancelled, withdrawn, or applied for and never issued: no work was authorized. */
export type RecordState = "finaled" | "in_progress" | "open" | "expired" | "cancelled" | "unknown";

/** Open for over two years: likely abandoned, worth raising. Younger is work in progress. */
export const isLongOpen = (issued: string, now: Date = new Date()) => now.getTime() - new Date(issued).getTime() > 2 * 365 * 864e5;

export type RecordRow = {
  permit: string | null;
  year: number | null;
  what: string;
  state: RecordState;
  stateLabel: string;
  contractor: string | null;
  /** Trades the city signed off ("Building", "Electrical"), when we read the inspection feed. */
  signoffs: string[];
  /** The permit's own words and dates, for its detail view. */
  detail: {
    type: string | null;
    description: string | null;
    issued: string | null;
    finaled: string | null;
    valuation: number | null;
    /** Every inspection the city has on this permit, passed or not. */
    inspections: { label: string; status: string }[];
    applied: string | null;
    expires: string | null;
  };
  /** Everyone the city lists as contractor on it (the first is `contractor`). */
  contractors: string[];
  /** The imaged permit, inspection notices, plans: direct links. */
  docs: CityDoc[];
};

const STATE_LABEL: Record<RecordState, string> = {
  finaled: "Finished and signed off",
  in_progress: "Work in progress",
  open: "Open for over two years",
  expired: "Expired, never signed off",
  cancelled: "Cancelled",
  unknown: "Status not on record",
};

const DAY = 864e5;
/** The city portal's own status, read honestly. */
const cityState = (p: RecordPermitIn, now: Date): { state: RecordState; label?: string } | null => {
  const st = (p.status ?? "").toLowerCase();
  if (!p.status || p.contractors === undefined) return null;
  if (p.final_date || /final/.test(st)) return { state: "finaled" };
  if (/cancel|void/.test(st)) return { state: "cancelled", label: "Cancelled" };
  if (/withdraw/.test(st)) return { state: "cancelled", label: "Withdrawn" };
  if (/expired/.test(st)) return p.issued_date ? { state: "expired" } : { state: "cancelled", label: "Applied, never issued" };
  if (!p.issued_date) {
    const applied = p.applied ? new Date(p.applied).getTime() : 0;
    return applied && now.getTime() - applied < 365 * DAY
      ? { state: "in_progress", label: "In review with the city" }
      : { state: "cancelled", label: /closed/.test(st) ? "Closed" : "Applied, never issued" };
  }
  if (/closed/.test(st)) return { state: "unknown", label: "Closed, no final on record" };
  return isLongOpen(p.issued_date, now) ? { state: "open" } : { state: "in_progress" };
};

/** "Kitchen remodel · Single-Family — Additions/Alterations" → "Kitchen remodel". */
export const whatOf = (p: RecordPermitIn): string => {
  const d = (p.description ?? "").split(" · ")[0].replace(/^\([A-Z]+\)\s*/, "").trim();
  // The city's own jargon, in plain words.
  if (/sub-?trades? only/i.test(d) || (!d && /sub-?trades? only/i.test(p.subtype ?? ""))) return "Plumbing, electrical or mechanical work";
  const base = d || [p.subtype, p.type].filter(Boolean).join(", ") || "Permitted work";
  return base.charAt(0).toUpperCase() + base.slice(1);
};

export const homeRecord = (permits: RecordPermitIn[], inspections: InspectionIn[] = [], now: Date = new Date()): { rows: RecordRow[]; open: number; expired: number; since: number | null; headline: string } => {
  const byFolder = new Map(inspections.filter((i) => i.found).map((i) => [i.folder_number, i]));
  const rows = [...permits]
    .sort((a, b) => (b.issued_date ?? b.applied ?? "").localeCompare(a.issued_date ?? a.applied ?? ""))
    .map((p): RecordRow => {
      const insp = p.permit_number ? byFolder.get(p.permit_number) : undefined;
      const finaled = !!p.final_date || /final|closed|complete/i.test(p.status ?? "") || insp?.lifecycle === "closed";
      const city = cityState(p, now);
      const state: RecordState = city
        ? city.state
        : p.is_expired_without_final
        ? "expired"
        : p.is_open && !finaled
          ? p.issued_date && isLongOpen(p.issued_date, now)
            ? "open"
            : "in_progress"
          : finaled
            ? "finaled"
            : "unknown";
      return {
        permit: p.permit_number,
        year: (p.issued_date ?? p.applied) && /^\d{4}/.test(p.issued_date ?? p.applied ?? "") ? Number((p.issued_date ?? p.applied)!.slice(0, 4)) : null,
        what: p.what?.trim() || whatOf(p),
        state,
        stateLabel: city?.label ?? STATE_LABEL[state],
        contractor: p.contractors?.[0]?.trim() || p.contractor?.trim() || null,
        contractors: p.contractors?.length ? p.contractors : p.contractor?.trim() ? [p.contractor.trim()] : [],
        docs: p.docs ?? [],
        signoffs: [...new Set((insp?.approvals ?? []).filter((a) => a.status === "complete").map((a) => a.label))],
        detail: {
          type: [p.type, p.subtype].filter(Boolean).join(" · ") || null,
          // The city's jargon, in plain words.
          description: p.scope?.trim()
            ? p.scope.trim()
            : /^sub-?trades? only$/i.test(p.description?.trim() ?? "")
              ? "Plumbing, electrical or mechanical work only (no structural changes)."
              : p.description?.trim() || null,
          issued: p.issued_date ?? null,
          finaled: p.final_date ?? null,
          valuation: typeof p.valuation === "number" && p.valuation > 0 ? p.valuation : null,
          inspections: (insp?.approvals ?? []).map((a) => ({ label: a.label, status: a.status })),
          applied: p.applied ?? null,
          expires: p.expires ?? null,
        },
      };
    });
  const open = rows.filter((r) => r.state === "open").length;
  const expired = rows.filter((r) => r.state === "expired").length;
  const years = rows.map((r) => r.year).filter((y): y is number => y !== null);
  const since = years.length ? Math.min(...years) : null;
  const n = rows.length;
  const inProgress = rows.filter((r) => r.state === "in_progress").length;
  const headline =
    n === 0
      ? "No permits on file for this address."
      : expired || open
        ? `${n} permit${n === 1 ? "" : "s"} on file${since ? ` since ${since}` : ""}. ${[expired && `${expired} expired without a sign-off`, open && `${open} open for over two years`].filter(Boolean).join(", ")}.`
        : inProgress
          ? `${n} permit${n === 1 ? "" : "s"} on file${since ? ` since ${since}` : ""}, ${inProgress === n ? "all" : inProgress} in progress with the city.`
          : `${n} permit${n === 1 ? "" : "s"} on file${since ? ` since ${since}` : ""}, none left unfinished.`;
  return { rows, open, expired, since, headline };
};

/** Official maps a homeowner can check themselves when our hazard check couldn't run. */
export const HAZARD_MAPS = [
  { id: "fire", label: "Fire hazard zones (CAL FIRE)", href: "https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones" },
  { id: "flood", label: "Flood zones (FEMA)", href: "https://msc.fema.gov/portal/search" },
  { id: "seismic", label: "Earthquake hazard zones (California Geological Survey)", href: "https://maps.conservation.ca.gov/cgs/EQZApp/app/" },
] as const;

/** The city's own permit portal, for history older than its open-data feeds. */
export const CITY_PERMIT_ARCHIVE = "https://www.sjpermits.org/";

/**
 * The city's public permit search, where each permit's imaged documents
 * (the permit, plans, inspection records) live. It opens records from a
 * search, not a direct link, so we hand over the permit number with it.
 */
export const CITY_PERMIT_SEARCH = "https://permits.sanjoseca.gov/search/permit";
