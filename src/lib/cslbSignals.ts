// Plain-language formatters and signal evaluation for CSLB data.
// Every CSLB code, date, and flag is translated into something a homeowner
// can act on without knowing what "C-36" or "Workers' Comp" means.
import type { LicenseStatus } from "@/lib/contractors";

// ───── CSLB classification → plain language ─────
// Source: https://www.cslb.ca.gov/About_us/Library/Licensing_Classifications/
// Covers the classes a residential homeowner is most likely to see.
export const CSLB_CLASSIFICATIONS: Record<string, string> = {
  A: "Engineering Contractor",
  B: "General Contractor",
  "B-2": "Residential Remodeling",
  "C-2": "Insulation & Acoustical",
  "C-4": "Boiler, Hot-Water Heating & Steam Fitting",
  "C-5": "Framing & Rough Carpentry",
  "C-6": "Cabinet, Millwork & Finish Carpentry",
  "C-7": "Low Voltage Systems",
  "C-8": "Concrete",
  "C-9": "Drywall",
  "C-10": "Electrical",
  "C-11": "Elevator",
  "C-12": "Earthwork & Paving",
  "C-13": "Fencing",
  "C-15": "Flooring & Floor Covering",
  "C-16": "Fire Protection",
  "C-17": "Glazing",
  "C-20": "HVAC (Heating & Air Conditioning)",
  "C-21": "Building Moving & Demolition",
  "C-22": "Asbestos Abatement",
  "C-23": "Ornamental Metal",
  "C-27": "Landscaping",
  "C-28": "Lock & Security Equipment",
  "C-29": "Masonry",
  "C-31": "Construction Zone Traffic Control",
  "C-32": "Parking & Highway Improvement",
  "C-33": "Painting & Decorating",
  "C-34": "Pipeline",
  "C-35": "Lathing & Plastering",
  "C-36": "Plumbing",
  "C-38": "Refrigeration",
  "C-39": "Roofing",
  "C-42": "Sanitation Systems",
  "C-43": "Sheet Metal",
  "C-45": "Sign",
  "C-46": "Solar",
  "C-47": "General Manufactured Housing",
  "C-49": "Tree & Palm",
  "C-50": "Reinforcing Steel",
  "C-51": "Structural Steel",
  "C-53": "Swimming Pool",
  "C-54": "Ceramic & Mosaic Tile",
  "C-55": "Water Conditioning",
  "C-57": "Well Drilling",
  "C-60": "Welding",
  "C-61": "Limited Specialty",
  ASB: "Asbestos Certification",
  HAZ: "Hazardous Substance Removal",
};

const stripPrefix = (raw: string): string => {
  // Handles "B-General", "C-36 Plumbing", "C36", "Class C-10" etc.
  return raw
    .replace(/^class\s+/i, "")
    .replace(/^([A-Z]{1,3}-?\d{0,2})\s*[-–:]?\s*.*$/i, "$1")
    .toUpperCase()
    .replace(/^([A-Z])(\d)/, "$1-$2");
};

export const classificationLabel = (raw: string): string => {
  if (!raw) return "";
  const code = stripPrefix(raw.trim());
  return CSLB_CLASSIFICATIONS[code] ?? raw.trim();
};

export const classificationLabels = (codes: string[] | null | undefined): string[] => {
  if (!codes || codes.length === 0) return [];
  // De-dupe while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const label = classificationLabel(c);
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
};

// ───── License status evaluation ─────
export type LicenseTone = "active" | "expiring" | "expired" | "suspended" | "unknown";

export type LicenseSignal = {
  tone: LicenseTone;
  badgeLabel: string;
  expirationLabel: string | null;
  yearsLicensed: number | null;
  classifications: string[];
};

const monthsUntil = (iso: string): number => {
  const exp = new Date(iso);
  const now = new Date();
  return (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
};

const formatLong = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export const evaluateLicense = (license: LicenseStatus | null): LicenseSignal => {
  if (!license || !license.scrape_succeeded) {
    return {
      tone: "unknown",
      badgeLabel: "License unverified",
      expirationLabel: null,
      yearsLicensed: null,
      classifications: classificationLabels(license?.classifications ?? null),
    };
  }
  const status = (license.status ?? "").toLowerCase();
  const exp = license.expiration_date;
  const monthsLeft = exp ? monthsUntil(exp) : null;
  const isExpired = monthsLeft != null && monthsLeft < 0;
  const isSuspended = status.includes("suspend") || status.includes("revoked") || status.includes("inactive");
  const isActive = (status.includes("active") || status.includes("current")) && !isExpired && !isSuspended;

  let tone: LicenseTone = "unknown";
  let badgeLabel = "License unverified";
  if (isSuspended) {
    tone = "suspended";
    badgeLabel = status.includes("revoked") ? "License Revoked" : "License Suspended";
  } else if (isExpired) {
    tone = "expired";
    badgeLabel = "License Expired";
  } else if (isActive) {
    if (monthsLeft != null && monthsLeft <= 3) {
      tone = "expiring";
      badgeLabel = "License Expiring Soon";
    } else {
      tone = "active";
      badgeLabel = "License Active";
    }
  }

  const expirationLabel = exp
    ? tone === "expired"
      ? `Expired ${formatLong(exp)}`
      : tone === "expiring"
        ? `Expiring soon — ${formatLong(exp)}`
        : `Valid through ${formatLong(exp)}`
    : null;

  let yearsLicensed: number | null = null;
  if (license.issue_date) {
    const issued = new Date(license.issue_date);
    const diff = (Date.now() - issued.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    yearsLicensed = Math.max(0, Math.floor(diff));
  }

  return {
    tone,
    badgeLabel,
    expirationLabel,
    yearsLicensed,
    classifications: classificationLabels(license.classifications),
  };
};

// ───── Bond + Workers' Comp ─────
export type CoverageStatus = "verified" | "missing" | "unknown";

const evaluateCoverage = (raw: string | null | undefined, missingPatterns: RegExp[]): CoverageStatus => {
  if (!raw) return "unknown";
  const v = raw.toLowerCase();
  if (missingPatterns.some(re => re.test(v))) return "missing";
  if (/active|current|on file|filed|exempt|issued|valid|yes/.test(v)) return "verified";
  return "unknown";
};

export const evaluateBond = (license: LicenseStatus | null): CoverageStatus =>
  license?.scrape_succeeded
    ? evaluateCoverage(license.bond_status, [/none/, /not on file/, /cancel/, /expired/, /no bond/])
    : "unknown";

export const evaluateWorkersComp = (license: LicenseStatus | null): CoverageStatus =>
  license?.scrape_succeeded
    ? evaluateCoverage(license.workers_comp_status, [/none/, /not on file/, /cancel/, /expired/, /no .*comp/])
    : "unknown";

// ───── Disciplinary history ─────
export type DisciplineSignal = {
  hasRecord: boolean;
  known: boolean; // known === false means we couldn't verify
  notes: string | null;
};

export const evaluateDiscipline = (license: LicenseStatus | null): DisciplineSignal => {
  if (!license || !license.scrape_succeeded) {
    return { hasRecord: false, known: false, notes: null };
  }
  return {
    hasRecord: !!license.has_disciplinary_action,
    known: true,
    notes: license.disciplinary_notes ?? null,
  };
};

// ───── Business name match ─────
export type NameMatchSignal = {
  status: "match" | "mismatch" | "unknown";
  cslbName: string | null;
  permitName: string | null;
};

const normalizeName = (s: string): string =>
  s.toLowerCase()
    .replace(/[.,'"`]/g, "")
    .replace(/\b(inc|llc|corp|co|company|incorporated|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const evaluateNameMatch = (
  license: LicenseStatus | null,
  permitDisplayName: string | null,
): NameMatchSignal => {
  const cslbName = license?.scrape_succeeded ? license.business_name ?? null : null;
  if (!cslbName || !permitDisplayName) {
    return { status: "unknown", cslbName, permitName: permitDisplayName };
  }
  const a = normalizeName(cslbName);
  const b = normalizeName(permitDisplayName);
  if (!a || !b) return { status: "unknown", cslbName, permitName: permitDisplayName };
  // Match if either contains the other (handles DBAs and short forms)
  const status = a === b || a.includes(b) || b.includes(a) ? "match" : "mismatch";
  return { status, cslbName, permitName: permitDisplayName };
};

// ───── Plain-language explanations (used in tooltips) ─────
export const EXPLAIN = {
  bond:
    "A contractor's bond is a financial guarantee held by California. If the contractor fails to finish your job or breaks the contract, you can file a claim against the bond.",
  workersComp:
    "Workers' Comp means if anyone gets injured working on your home, you're protected. Always verify this before signing a contract.",
  discipline:
    "CSLB tracks complaints, citations, and disciplinary actions filed against licensed contractors. We always surface this — never hide it.",
  nameMatch:
    "We compare the business name on the CSLB license to the names on permits they've actually pulled. A mismatch can mean they operate under different names — sometimes a fraud signal.",
  active:
    "An active license means the contractor is currently allowed to perform work in California. We check this directly with CSLB.",
  expiring:
    "Their CSLB license expires within 90 days. Ask them when they plan to renew before signing a contract.",
  expired:
    "Their CSLB license has expired. They cannot legally perform contracting work in California until it's renewed.",
  suspended:
    "CSLB has suspended this contractor's license. Do not hire them until the suspension is lifted.",
  unverified:
    "We weren't able to read live data from CSLB. Tap below to verify directly on the CSLB site.",
};
