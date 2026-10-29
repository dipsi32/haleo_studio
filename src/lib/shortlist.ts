// Shortlist: turn "names from neighbors" into a short, checked list.
//
// The homeowner already has candidates (a Nextdoor thread, a WhatsApp group,
// texts, a name a friend gave them). This file holds the pure parts: cleaning
// and merging what was extracted, matching a name to public permit records,
// reading the license, ranking, and writing the bid request they send.
//
// Honesty rules, same as the rest of Haleo:
// - A name match to permit records is shown with the exact name we matched,
//   so the homeowner can tell us it's the wrong business.
// - "No license found" means we couldn't check, not that they're unlicensed.
// - What neighbors said is labelled as their words and never mixed into the
//   public-record score.
import type { Contractor, LicenseStatus, Permit, TrustScoreBreakdown, BriefSnapshot } from "@/lib/contractors";
import type { Room } from "@/lib/intake";

export type Sentiment = "positive" | "negative" | "mixed";
export type Quote = { text: string; sentiment: Sentiment };
export type CandidateSource = "pasted" | "screenshot" | "manual";

export type Candidate = {
  id: string;
  name: string;
  person: string | null;
  trade: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license_number: string | null;
  mention_count: number;
  quotes: Quote[];
  source: CandidateSource;
};

export type LicenseState = "active" | "expiring" | "expired" | "suspended" | "not_checked";

export type CheckedCandidate = {
  candidate: Candidate;
  status: "checking" | "done";
  /** Permit-record business we matched by name, if any. */
  contractor: Contractor | null;
  permits: Permit[];
  license: LicenseStatus | null;
  score: TrustScoreBreakdown | null;
  /** Permits whose description matches the homeowner's project. */
  likeYours: number;
};

// ───── Cleaning ─────

const SUFFIXES = /\b(inc|llc|l\.l\.c|corp|corporation|co|company|incorporated|ltd|the)\b/g;

export const normalizeName = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();

export const phoneDigits = (s?: string | null): string | null => {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? ten : null;
};

export const formatPhone = (s?: string | null): string | null => {
  const d = phoneDigits(s);
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s ?? null;
};

/** CSLB license numbers are digits only, typically 6 to 7 long. */
export const cleanLicense = (s?: string | null): string | null => {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d.length >= 4 && d.length <= 8 ? d : null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Turn whatever the extractor returned into clean candidates. Drops entries with no name. */
export const fromExtraction = (raw: unknown, source: CandidateSource): Candidate[] => {
  if (!Array.isArray(raw)) return [];
  const out: Candidate[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const name = str(r?.name);
    if (!name) continue;
    const quotes = Array.isArray(r.quotes)
      ? (r.quotes as Record<string, unknown>[])
          .map((q) => ({
            text: str(q?.text) ?? "",
            sentiment: (["positive", "negative", "mixed"].includes(q?.sentiment as string) ? q.sentiment : "mixed") as Sentiment,
          }))
          .filter((q) => q.text)
          .slice(0, 4)
      : [];
    out.push({
      id: newId(),
      name,
      person: str(r.person),
      trade: str(r.trade),
      phone: str(r.phone),
      email: str(r.email),
      website: str(r.website),
      license_number: cleanLicense(str(r.license_number)),
      mention_count: Math.max(1, Number(r.mention_count) || quotes.length || 1),
      quotes,
      source,
    });
  }
  return out;
};

export const manualCandidate = (input: { name: string; phone?: string; license_number?: string }): Candidate => ({
  id: newId(),
  name: input.name.trim(),
  person: null,
  trade: null,
  phone: str(input.phone),
  email: null,
  website: null,
  license_number: cleanLicense(input.license_number),
  // Typed in by the homeowner: not a neighbor's mention.
  mention_count: 0,
  quotes: [],
  source: "manual",
});

const sameContractor = (a: Candidate, b: Candidate): boolean => {
  if (a.license_number && a.license_number === b.license_number) return true;
  const pa = phoneDigits(a.phone), pb = phoneDigits(b.phone);
  if (pa && pa === pb) return true;
  const na = normalizeName(a.name), nb = normalizeName(b.name);
  return !!na && na === nb;
};

/** Merge the same contractor mentioned in two places (two screenshots, a screenshot and a text). */
export const mergeCandidates = (list: Candidate[]): Candidate[] => {
  const out: Candidate[] = [];
  for (const c of list) {
    const hit = out.find((o) => sameContractor(o, c));
    if (!hit) {
      out.push({ ...c, quotes: [...c.quotes] });
      continue;
    }
    hit.person ??= c.person;
    hit.trade ??= c.trade;
    hit.phone ??= c.phone;
    hit.email ??= c.email;
    hit.website ??= c.website;
    hit.license_number ??= c.license_number;
    hit.mention_count += c.mention_count;
    for (const q of c.quotes) {
      if (!hit.quotes.some((h) => h.text === q.text)) hit.quotes.push(q);
    }
    hit.quotes = hit.quotes.slice(0, 6);
  }
  return out;
};

// ───── Matching a name to permit records ─────

const tokens = (s: string) => normalizeName(s).split(" ").filter((t) => t.length > 1);

/**
 * Pick the permit-record business that is this candidate, or null.
 * Exact name beats containment beats strong word overlap. Ties go to the
 * business with more permits. Weak overlaps return null on purpose: a wrong
 * match would put someone else's record on this contractor.
 */
export const pickPermitMatch = (name: string, rows: Contractor[]): Contractor | null => {
  const q = normalizeName(name);
  const qt = tokens(name);
  if (!q || rows.length === 0) return null;
  let best: { row: Contractor; rank: number } | null = null;
  for (const row of rows) {
    let rank = 0;
    for (const cand of [row.company, row.name]) {
      if (!cand) continue;
      const n = normalizeName(cand);
      if (!n) continue;
      if (n === q) rank = Math.max(rank, 3);
      else if ((n.includes(q) || q.includes(n)) && Math.min(qt.length, tokens(cand).length) >= 2) rank = Math.max(rank, 2);
      else {
        const nt = tokens(cand);
        const shared = qt.filter((t) => nt.includes(t)).length;
        const overlap = shared / Math.max(qt.length, nt.length, 1);
        if (shared >= 2 && overlap >= 0.6) rank = Math.max(rank, 1);
      }
    }
    if (rank === 0) continue;
    if (!best || rank > best.rank || (rank === best.rank && row.permit_count > best.row.permit_count)) {
      best = { row, rank };
    }
  }
  return best?.row ?? null;
};

/** Words worth sending to a name search: drops trade filler so "Mike's Plumbing Inc" searches "mike plumbing". */
export const searchTerm = (name: string): string => normalizeName(name).split(" ").slice(0, 4).join(" ");

/** True for a real CSLB number, false for the synthetic keys permit imports use ("SJ-ACME-BUILDERS"). */
export const isRealLicense = (n?: string | null): boolean => !!cleanLicense(n) && !/^SJ-/i.test(n ?? "");

// ───── Reading the license ─────

export const licenseState = (license: LicenseStatus | null, now = new Date()): LicenseState => {
  if (!license || !license.scrape_succeeded) return "not_checked";
  const status = (license.status ?? "").toLowerCase();
  if (/suspend|revoked|inactive|cancel/.test(status)) return "suspended";
  if (license.expiration_date) {
    const exp = new Date(license.expiration_date);
    if (exp.getTime() < now.getTime()) return "expired";
  }
  // A status we can't read is "not checked", never "active".
  if (!/active|current|clear/.test(status)) return "not_checked";
  if (license.expiration_date) {
    const exp = new Date(license.expiration_date);
    if (exp.getTime() - now.getTime() < 90 * 24 * 3600 * 1000) return "expiring";
  }
  return "active";
};

export const neighborRead = (c: Candidate) => {
  const counts = { positive: 0, negative: 0, mixed: 0 };
  for (const q of c.quotes) counts[q.sentiment]++;
  return counts;
};

/** A reason to look twice before calling. Public record first, then what neighbors said. */
export const redFlag = (c: CheckedCandidate): string | null => {
  const state = licenseState(c.license);
  if (state === "suspended") return "CSLB shows this license as not active.";
  if (state === "expired") return "CSLB shows this license as expired.";
  if (c.license?.scrape_succeeded && c.license.has_disciplinary_action) return "CSLB has a disciplinary record. Read it before you call.";
  const n = neighborRead(c.candidate);
  if (n.negative > 0 && n.negative >= n.positive) return "Neighbors' comments lean negative. Read them first.";
  return null;
};

// ───── Ranking ─────

/**
 * Order the shortlist. Flags go last. Then a verified active license, then
 * past work like this project, then the public-record score, then how many
 * neighbors vouched for them.
 */
export const rankShortlist = (list: CheckedCandidate[]): CheckedCandidate[] =>
  [...list].sort((a, b) => {
    const fa = redFlag(a) ? 1 : 0, fb = redFlag(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const la = licenseState(a.license) === "active" || licenseState(a.license) === "expiring" ? 1 : 0;
    const lb = licenseState(b.license) === "active" || licenseState(b.license) === "expiring" ? 1 : 0;
    if (la !== lb) return lb - la;
    if (a.likeYours !== b.likeYours) return b.likeYours - a.likeYours;
    const sa = a.score?.total ?? 0, sb = b.score?.total ?? 0;
    if (sa !== sb) return sb - sa;
    return neighborRead(b.candidate).positive - neighborRead(a.candidate).positive;
  });

/** One line on why this contractor sits where it does. Facts only. */
export const fitLine = (c: CheckedCandidate, projectWord: string): string => {
  const flag = redFlag(c);
  if (flag) return flag;
  const parts: string[] = [];
  const state = licenseState(c.license);
  if (state === "active") parts.push("license active");
  else if (state === "expiring") parts.push("license active, renewing soon");
  if (c.likeYours > 0) parts.push(`${c.likeYours} ${projectWord} permit${c.likeYours === 1 ? "" : "s"} in San Jose`);
  else if (c.permits.length > 0) parts.push(`${c.permits.length} San Jose permit${c.permits.length === 1 ? "" : "s"}, none like yours`);
  const pos = neighborRead(c.candidate).positive;
  if (pos > 0) parts.push(`${pos} neighbor${pos === 1 ? "" : "s"} vouched`);
  if (parts.length === 0) return "Not much on public record yet. Ask for their license number.";
  const s = parts.join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ───── The bid request ─────

export type BidRequestInput = {
  contractorName: string;
  personName?: string | null;
  homeownerName?: string | null;
  projectLabel: string;
  snapshot?: BriefSnapshot | null;
};

/** The message the homeowner sends from their own phone or email. Explain the project once. */
export const bidRequestMessage = (i: BidRequestInput): string => {
  const hello = i.personName ? `Hi ${i.personName.split(" ")[0]},` : `Hi ${i.contractorName},`;
  const s = i.snapshot;
  const where = s?.neighborhood && s.neighborhood !== "your area" ? ` in ${s.neighborhood}` : "";
  const lines = [
    hello,
    "",
    `A neighbor recommended you. I'm planning a ${i.projectLabel}${where} and I'm collecting a few bids.`,
  ];
  if (s) {
    const facts: string[] = [];
    if (s.scope_label) facts.push(`Scope: ${s.scope_label}`);
    if (s.scope_summary) facts.push(s.scope_summary);
    if (s.budget) facts.push(`Budget: ${s.budget}`);
    if (s.timeline) facts.push(`Timing: ${s.timeline}`);
    const trades = s.trade_groups.flatMap((g) => g.lines).slice(0, 6);
    if (facts.length || trades.length) {
      lines.push("", "The project:");
      for (const f of facts) lines.push(`- ${f}`);
      for (const t of trades) lines.push(`- ${t}`);
    }
  }
  lines.push(
    "",
    "If it's a fit, could you send:",
    "- a written, itemized bid",
    "- your CSLB license number",
    "- when you could start and how long it would take",
    "",
    "Happy to set up a time for you to see the space.",
  );
  if (i.homeownerName) lines.push("", `Thanks,\n${i.homeownerName}`);
  else lines.push("", "Thanks!");
  return lines.join("\n");
};

export const smsHref = (phone: string, body: string): string | null => {
  const d = phoneDigits(phone);
  return d ? `sms:+1${d}?&body=${encodeURIComponent(body)}` : null;
};

export const mailtoHref = (email: string, subject: string, body: string): string =>
  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// ───── Project, for "work like yours" ─────


export type ShortlistProject = "kitchen" | "bathroom" | "addition" | "full-home" | "other";

/** Narrow keywords on purpose: "2 kitchen permits" must mean kitchen work, not any remodel. */
export const PROJECT_OPTIONS: { id: ShortlistProject; label: string; word: string; keywords: string[] }[] = [
  { id: "kitchen", label: "Kitchen", word: "kitchen", keywords: ["kitchen"] },
  { id: "bathroom", label: "Bathroom", word: "bathroom", keywords: ["bath"] },
  { id: "addition", label: "ADU or addition", word: "ADU or addition", keywords: ["addition", "adu", "accessory dwelling"] },
  { id: "full-home", label: "Whole home", word: "remodel", keywords: ["remodel", "alteration"] },
  { id: "other", label: "Something else", word: "similar", keywords: ["remodel", "repair"] },
];

export const projectFromRoom = (room?: Room): ShortlistProject | null => {
  if (room === "kitchen" || room === "bathroom" || room === "addition" || room === "full-home") return room;
  return room ? "other" : null;
};

export const projectOption = (id: ShortlistProject) => PROJECT_OPTIONS.find((p) => p.id === id) ?? PROJECT_OPTIONS[4];

// ───── Saved shortlist (so a detour to build a brief doesn't lose it) ─────

export const SHORTLIST_KEY = "haleo:shortlist";

export type SavedShortlist = {
  project: ShortlistProject;
  candidates: Candidate[];
  results: CheckedCandidate[];
  selected: string[];
  savedAt: string;
};

export const saveShortlist = (s: Omit<SavedShortlist, "savedAt">) => {
  try {
    // Keep it small: the most recent permits are enough to redraw the cards.
    const results = s.results.map((r) => ({ ...r, permits: r.permits.slice(0, 25) }));
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify({ ...s, results, savedAt: new Date().toISOString() }));
  } catch {
    // Storage full or blocked: the page still works, it just won't survive a reload.
  }
};

export const loadShortlist = (): SavedShortlist | null => {
  try {
    const raw = localStorage.getItem(SHORTLIST_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedShortlist;
    const ageDays = (Date.now() - new Date(s.savedAt).getTime()) / 86_400_000;
    return Array.isArray(s.results) && s.results.length > 0 && ageDays < 30 ? s : null;
  } catch {
    return null;
  }
};

export const clearShortlist = () => {
  try {
    localStorage.removeItem(SHORTLIST_KEY);
  } catch {
    /* ignore */
  }
};
