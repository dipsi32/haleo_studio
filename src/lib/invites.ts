// Contractor-owned brief links.
//
// A contractor sends a prospect a link before the site visit. The homeowner
// completes the normal brief and the brief goes to that contractor only.
// The server owns the rules (supabase/migrations/20261006180000_*): this file
// is the thin client around the three functions it exposes, plus the small
// bit of state that carries "who invited me" across the brief flow.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { BriefSnapshot } from "@/lib/contractors";

export type InviteStatus = "open" | "completed" | "expired" | "revoked";

export type InviteContractor = {
  id: string;
  slug: string | null;
  name: string;
  company: string | null;
  city: string | null;
  /** From the contractor's own profile, when they've filled it in. */
  tagline?: string | null;
  logoUrl?: string | null;
  yearsInBusiness?: number | null;
  specialties?: string | null;
  gallery?: string[];
};

export type InvitePublic = { status: InviteStatus; contractor: InviteContractor };

export const contractorDisplayName = (c: Pick<InviteContractor, "company" | "name">): string =>
  c.company?.trim() || c.name;

/**
 * The person's first name when the record has one distinct from the company
 * ("JOHN DOE" at "ACME BUILDERS" → "John"), else null. Permit records are
 * often all caps, and sometimes repeat the company as the "name".
 */
export const personFirstName = (c: Pick<InviteContractor, "company" | "name">): string | null => {
  const n = c.name?.trim();
  if (!n || !c.company?.trim()) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  if (norm(n) === norm(c.company)) return null;
  if (!/^[A-Za-z'-]+(\s[A-Za-z'.-]+){0,2}$/.test(n)) return null;
  const first = n.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};

export const invitePath = (token: string) => `/i/${token}`;
export const inviteSendPath = (token: string) => `/i/${token}/send`;

export const inviteUrl = (token: string, origin?: string): string => {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${invitePath(token)}`;
};

// A text the contractor can paste to a prospect. Plain, first-person, and
// says what the homeowner gets so it doesn't read like a form to fill.
export const inviteMessage = (opts: { contractor: string; url: string; firstName?: string }): string => {
  const hi = opts.firstName ? `Hi ${opts.firstName}, it's ${opts.contractor}.` : `Hi, it's ${opts.contractor}.`;
  return `${hi} Thanks for reaching out, I'd love to hear about your project. So I can come prepared, could you share a few details and pick a couple of times that work for a visit? It takes about five minutes and you keep a copy: ${opts.url}`;
};

// Link state for the contractor's list.
export type InviteListStatus = "sent" | "opened" | "received" | "expired" | "revoked";

export const inviteListStatus = (i: {
  revoked_at: string | null;
  completed_at: string | null;
  first_opened_at: string | null;
  expires_at: string;
}, now: Date = new Date()): InviteListStatus => {
  if (i.revoked_at) return "revoked";
  if (i.completed_at) return "received";
  if (new Date(i.expires_at).getTime() < now.getTime()) return "expired";
  if (i.first_opened_at) return "opened";
  return "sent";
};

export const INVITE_LIST_LABEL: Record<InviteListStatus, string> = {
  sent: "Not opened yet",
  opened: "Opened",
  received: "Brief received",
  expired: "Expired",
  revoked: "Turned off",
};

// ───── "Who invited me" across the brief flow ─────
// The homeowner may leave to confirm an email or sign in on the way, so this
// lives in localStorage (not sessionStorage) and expires after a week.
const ACTIVE_KEY = "haleo:active_invite";
const ACTIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ActiveInvite = {
  token: string;
  contractorId: string;
  contractorName: string;
  contractorSlug: string | null;
  logoUrl?: string | null;
  savedAt: number;
};

export const getActiveInvite = (now: number = Date.now()): ActiveInvite | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ActiveInvite>;
    if (!v.token || !v.contractorId || !v.contractorName || typeof v.savedAt !== "number") return null;
    if (now - v.savedAt > ACTIVE_TTL_MS) {
      localStorage.removeItem(ACTIVE_KEY);
      return null;
    }
    return { token: v.token, contractorId: v.contractorId, contractorName: v.contractorName, contractorSlug: v.contractorSlug ?? null, logoUrl: v.logoUrl ?? null, savedAt: v.savedAt };
  } catch {
    return null;
  }
};

export const setActiveInvite = (token: string, c: InviteContractor): void => {
  try {
    const v: ActiveInvite = { token, contractorId: c.id, contractorName: contractorDisplayName(c), contractorSlug: c.slug, logoUrl: c.logoUrl ?? null, savedAt: Date.now() };
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(v));
  } catch {
    /* private mode: the link in the address bar still works */
  }
};

/** The co-brand for headers while a homeowner is in a contractor's link. */
export const inviteCobrand = (i: Pick<ActiveInvite, "token" | "contractorName" | "logoUrl"> | null) =>
  i ? { name: i.contractorName, logoUrl: i.logoUrl ?? null, href: invitePath(i.token) } : null;

export const clearActiveInvite = (): void => {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
};

// ───── Server calls ─────
export async function fetchInvite(token: string): Promise<InvitePublic | null> {
  const { data, error } = await supabase.rpc("get_invite_public", { _token: token });
  if (error || !data || data.length === 0) return null;
  // Profile fields arrive from the 20261102 version of the function; older
  // deployments simply don't send them.
  const r = data[0] as typeof data[0] & {
    contractor_tagline?: string | null;
    contractor_logo_url?: string | null;
    contractor_years_in_business?: number | null;
    contractor_specialties?: string | null;
    contractor_gallery_urls?: unknown;
  };
  const gallery = Array.isArray(r.contractor_gallery_urls)
    ? (r.contractor_gallery_urls as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
    : [];
  return {
    status: r.status as InviteStatus,
    contractor: {
      id: r.contractor_id,
      slug: r.contractor_slug,
      name: r.contractor_name,
      company: r.contractor_company,
      city: r.contractor_city,
      tagline: r.contractor_tagline ?? null,
      logoUrl: r.contractor_logo_url && /^https?:\/\//.test(r.contractor_logo_url) ? r.contractor_logo_url : null,
      yearsInBusiness: r.contractor_years_in_business ?? null,
      specialties: r.contractor_specialties ?? null,
      gallery,
    },
  };
}

export async function markInviteOpened(token: string): Promise<void> {
  try {
    await supabase.rpc("mark_invite_opened", { _token: token });
  } catch {
    /* funnel ping only: never block the homeowner */
  }
}

export type InviteErrorCode =
  | "not_authenticated"
  | "invite_not_found"
  | "invite_revoked"
  | "invite_expired"
  | "invite_used"
  | "invalid_brief"
  | "brief_too_large"
  | "unknown";

const ERROR_CODES: InviteErrorCode[] = [
  "not_authenticated",
  "invite_not_found",
  "invite_revoked",
  "invite_expired",
  "invite_used",
  "invalid_brief",
  "brief_too_large",
];

export const parseInviteError = (message: string | undefined | null): InviteErrorCode =>
  ERROR_CODES.find((c) => (message ?? "").includes(c)) ?? "unknown";

export const INVITE_ERROR_COPY: Record<InviteErrorCode, string> = {
  not_authenticated: "Sign in first so we can keep your brief and tell you when they reply.",
  invite_not_found: "This link isn't valid. Ask the contractor to send it again.",
  invite_revoked: "The contractor turned this link off. Ask them for a new one.",
  invite_expired: "This link has expired. Ask the contractor to send a fresh one.",
  invite_used: "This link was already used for another brief. Ask the contractor for a new one.",
  invalid_brief: "Something is off with your brief. Go back and try sending it again.",
  brief_too_large: "Your brief has too many files attached to send. Remove a few photos and try again.",
  unknown: "We couldn't send your brief. Try again in a moment.",
};

export type SendInvitedBriefInput = {
  token: string;
  snapshot: BriefSnapshot;
  neighborhood: string;
  homeownerName?: string | null;
  sessionId: string;
  note?: string | null;
};

export type SendInvitedBriefResult =
  | { ok: true; sendId: string }
  | { ok: false; code: InviteErrorCode; message: string };

export async function sendInvitedBrief(input: SendInvitedBriefInput): Promise<SendInvitedBriefResult> {
  const { data, error } = await supabase.rpc("send_invited_brief", {
    _token: input.token,
    _brief_snapshot: input.snapshot as unknown as Json,
    _neighborhood: input.neighborhood,
    _homeowner_name: input.homeownerName ?? "",
    _session_id: input.sessionId,
    _personal_note: input.note ?? undefined,
  });
  if (error || !data) {
    const code = parseInviteError(error?.message);
    return { ok: false, code, message: INVITE_ERROR_COPY[code] };
  }
  return { ok: true, sendId: data };
}
