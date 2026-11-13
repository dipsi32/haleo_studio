// The contractor's track record, as a homeowner on their link sees it while
// describing their project: how much permitted work, how much like theirs,
// how much near them, and how the city's inspections went. Pure, from three
// public sources: San Jose permits, San Jose inspection sign-offs, and the
// state license board.
//
// Honest by construction:
//  - Every number names its source and is a count, never a rating.
//  - Streets, never house numbers or owners: enough to see real work near
//    you, without pointing at someone's home.
//  - A source that didn't answer is left out, never shown as "fine".
import type { IntakeData } from "@/lib/intake";
import { workFor, type RecordPermit } from "@/lib/recordHighlights";
import { matchesKeyword } from "@/lib/proof";

export type TrackPermit = RecordPermit & { address?: string | null; permit_number?: string | null };

/** One permit's inspection sign-offs, from the city's feed (fetch-permit-inspections). */
export type Inspection = {
  folder_number: string;
  found: boolean;
  lifecycle?: "closed" | "in_inspection" | "stalled" | "expired_open" | "unknown";
  approvals?: { code: string; label: string; status: "complete" | "in_progress" | "pending" | "unknown" }[];
};

export type LicenseFacts = { status: string | null; classifications?: string[] | null; issue_date?: string | null } | null;

export type RecentJob = { what: string; street: string | null; zip: string | null; when: string | null; signoffs: string[] };

export type TrackRecord = {
  permits: number;
  since: number | null;
  /** "kitchen" and how many of their permits are that kind of work. */
  matching: { word: string; count: number } | null;
  /** Jobs in the homeowner's ZIP, and the streets they were on. */
  nearby: { zip: string; count: number; streets: string[] } | null;
  /** City inspection sign-offs across the permits checked. */
  inspections: { checked: number; signoffs: number; trades: string[]; finaled: number } | null;
  license: { active: boolean; status: string; since: number | null; classes: string[] } | null;
  recent: RecentJob[];
};

const hay = (p: RecordPermit) => `${p.work_type ?? ""} ${p.description ?? ""}`.toLowerCase();
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "1553 ILIKAI AV" → "Ilikai Av". Never the house number. */
export const streetOf = (address: string | null | undefined): string | null => {
  const a = (address ?? "").split(",")[0].replace(/\s+/g, " ").trim();
  if (!a) return null;
  const street = a.replace(/^\d+[a-z]?(-\d+)?\s+/i, "").replace(/\s+(apt|unit|#)\s*\S+$/i, "");
  return street && !/^\d/.test(street) ? titleCase(street) : null;
};

/** What the job was, in a few plain words. */
export const jobWhat = (p: RecordPermit): string => {
  const d = (p.description ?? "").trim();
  const head = d.includes(" · ") ? d.split(" · ")[0] : d.split("—").pop()?.trim() || p.work_type || "Permitted work";
  const clean = head.replace(/^\([A-Z]+\)\s*/, "").replace(/\//g, " and ").replace(/\.\s.*$/, "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

const isRealLicenseStatus = (s: string | null | undefined) => !!s && s.trim().length > 0;

export const trackRecord = (
  permits: TrackPermit[],
  data: IntakeData,
  inspections: Inspection[] | null,
  license: LicenseFacts,
): TrackRecord => {
  const sorted = [...permits].sort((a, b) => (b.issued_date ?? "").localeCompare(a.issued_date ?? ""));
  const years = sorted.map((p) => p.issued_date).filter((d): d is string => !!d).sort();

  // Their kind of work.
  const work = workFor(data);
  const matching = work ? { word: work.word, count: sorted.filter((p) => work.keywords.some((k) => matchesKeyword(hay(p), k))).length } : null;

  // Near them: same ZIP, with the streets.
  const zip = data.address && !data.address.skipped ? data.address.zip?.trim() : undefined;
  let nearby: TrackRecord["nearby"] = null;
  if (zip && /^\d{5}$/.test(zip)) {
    const near = sorted.filter((p) => (p.zip ?? "").startsWith(zip));
    const streets = [...new Set(near.map((p) => streetOf(p.address)).filter((s): s is string => !!s))].slice(0, 4);
    nearby = { zip, count: near.length, streets };
  }

  // The city's inspection sign-offs.
  let insp: TrackRecord["inspections"] = null;
  const found = (inspections ?? []).filter((i) => i.found);
  if (found.length) {
    const done = found.flatMap((i) => (i.approvals ?? []).filter((a) => a.status === "complete"));
    insp = {
      checked: found.length,
      signoffs: done.length,
      trades: [...new Set(done.map((a) => a.label))],
      finaled: found.filter((i) => i.lifecycle === "closed").length,
    };
  }

  // The state license board.
  let lic: TrackRecord["license"] = null;
  if (license && isRealLicenseStatus(license.status)) {
    const status = license.status!.trim();
    lic = {
      active: /active|current|clear/i.test(status) && !/inactive|expired|suspend|revoke/i.test(status),
      status,
      since: license.issue_date && /^\d{4}/.test(license.issue_date) ? Number(license.issue_date.slice(0, 4)) : null,
      classes: (license.classifications ?? []).filter(Boolean).slice(0, 3),
    };
  }

  // Their most recent jobs, with what the city signed off.
  const byFolder = new Map((inspections ?? []).map((i) => [i.folder_number, i]));
  const recent = sorted.slice(0, 5).map((p) => {
    const i = p.permit_number ? byFolder.get(p.permit_number) : undefined;
    return {
      what: jobWhat(p),
      street: streetOf(p.address),
      zip: p.zip ? p.zip.slice(0, 5) : null,
      when: p.issued_date ? monthYear(p.issued_date) : null,
      signoffs: (i?.approvals ?? []).filter((a) => a.status === "complete").map((a) => a.label),
    };
  });

  return {
    permits: sorted.length,
    since: years[0] ? Number(years[0].slice(0, 4)) : null,
    matching: matching && matching.count > 0 ? matching : null,
    nearby: nearby && nearby.count > 0 ? nearby : null,
    inspections: insp,
    license: lic,
    recent,
  };
};

/** The few chips for the strip at the top of the intake, most relevant first. */
export const trackChips = (t: TrackRecord): { id: string; text: string }[] => {
  const out: { id: string; text: string }[] = [];
  if (t.matching) out.push({ id: "matching", text: `${t.matching.count} ${t.matching.word} permit${t.matching.count === 1 ? "" : "s"}` });
  if (t.nearby) out.push({ id: "nearby", text: `${t.nearby.count} job${t.nearby.count === 1 ? "" : "s"} in ${t.nearby.zip}` });
  if (t.inspections && t.inspections.signoffs > 0) out.push({ id: "inspections", text: `${t.inspections.signoffs} city inspection${t.inspections.signoffs === 1 ? "" : "s"} passed` });
  if (t.license?.active) out.push({ id: "license", text: "License active" });
  out.push({ id: "permits", text: `${t.permits} San Jose permit${t.permits === 1 ? "" : "s"}${t.since ? ` since ${t.since}` : ""}` });
  return out;
};
