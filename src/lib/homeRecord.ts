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
  status: string | null;
  is_open: boolean;
  is_expired_without_final: boolean;
};

export type InspectionIn = {
  folder_number: string;
  found: boolean;
  lifecycle?: "closed" | "in_inspection" | "stalled" | "expired_open" | "unknown";
  approvals?: { label: string; status: "complete" | "in_progress" | "pending" | "unknown" }[];
};

export type RecordState = "finaled" | "open" | "expired" | "unknown";

export type RecordRow = {
  permit: string | null;
  year: number | null;
  what: string;
  state: RecordState;
  stateLabel: string;
  contractor: string | null;
  /** Trades the city signed off ("Building", "Electrical"), when we read the inspection feed. */
  signoffs: string[];
};

const STATE_LABEL: Record<RecordState, string> = {
  finaled: "Finished and signed off",
  open: "Still open with the city",
  expired: "Expired, never signed off",
  unknown: "Status not on record",
};

/** "Kitchen remodel · Single-Family — Additions/Alterations" → "Kitchen remodel". */
const whatOf = (p: RecordPermitIn): string => {
  const d = (p.description ?? "").split(" · ")[0].replace(/^\([A-Z]+\)\s*/, "").trim();
  const base = d || [p.subtype, p.type].filter(Boolean).join(", ") || "Permitted work";
  return base.charAt(0).toUpperCase() + base.slice(1);
};

export const homeRecord = (permits: RecordPermitIn[], inspections: InspectionIn[] = []): { rows: RecordRow[]; open: number; expired: number; since: number | null; headline: string } => {
  const byFolder = new Map(inspections.filter((i) => i.found).map((i) => [i.folder_number, i]));
  const rows = [...permits]
    .sort((a, b) => (b.issued_date ?? "").localeCompare(a.issued_date ?? ""))
    .map((p): RecordRow => {
      const insp = p.permit_number ? byFolder.get(p.permit_number) : undefined;
      const finaled = !!p.final_date || /final|closed|complete/i.test(p.status ?? "") || insp?.lifecycle === "closed";
      const state: RecordState = p.is_expired_without_final ? "expired" : p.is_open && !finaled ? "open" : finaled ? "finaled" : "unknown";
      return {
        permit: p.permit_number,
        year: p.issued_date && /^\d{4}/.test(p.issued_date) ? Number(p.issued_date.slice(0, 4)) : null,
        what: whatOf(p),
        state,
        stateLabel: STATE_LABEL[state],
        contractor: p.contractor?.trim() || null,
        signoffs: [...new Set((insp?.approvals ?? []).filter((a) => a.status === "complete").map((a) => a.label))],
      };
    });
  const open = rows.filter((r) => r.state === "open").length;
  const expired = rows.filter((r) => r.state === "expired").length;
  const years = rows.map((r) => r.year).filter((y): y is number => y !== null);
  const since = years.length ? Math.min(...years) : null;
  const n = rows.length;
  const headline =
    n === 0
      ? "No permits on file for this address."
      : expired || open
        ? `${n} permit${n === 1 ? "" : "s"} on file${since ? ` since ${since}` : ""}. ${[expired && `${expired} expired without a sign-off`, open && `${open} still open`].filter(Boolean).join(", ")}.`
        : `${n} permit${n === 1 ? "" : "s"} on file${since ? ` since ${since}` : ""}, none left unfinished.`;
  return { rows, open, expired, since, headline };
};

/** Official maps a homeowner can check themselves when our hazard check couldn't run. */
export const HAZARD_MAPS = [
  { id: "fire", label: "Fire hazard zones (CAL FIRE)", href: "https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones" },
  { id: "flood", label: "Flood zones (FEMA)", href: "https://msc.fema.gov/portal/search" },
  { id: "seismic", label: "Earthquake hazard zones (California Geological Survey)", href: "https://maps.conservation.ca.gov/cgs/EQZApp/app/" },
] as const;
