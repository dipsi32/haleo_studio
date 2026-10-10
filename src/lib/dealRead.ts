// The deal read: what a contractor needs to decide, in under a minute,
// whether an inbound brief is worth a site visit.
//
// Pure and honest by construction. Every line comes from something the
// homeowner entered or from a public record already attached to the brief.
// Nothing here estimates a price or scores a homeowner: where we can't say,
// the read says what is missing and lets the contractor ask.
import type { BriefSnapshot } from "@/lib/contractors";

export type ProjectKind = "addition" | "whole-home" | "kitchen" | "bathroom" | "other";

export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  addition: "Addition or ADU",
  "whole-home": "Whole-home remodel",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  other: "Other",
};

// A contractor's fit criteria. Every field is optional: an empty box means
// "show me everything", never "reject everything".
export type BuyBox = {
  min_budget_k?: number | null;
  min_sqft?: number | null;
  project_types?: ProjectKind[] | null;
};

export const hasBuyBoxCriteria = (b: BuyBox | null | undefined): boolean =>
  Boolean(b && ((b.min_budget_k ?? 0) > 0 || (b.min_sqft ?? 0) > 0 || (b.project_types?.length ?? 0) > 0));

// Brief snapshots in the inbox carry a few fields beyond the shared type.
export type DealSnapshot = Partial<BriefSnapshot> & { projectType?: string };

export const projectKindOf = (s: DealSnapshot): ProjectKind => {
  const label = `${s.projectType ?? ""} ${(s.rooms ?? []).join(" ")}`.toLowerCase();
  if (s.is_addition || /addition|adu/.test(label)) return "addition";
  if (/whole|full[- ]home/.test(label)) return "whole-home";
  if (/kitchen/.test(label)) return "kitchen";
  if (/bath/.test(label)) return "bathroom";
  return "other";
};

// "$300K – $400K", "$15K – $20K", "$500K+ – $500K+" → thousands.
export type ParsedBudget = { minK: number; maxK: number; openEnded: boolean };

export const parseBudget = (raw: string | undefined | null): ParsedBudget | null => {
  if (!raw) return null;
  const matches = [...raw.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*[kK](\+)?/g)];
  if (matches.length === 0) return null;
  const nums = matches.map((m) => parseFloat(m[1]));
  return {
    minK: Math.min(...nums),
    maxK: Math.max(...nums),
    openEnded: matches.some((m) => m[2] === "+"),
  };
};

const fmtK = (k: number) => (k >= 1000 ? `$${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}M` : `$${Math.round(k)}K`);
const fmtDollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export type FitLevel = "fits" | "check" | "below" | "unset";

export type DealFlag = { label: string; tone: "info" | "watch" };

export type DealRead = {
  kind: ProjectKind;
  headline: string;
  fit: { level: FitLevel; title: string; reasons: string[] };
  size: { sqft: number | null; budgetLabel: string | null; perSqft: string | null; note: string };
  permit: { label: string; note: string };
  flags: DealFlag[];
  unknowns: string[];
  completeness: { score: number; total: number; level: "strong" | "some" | "light"; have: string[]; missing: string[] };
};

const FIT_TITLE: Record<FitLevel, string> = {
  fits: "Fits what you look for",
  check: "Worth a closer look",
  below: "Outside what you look for",
  unset: "Set your fit criteria to get a yes or no here",
};

const hazardIsHigh = (v?: string | null) => /high|very/i.test(v ?? "") && !/low|moderate/i.test(v ?? "");

export const computeDealRead = (snap: DealSnapshot, buyBox?: BuyBox | null): DealRead => {
  const kind = projectKindOf(snap);
  const sqft = snap.addition_size_sqft ?? null;
  const budget = parseBudget(snap.budget);
  const photoCount = (snap.room_photo_urls?.length ?? 0) + (snap.rendering_urls?.length ?? 0);
  const planCount = snap.floorplan_urls?.length ?? 0;

  // ── size and budget (arithmetic on what they said, nothing more) ──
  let perSqft: string | null = null;
  if (budget && sqft && sqft > 0) {
    const low = (budget.minK * 1000) / sqft;
    const high = (budget.maxK * 1000) / sqft;
    perSqft = budget.openEnded && budget.minK === budget.maxK
      ? `at least ${fmtDollars(low)} per sq ft`
      : budget.minK === budget.maxK
        ? `${fmtDollars(low)} per sq ft`
        : `${fmtDollars(low)} to ${fmtDollars(high)} per sq ft`;
  }
  const budgetLabel = snap.budget ?? null;
  const size = {
    sqft,
    budgetLabel,
    perSqft,
    note: budget
      ? "Arithmetic on the homeowner's own numbers. Compare it with your recent jobs."
      : "The homeowner hasn't shared a budget.",
  };

  // ── permit path ──
  const permit =
    snap.permit_status === "yes"
      ? { label: "Permit ready", note: "Plans are far enough along to have a permit in hand." }
      : snap.permit_status === "in-progress"
        ? { label: "Permit in progress", note: "Ask who is carrying it, and where it stands." }
        : snap.permit_status === "not-yet"
          ? { label: "No permit yet", note: "Scope, plans and who pulls the permit are still open." }
          : { label: "Not stated", note: "The homeowner didn't say where permitting stands." };

  // ── flags from public records attached to the brief ──
  const flags: DealFlag[] = [];
  const risk = snap.address_risk;
  if (risk?.fire_hazard_class) flags.push({ label: `Fire hazard: ${risk.fire_hazard_class}`, tone: hazardIsHigh(risk.fire_hazard_class) ? "watch" : "info" });
  if (risk?.in_special_flood_hazard_area) flags.push({ label: `Special flood hazard area${risk.flood_zone ? ` (zone ${risk.flood_zone})` : ""}`, tone: "watch" });
  else if (risk?.flood_zone) flags.push({ label: `Flood zone ${risk.flood_zone}`, tone: "info" });
  if (risk?.seismic_hazard_type) flags.push({ label: `Seismic: ${risk.seismic_hazard_type}`, tone: "info" });
  if (kind === "addition" && planCount === 0) flags.push({ label: "No plans attached yet", tone: "watch" });

  // ── unknowns: what Haleo's read already marked as open, plus basics ──
  const unknowns: string[] = [];
  for (const section of snap.haleo_read?.sections ?? []) {
    for (const item of section.items) {
      if (item.basis === "question" && item.text.trim()) unknowns.push(item.text.trim());
    }
  }
  if (!budget) unknowns.push("What budget are you working with?");
  if (!snap.timeline || /exploring/i.test(snap.timeline)) unknowns.push("When would you like to start?");
  if (kind === "addition" && !sqft) unknowns.push("How large is the addition, roughly?");
  if (snap.permit_status == null && kind === "addition") unknowns.push("Where does permitting stand, and who is handling it?");
  const dedupedUnknowns = [...new Set(unknowns)].slice(0, 6);

  // ── how complete the brief is (effort shared, not a verdict on the person) ──
  const checks: [string, boolean][] = [
    ["Photos", photoCount > 0],
    ["Plans", planCount > 0],
    ["Budget", Boolean(budget)],
    ["Timeline", Boolean(snap.timeline) && !/exploring/i.test(snap.timeline ?? "")],
    ["Permit status", snap.permit_status != null],
    ["Haleo's read approved", Boolean(snap.haleo_read?.approvedAt)],
  ];
  const have = checks.filter(([, ok]) => ok).map(([l]) => l);
  const missing = checks.filter(([, ok]) => !ok).map(([l]) => l);
  const score = have.length;
  const completeness = { score, total: checks.length, level: score >= 5 ? ("strong" as const) : score >= 3 ? ("some" as const) : ("light" as const), have, missing };

  // ── fit against the contractor's criteria ──
  const fit = evaluateFit(kind, sqft, budget, buyBox);

  const headline = [
    PROJECT_KIND_LABEL[kind],
    sqft ? `${sqft.toLocaleString("en-US")} sq ft` : null,
    budgetLabel,
    snap.timeline ?? null,
  ].filter(Boolean).join(" · ");

  return { kind, headline, fit, size, permit, flags, unknowns: dedupedUnknowns, completeness };
};

const evaluateFit = (
  kind: ProjectKind,
  sqft: number | null,
  budget: ParsedBudget | null,
  b?: BuyBox | null,
): DealRead["fit"] => {
  if (!hasBuyBoxCriteria(b)) return { level: "unset", title: FIT_TITLE.unset, reasons: [] };
  const box = b as BuyBox;
  const below: string[] = [];
  const check: string[] = [];
  const ok: string[] = [];

  if (box.project_types && box.project_types.length > 0) {
    if (box.project_types.includes(kind)) ok.push(`${PROJECT_KIND_LABEL[kind]} is a type you take`);
    else below.push(`${PROJECT_KIND_LABEL[kind]} isn't on your list of project types`);
  }

  const min = box.min_budget_k ?? 0;
  if (min > 0) {
    if (!budget) check.push(`No budget shared, so your ${fmtK(min)} minimum can't be tested`);
    else {
      // Open-ended ("$500K+") means the top is unbounded, so test the floor.
      const top = budget.openEnded ? Infinity : budget.maxK;
      if (top < min) below.push(`Budget tops out at ${fmtK(budget.maxK)}, under your ${fmtK(min)} minimum`);
      else if (budget.minK < min) check.push(`Budget starts at ${fmtK(budget.minK)}, below your ${fmtK(min)} minimum, and reaches ${budget.openEnded ? "well above it" : fmtK(budget.maxK)}`);
      else ok.push(`Budget clears your ${fmtK(min)} minimum`);
    }
  }

  const minSqft = box.min_sqft ?? 0;
  if (minSqft > 0 && (kind === "addition" || sqft)) {
    if (!sqft) check.push(`Size not given, so your ${minSqft.toLocaleString("en-US")} sq ft minimum can't be tested`);
    else if (sqft < minSqft) below.push(`${sqft.toLocaleString("en-US")} sq ft is under your ${minSqft.toLocaleString("en-US")} sq ft minimum`);
    else ok.push(`${sqft.toLocaleString("en-US")} sq ft clears your minimum`);
  }

  if (below.length > 0) return { level: "below", title: FIT_TITLE.below, reasons: below };
  if (check.length > 0) return { level: "check", title: FIT_TITLE.check, reasons: [...check, ...ok] };
  return { level: "fits", title: FIT_TITLE.fits, reasons: ok };
};

// Stored shape → typed BuyBox, tolerant of anything a past version wrote.
export const toBuyBox = (raw: unknown): BuyBox | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const kinds = Array.isArray(r.project_types)
    ? (r.project_types.filter((k): k is ProjectKind => typeof k === "string" && k in PROJECT_KIND_LABEL))
    : null;
  return { min_budget_k: num(r.min_budget_k), min_sqft: num(r.min_sqft), project_types: kinds && kinds.length ? kinds : null };
};
