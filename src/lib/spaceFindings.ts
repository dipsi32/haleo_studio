// What Haleo noticed in the homeowner's photos, in a form both sides can act on.
// Pure helpers: types, grouping, the contractor section, and turning any
// failure into a sentence a homeowner can do something with.
import type { AnalysisItem, AnalysisSection } from "@/lib/brief";

export type FindingKind = "working" | "attention" | "check";
export type FindingAudience = "homeowner" | "contractor" | "both";

export type Finding = {
  title: string;
  detail: string;
  why: string;
  next_step: string;
  kind: FindingKind;
  audience: FindingAudience;
  basis: AnalysisItem["basis"];
  photo_url: string | null;
};

const KINDS: FindingKind[] = ["working", "attention", "check"];
const AUDIENCES: FindingAudience[] = ["homeowner", "contractor", "both"];
const BASES: AnalysisItem["basis"][] = ["grounded", "inferred", "question"];

/** Keep only well-formed findings; the model and old caches can both send odd shapes. */
export const cleanFindings = (raw: unknown): Finding[] => {
  if (!Array.isArray(raw)) return [];
  const out: Finding[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const f = r as Record<string, unknown>;
    const title = typeof f.title === "string" ? f.title.trim() : "";
    if (!title) continue;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    out.push({
      title,
      detail: str(f.detail),
      why: str(f.why),
      next_step: str(f.next_step),
      kind: KINDS.includes(f.kind as FindingKind) ? (f.kind as FindingKind) : "check",
      audience: AUDIENCES.includes(f.audience as FindingAudience) ? (f.audience as FindingAudience) : "both",
      basis: BASES.includes(f.basis as AnalysisItem["basis"]) ? (f.basis as AnalysisItem["basis"]) : "inferred",
      photo_url: typeof f.photo_url === "string" && /^https?:\/\//.test(f.photo_url) ? f.photo_url : null,
    });
  }
  return out;
};

/**
 * What the homeowner sees: the good news first (it's true and it calms),
 * then what needs attention, then questions. Contractor-only notes stay
 * out of the homeowner's list; they go in the brief.
 */
export const groupForHomeowner = (findings: Finding[]) => {
  const mine = findings.filter((f) => f.audience !== "contractor");
  return {
    working: mine.filter((f) => f.kind === "working"),
    attention: mine.filter((f) => f.kind === "attention"),
    check: mine.filter((f) => f.kind === "check"),
  };
};

/**
 * The contractor's version: everything worth a look on site, as a brief
 * section, so it rides along wherever the read goes (inbox, visit prep).
 */
export const findingsSection = (findings: Finding[]): AnalysisSection | null => {
  const onSite = findings.filter((f) => f.kind !== "working");
  if (onSite.length === 0) return null;
  return {
    key: "on_site",
    title: "Worth checking on site",
    description: "What Haleo noticed in the homeowner's photos, and what to look at when you're there.",
    items: onSite.map((f) => ({
      text: [f.title + (f.detail ? `: ${f.detail}` : ""), f.next_step].filter(Boolean).join(" — "),
      basis: f.basis,
    })),
  };
};

// Messages the server writes for people start like this. Anything else is
// technical (status codes, provider errors) and never reaches a homeowner.
const WRITTEN_FOR_PEOPLE = /^(Haleo|We |We'|Your |Try |Re-add|\d+ (more )?(photos?|files?) )/;

/**
 * Any error, as a sentence a homeowner can act on. Messages the server wrote
 * for people pass through; anything technical becomes a plain retry prompt.
 */
export const friendlyAnalysisError = (message: string | null | undefined): string => {
  const m = (message ?? "").trim();
  if (m && WRITTEN_FOR_PEOPLE.test(m)) return m;
  if (/failed to fetch|networkerror|load failed|network/i.test(m)) {
    return "Your connection dropped while Haleo was reading. Try again when you're back online.";
  }
  return "Haleo couldn't read your photos this time. Try again in a moment.";
};
