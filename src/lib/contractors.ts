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

// ───── Trust Score ─────
// 30 — permits in homeowner's area
// 20 — recency (last 12 months weighted)
// 25 — license status (active, no violations)
// 15 — project type match
// 10 — completion rate (closed / opened)
export type TrustScoreBreakdown = {
  total: number;
  components: {
    label: string;
    weight: number;
    earned: number;
    detail: string;
  }[];
};

const monthsBetween = (a: Date, b: Date) =>
  Math.abs((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));

export const computeTrustScore = (
  contractor: Contractor,
  permits: Permit[],
  license: LicenseStatus | null,
  projectKeywords: string[],
): TrustScoreBreakdown => {
  // 1. Local permit volume — 30 pts max at 20+ permits
  const localCount = permits.length;
  const localScore = Math.min(30, Math.round((localCount / 20) * 30));

  // 2. Recency — 20 pts based on last 12 months activity
  const now = new Date();
  const recent = permits.filter(p => {
    if (!p.issued_date) return false;
    const d = new Date(p.issued_date);
    return monthsBetween(d, now) <= 12;
  });
  const recencyScore = Math.min(20, Math.round((recent.length / 8) * 20));

  // 3. License — 25 pts if active + no discipline
  let licenseScore = 0;
  let licenseDetail = 'Verify on CSLB';
  if (license) {
    const isActive = (license.status ?? '').toLowerCase().includes('active') ||
                     (license.status ?? '').toLowerCase().includes('current');
    const noExp = !license.expiration_date || new Date(license.expiration_date) > now;
    if (isActive && noExp && !license.has_disciplinary_action) {
      licenseScore = 25;
      licenseDetail = 'Active, no disciplinary actions';
    } else if (isActive && noExp) {
      licenseScore = 18;
      licenseDetail = 'Active with disciplinary record';
    } else {
      licenseScore = 8;
      licenseDetail = 'License needs review';
    }
  } else if (contractor.license_number) {
    // Have a license number but no scrape yet — give half credit, nudge user to verify
    licenseScore = 12;
    licenseDetail = 'License on file — verify on CSLB';
  }

  // 4. Project type match — 15 pts based on keyword hits
  const matchCount = permits.filter(p => {
    const hay = `${p.work_type ?? ''} ${p.description ?? ''}`.toLowerCase();
    return projectKeywords.some(k => hay.includes(k.toLowerCase()));
  }).length;
  const matchScore = Math.min(15, Math.round((matchCount / 5) * 15));

  // 5. Completion rate — 10 pts
  const opened = permits.filter(p => p.issued_date).length;
  const closed = permits.filter(p => p.completed_date).length;
  const completionRate = opened > 0 ? closed / opened : 0;
  const completionScore = Math.round(completionRate * 10);

  const total = localScore + recencyScore + licenseScore + matchScore + completionScore;

  return {
    total,
    components: [
      { label: 'Local permit volume', weight: 30, earned: localScore, detail: `${localCount} permits in your area` },
      { label: 'Recent activity', weight: 20, earned: recencyScore, detail: `${recent.length} jobs in the last 12 months` },
      { label: 'License standing', weight: 25, earned: licenseScore, detail: licenseDetail },
      { label: 'Project type match', weight: 15, earned: matchScore, detail: `${matchCount} ${projectKeywords[0] ?? 'similar'} jobs` },
      { label: 'Job completion rate', weight: 10, earned: completionScore, detail: `${Math.round(completionRate * 100)}% closed permits` },
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
