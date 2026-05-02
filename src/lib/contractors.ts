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

// ───── Trust Score (out of 100) ─────
// 7-signal model. License standing was removed in favor of richer
// public-record signals from San Jose.
//
//  25 — Local permit volume (≥20 permits in area)
//  20 — Recent activity (last 12 months)
//  15 — Project type match (similar work)
//  15 — Job completion rate (closed / opened)
//  15 — Expired-without-Final rate (computed from existing permit data)
//   5 — Inspection failure rate (Coming soon — full credit until live)
//   5 — Open code violations on past job sites (Coming soon until cached)
export type TrustScoreBreakdown = {
  total: number;
  components: {
    label: string;
    weight: number;
    earned: number;
    detail: string;
    status?: 'live' | 'coming_soon';
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
  _license: LicenseStatus | null, // signature kept for compat; no longer used
  projectKeywords: string[],
  signals: TrustSignals = null,
): TrustScoreBreakdown => {
  // 1. Local permit volume — 25 pts max at 20+ permits
  const localCount = permits.length;
  const localScore = Math.min(25, Math.round((localCount / 20) * 25));

  // 2. Recency — 20 pts based on last 12 months activity (8+ jobs = full)
  const now = new Date();
  const recent = permits.filter(p => {
    if (!p.issued_date) return false;
    const d = new Date(p.issued_date);
    return monthsBetween(d, now) <= 12;
  });
  const recencyScore = Math.min(20, Math.round((recent.length / 8) * 20));

  // 3. Project type match — 15 pts (5+ matches = full)
  const matchCount = permits.filter(p => {
    const hay = `${p.work_type ?? ''} ${p.description ?? ''}`.toLowerCase();
    return projectKeywords.some(k => hay.includes(k.toLowerCase()));
  }).length;
  const matchScore = Math.min(15, Math.round((matchCount / 5) * 15));

  // 4. Completion rate — 15 pts (closed / opened)
  const opened = permits.filter(p => p.issued_date).length;
  const closed = permits.filter(p => p.completed_date).length;
  const completionRate = opened > 0 ? closed / opened : 0;
  const completionScore = Math.round(completionRate * 15);

  // 5. Expired-without-Final — 15 pts. Penalize the rate, not the count.
  let expiredScore = 15;
  let expiredDetail = 'No data yet';
  if (signals && signals.permits_old_enough > 0) {
    const rate = signals.expired_without_final / signals.permits_old_enough;
    // 0% = 15 pts, 50%+ = 0 pts (linear)
    expiredScore = Math.max(0, Math.round(15 * (1 - rate / 0.5)));
    expiredDetail = `${signals.expired_without_final} of ${signals.permits_old_enough} older permits never finalized`;
  } else if (signals) {
    expiredDetail = 'Not enough older permits to evaluate';
  }

  // 6. Inspection failure rate — 5 pts (Coming soon)
  const inspectionScore = 5;
  const inspectionDetail = 'Coming soon — pulling pass/fail history';

  // 7. Open code violations on past job sites — 5 pts.
  let violationScore = 5;
  let violationDetail = 'Coming soon — checking past job addresses';
  let violationStatus: 'live' | 'coming_soon' = 'coming_soon';
  if (signals && signals.addresses_checked > 0) {
    violationStatus = 'live';
    const rate = signals.addresses_with_violations / signals.addresses_checked;
    // 0% = 5 pts, 25%+ = 0 pts
    violationScore = Math.max(0, Math.round(5 * (1 - rate / 0.25)));
    violationDetail = signals.open_code_violations === 0
      ? `Clean — checked ${signals.addresses_checked} past job addresses`
      : `${signals.open_code_violations} open case(s) at ${signals.addresses_with_violations} of ${signals.addresses_checked} past sites`;
  }

  const total = localScore + recencyScore + matchScore + completionScore +
                expiredScore + inspectionScore + violationScore;

  return {
    total,
    components: [
      { label: 'Local permit volume', weight: 25, earned: localScore, detail: `${localCount} permits in your area`, status: 'live' },
      { label: 'Recent activity', weight: 20, earned: recencyScore, detail: `${recent.length} jobs in the last 12 months`, status: 'live' },
      { label: 'Project type match', weight: 15, earned: matchScore, detail: `${matchCount} ${projectKeywords[0] ?? 'similar'} jobs`, status: 'live' },
      { label: 'Job completion rate', weight: 15, earned: completionScore, detail: `${Math.round(completionRate * 100)}% closed permits`, status: 'live' },
      { label: 'Expired without Final', weight: 15, earned: expiredScore, detail: expiredDetail, status: signals ? 'live' : 'coming_soon' },
      { label: 'Inspection failure rate', weight: 5, earned: inspectionScore, detail: inspectionDetail, status: 'coming_soon' },
      { label: 'Open code violations', weight: 5, earned: violationScore, detail: violationDetail, status: violationStatus },
    ],
  };
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
