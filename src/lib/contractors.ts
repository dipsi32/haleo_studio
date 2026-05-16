// Pure helpers for the Contractor Discovery feature.
// Trust score, project-type matching, and brief snapshots — kept testable.
import type { IntakeData } from "@/lib/intake";
import { ROOM_LABELS, scopeFor } from "@/lib/intake";
import { buildHomeownerLayer, buildContractorLayer, groupContractorLinesByTrade } from "@/lib/brief";

export type Contractor = {
  id: string;
  license_number: string;
  name: string;
  company: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  permit_count: number;
  last_permit_date: string | null;
};

export type Permit = {
  id: string;
  contractor_id: string;
  permit_number: string;
  work_type: string | null;
  description: string | null;
  valuation: number | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  issued_date: string | null;
  completed_date: string | null;
  status: string | null;
};

export type LicenseStatus = {
  license_number: string;
  status: string | null;
  business_name: string | null;
  classifications: string[] | null;
  issue_date: string | null;
  expiration_date: string | null;
  has_disciplinary_action: boolean;
  disciplinary_notes: string | null;
  workers_comp_status: string | null;
  bond_status: string | null;
  scrape_succeeded: boolean;
  last_checked_at: string;
  deep_link: string;
};

// CSLB deep-link
export const cslbDeepLink = (license: string) =>
  `https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${encodeURIComponent(license)}`;

// ───── Haleo Trust Index — v2 ─────
// Scored out of 100 with a DYNAMIC denominator: signals we couldn't read
// yet (CSLB scrape failed, no SJ trust-signals row, etc.) drop their
// weight from BOTH numerator and denominator instead of inflating the
// score with free credit. Penalties apply *after* normalization.
//
//  Permit-derived (San Jose open data)
//   20  Local track record         (≥20 permits in area = full credit)
//   15  Recent activity            (last 12 months, 8+ jobs = full)
//   12  Right kind of work         (project-type keyword match)
//   12  Finishes what they start   (closed ÷ opened)
//   13  No abandoned permits       (only when permits_old_enough > 0)
//
//  CSLB-derived (only when license scrape succeeded)
//   18  License standing           (active=18, expiring=14, expired/suspended=0)
//    5  Bond on file
//    5  Workers' Comp on file
//
//  Penalties (subtracted from final 0–100 score, then clamped)
//  −15  CSLB has disciplinary actions on record
//  −10  Business name mismatch (CSLB record vs. permits)
//
//  Phase-2 informational rows (weight 0 — shown but do not move the score)
//   ·  Inspection pass rate
//   ·  Code violations on past job sites (becomes live once we've checked addresses)
export type ComponentStatus = 'live' | 'pending' | 'penalty' | 'coming_soon';

export type TrustScoreBreakdown = {
  total: number;
  components: {
    label: string;
    what: string;
    weight: number;   // contribution to denominator (0 when not yet measurable)
    earned: number;   // contribution to numerator
    detail: string;
    status: ComponentStatus;
  }[];
};

export type TrustSignals = {
  open_code_violations: number;
  addresses_with_violations: number;
  addresses_checked: number;
  expired_without_final: number;
  permits_old_enough: number;
} | null;

const monthsBetween = (a: Date, b: Date) =>
  Math.abs((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));

export const computeTrustScore = (
  contractor: Contractor,
  permits: Permit[],
  license: LicenseStatus | null,
  projectKeywords: string[],
  signals: TrustSignals = null,
): TrustScoreBreakdown => {
  const components: TrustScoreBreakdown['components'] = [];
  const now = new Date();

  // ── Permit-derived signals ──────────────────────────────────────────────

  // 1. Local track record — 20 pts max at 20+ permits
  const localCount = permits.length;
  const localScore = Math.min(20, Math.round((localCount / 20) * 20));
  components.push({
    label: 'Local track record',
    what: "How many permitted jobs they've pulled in your area. More local work = more proof they actually build here.",
    weight: 20, earned: localScore,
    detail: `${localCount} permits in your area`,
    status: 'live',
  });

  // 2. Recent activity — 15 pts (8+ jobs in last 12mo = full)
  const recent = permits.filter(p => {
    if (!p.issued_date) return false;
    return monthsBetween(new Date(p.issued_date), now) <= 12;
  });
  const recencyScore = Math.min(15, Math.round((recent.length / 8) * 15));
  components.push({
    label: 'Recent activity',
    what: "Are they actively working right now? We count permits pulled in the last 12 months so you don't hire someone who's gone quiet.",
    weight: 15, earned: recencyScore,
    detail: `${recent.length} jobs in the last 12 months`,
    status: 'live',
  });

  // 3. Right kind of work — 12 pts (5+ matches = full)
  const matchCount = permits.filter(p => {
    const hay = `${p.work_type ?? ''} ${p.description ?? ''}`.toLowerCase();
    return projectKeywords.some(k => hay.includes(k.toLowerCase()));
  }).length;
  const matchScore = Math.min(12, Math.round((matchCount / 5) * 12));
  components.push({
    label: 'Right kind of work',
    what: `How often their past jobs match what you're building. We look for ${projectKeywords[0] ?? 'similar'}-type work in their permit history.`,
    weight: 12, earned: matchScore,
    detail: `${matchCount} ${projectKeywords[0] ?? 'similar'} jobs`,
    status: 'live',
  });

  // (Removed: "Finishes what they start" and "No abandoned permits" —
  // SJ Open Data drops finalized permits from its feeds, so completed_date
  // is unreliable and these metrics were misleading.)

  // ── CSLB-derived signals (only when scrape succeeded) ───────────────────
  const cslbReady = !!(license && license.scrape_succeeded);

  if (cslbReady && license) {
    // 6. License standing — 18 pts
    const status = (license.status ?? '').toLowerCase();
    const exp = license.expiration_date;
    const monthsLeft = exp
      ? (new Date(exp).getFullYear() - now.getFullYear()) * 12 + (new Date(exp).getMonth() - now.getMonth())
      : null;
    const isExpired = monthsLeft != null && monthsLeft < 0;
    const isSuspended = /suspend|revoked|inactive/.test(status);
    const isActive = (/active|current/.test(status)) && !isExpired && !isSuspended;
    let licScore = 0;
    let licDetail = 'License not active';
    if (isSuspended) { licScore = 0; licDetail = /revoked/.test(status) ? 'License revoked by CSLB' : 'License suspended by CSLB'; }
    else if (isExpired) { licScore = 0; licDetail = 'License expired'; }
    else if (isActive && monthsLeft != null && monthsLeft <= 3) { licScore = 14; licDetail = 'License active but expires within 90 days'; }
    else if (isActive) { licScore = 18; licDetail = 'License active and in good standing'; }
    components.push({
      label: 'License in good standing',
      what: "We check the contractor's CSLB record directly. Active = legally allowed to do the work; expired or suspended is an immediate red flag.",
      weight: 18, earned: licScore, detail: licDetail, status: 'live',
    });

    // 7. Bond on file — 5 pts
    const bondVerified = !!license.bond_status &&
      /active|current|on file|filed|exempt|issued|valid|yes/i.test(license.bond_status) &&
      !/none|cancel|expired|no bond/i.test(license.bond_status);
    components.push({
      label: 'Bond on file',
      what: "California requires every licensed contractor to post a $25,000 bond. If they walk off your job, you can file a claim against it.",
      weight: 5, earned: bondVerified ? 5 : 0,
      detail: bondVerified ? 'Active contractor bond on file' : 'No active bond on CSLB record',
      status: 'live',
    });

    // 8. Workers' Comp — 5 pts
    const wcVerified = !!license.workers_comp_status &&
      /active|current|on file|filed|exempt|issued|valid|yes/i.test(license.workers_comp_status) &&
      !/none|cancel|expired|no .*comp/i.test(license.workers_comp_status);
    components.push({
      label: "Workers' Comp coverage",
      what: "If a worker is injured on your property and the contractor has no Workers' Comp, YOU can be held liable. We verify this directly with CSLB.",
      weight: 5, earned: wcVerified ? 5 : 0,
      detail: wcVerified ? "Workers' Comp on file" : "No Workers' Comp on file — homeowner liability risk",
      status: 'live',
    });
  } else {
    components.push({
      label: 'License in good standing',
      what: "We check the contractor's CSLB record directly for license status, bond, and Workers' Comp coverage.",
      weight: 0, earned: 0,
      detail: 'Verifying with CSLB…',
      status: 'pending',
    });
  }

  // ── Phase-2 informational rows (visible, weight depends on data) ────
  if (signals && signals.addresses_checked > 0) {
    const rate = signals.addresses_with_violations / signals.addresses_checked;
    const violationScore = Math.max(0, Math.round(5 * (1 - rate / 0.25)));
    components.push({
      label: 'No code violations on past jobs',
      what: "We check the addresses they've worked at against San Jose's open code-enforcement cases. Open cases = work that didn't hold up.",
      weight: 5, earned: violationScore,
      detail: signals.open_code_violations === 0
        ? `Clean — checked ${signals.addresses_checked} past job addresses`
        : `${signals.open_code_violations} open case(s) at ${signals.addresses_with_violations} of ${signals.addresses_checked} past sites`,
      status: 'live',
    });
  } else {
    components.push({
      label: 'No code violations on past jobs',
      what: "We check addresses they've worked at against open code-enforcement cases.",
      weight: 0, earned: 0,
      detail: 'Checking past job sites…',
      status: 'pending',
    });
  }

  // (Removed: "Inspection pass rate" — city portal doesn't publish a clean
  // pass/fail per-inspection feed, so we can't measure this honestly yet.)


  // ── Normalize to 100, then apply CSLB penalties ─────────────────────────
  const weightSum = components.reduce((s, c) => s + c.weight, 0);
  const earnedSum = components.reduce((s, c) => s + c.earned, 0);
  let normalized = weightSum > 0 ? Math.round((earnedSum / weightSum) * 100) : 0;

  // Penalty: disciplinary actions (−15)
  if (cslbReady && license && license.has_disciplinary_action) {
    normalized -= 15;
    components.push({
      label: 'CSLB disciplinary action on record',
      what: 'CSLB has formal complaints, citations, or disciplinary actions on this contractor. Read the details before contacting.',
      weight: 0, earned: -15,
      detail: license.disciplinary_notes ?? 'Disciplinary record found — review on CSLB before hiring',
      status: 'penalty',
    });
  }

  // Penalty: business name mismatch (−10)
  if (cslbReady && license && license.business_name && (contractor.company || contractor.name)) {
    const norm = (s: string) => s.toLowerCase()
      .replace(/[.,'"`]/g, '')
      .replace(/\b(inc|llc|corp|co|company|incorporated|the)\b/g, '')
      .replace(/\s+/g, ' ').trim();
    const a = norm(license.business_name);
    const b = norm(contractor.company ?? contractor.name);
    if (a && b && a !== b && !a.includes(b) && !b.includes(a)) {
      normalized -= 10;
      components.push({
        label: 'Business name mismatch',
        what: "The name on the CSLB license doesn't match the name on the permits they've pulled. Verify which entity you'd be contracting with.",
        weight: 0, earned: -10,
        detail: `CSLB: ${license.business_name} · Permits: ${contractor.company ?? contractor.name}`,
        status: 'penalty',
      });
    }
  }

  const total = Math.max(0, Math.min(100, normalized));
  return { total, components };
};

// ───── Project keyword extraction ─────
export const projectKeywords = (data: IntakeData): string[] => {
  if (!data.room) return ['remodel'];
  if (data.room === 'kitchen') return ['kitchen', 'remodel'];
  if (data.room === 'bathroom') return ['bath', 'remodel'];
  if (data.room === 'addition') return ['addition', 'add'];
  if (data.room === 'full-home') return ['remodel', 'alteration'];
  if (data.room === 'living') return ['living', 'remodel'];
  if (data.room === 'bedroom') return ['bedroom', 'remodel'];
  if (data.room === 'office') return ['office', 'remodel'];
  return ['remodel'];
};

// ───── Project label for headlines ─────
export const projectTypeLabel = (data: IntakeData): string => {
  if (!data.room) return 'remodel';
  if (data.room === 'addition') return 'addition';
  if (data.room === 'full-home') return 'whole-home remodel';
  return `${ROOM_LABELS[data.room].toLowerCase()} remodel`;
};

// ───── Distance (Haversine, miles) ─────
export const milesBetween = (a: { lat?: number | null; lng?: number | null }, b: { lat?: number | null; lng?: number | null }): number | null => {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 3958.8;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin), Math.sqrt(1 - sin));
};

// ───── Brief snapshot for outreach ─────
// Kept as plain JSON so it's stable in the DB even if the brief logic evolves.
export type BriefSnapshot = {
  homeowner_name?: string;
  neighborhood: string;
  scope_summary: string;
  vision: string;
  frustrations: string[];
  rooms: string[];
  scope_label?: string;
  timeline?: string;
  budget?: string;
  // Inspiration / reference imagery the homeowner attached
  rendering_urls: string[];
  // Actual photos & floorplans of the room (homeowner-uploaded)
  room_photo_urls: string[];
  floorplan_urls: string[];
  // Haleo's grounded read of the space — shown to contractor as an attachment
  haleo_read?: {
    summary: string;
    sections: { title: string; items: { text: string; basis: "grounded" | "inferred" | "question" }[] }[];
    approvedAt?: string;
  };
  // Homeowner's correction note if they flagged Haleo's read as off
  read_feedback?: string;
  trade_groups: { trade: string; lines: string[] }[];
  // Addition-specific quick facts so contractors can scan-and-decide
  addition_size_sqft?: number;
  permit_status?: "yes" | "in-progress" | "not-yet";
  is_addition?: boolean;
};

const fmtMoney = (v?: number) => (v == null ? '' : v >= 500 ? '$500K+' : `$${v}K`);

export const buildBriefSnapshot = (data: IntakeData, homeownerName?: string): BriefSnapshot => {
  const scope = scopeFor(data.scope);
  const timeline = data.timeline === 'asap' ? 'Ready to start'
    : data.timeline === '1-3' ? '1–3 months'
    : data.timeline === '3-6' ? '3–6 months'
    : data.timeline === 'exploring' ? 'Exploring' : undefined;
  const budget = data.budgetSkipped || data.budgetMin == null
    ? undefined
    : `${fmtMoney(data.budgetMin)} – ${fmtMoney(data.budgetMax)}`;
  const urlOf = (m: { url: string; uploadedUrl?: string }) => m.uploadedUrl || (m.url && !m.url.startsWith('blob:') ? m.url : '');
  const renderings = data.media
    .filter(m => m.kind === 'inspiration')
    .map(urlOf)
    .filter(Boolean);
  const roomPhotos = data.media
    .filter(m => m.kind === 'photo' || m.kind === 'video')
    .map(urlOf)
    .filter(Boolean);
  const floorplans = data.media
    .filter(m => m.kind === 'floorplan')
    .map(urlOf)
    .filter(Boolean);
  const groups = groupContractorLinesByTrade(buildContractorLayer(data));
  const haleo = data.approvedAnalysis ? {
    summary: data.approvedAnalysis.summary,
    sections: data.approvedAnalysis.sections.map(s => ({
      title: s.title,
      items: s.items.map(it => ({ text: it.text, basis: it.basis })),
    })),
    approvedAt: data.approvedAnalysis.approvedAt,
  } : undefined;
  return {
    homeowner_name: homeownerName,
    neighborhood: data.address?.city ?? 'your area',
    scope_summary: buildHomeownerLayer(data),
    vision: data.notes ?? '',
    frustrations: data.painPoints,
    rooms: data.room ? [ROOM_LABELS[data.room]] : [],
    scope_label: scope?.label,
    timeline,
    budget,
    rendering_urls: renderings,
    room_photo_urls: roomPhotos,
    floorplan_urls: floorplans,
    haleo_read: haleo,
    read_feedback: data.readFeedback?.note,
    trade_groups: groups.map(g => ({ trade: g.meta.label, lines: g.lines.map(l => l.text) })),
    addition_size_sqft: data.room === 'addition' ? data.additionSize : undefined,
    permit_status: data.room === 'addition' ? data.permitStatus : undefined,
    is_addition: data.room === 'addition',
  };
};

// ───── Session id (matches space_analyses pattern) ─────
const SESSION_KEY = 'haleo:session_id';
export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
};
