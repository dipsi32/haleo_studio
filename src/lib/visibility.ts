// How a contractor shows up when a homeowner searches. The scan itself runs in
// the visibility-scan edge function; this file types what it stores and turns
// it into the plain sentences shown on /pro/visibility. Every sentence is
// computed from the stored numbers, nothing is inferred beyond them.
import type { Confidence } from "../../supabase/functions/_shared/visibility";

export type { Confidence };

export type Listing = {
  name: string;
  rating: number | null;
  reviews: number | null;
  url: string | null;
};

export type SearchPerQuery = {
  key: string;
  text: string;
  /** 1-based position in the results we got back, or null if not found. */
  rank: number | null;
  /** How many results came back. A null rank means "not in these N". */
  total: number;
  confidence: Confidence;
  listing: Listing | null;
  top: Listing[];
};

export type SearchChannel =
  | { status: "ok"; perQuery: SearchPerQuery[] }
  | { status: "unavailable"; reason: string };

export type AiPerQuery = {
  key: string;
  text: string;
  runs: number;
  mentioned: number;
  named: { name: string; count: number }[];
};

export type AiModel = { id: string; label: string; perQuery: AiPerQuery[] };

export type AiChannel =
  | { status: "ok"; models: AiModel[] }
  | { status: "unavailable"; reason: string };

export type ScanResults = {
  city: string;
  queries: { key: string; text: string }[];
  google: SearchChannel;
  yelp: SearchChannel;
  ai: AiChannel;
};

export type ScanRow = { id: string; contractor_id: string; created_at: string; city: string | null; results: ScanResults };

/** "#4 of 20", or "Not in the top 20". */
export function rankLabel(q: Pick<SearchPerQuery, "rank" | "total">): string {
  if (q.rank == null) return q.total > 0 ? `Not in the top ${q.total}` : "No results";
  return `#${q.rank} of ${q.total}`;
}

export type ChannelSummary = {
  /** Searches where the business appeared at all. */
  found: number;
  searched: number;
  /** Best (lowest) rank across searches, or null. */
  best: number | null;
};

export function summarizeSearch(ch: SearchChannel): ChannelSummary | null {
  if (ch.status !== "ok") return null;
  const ranks = ch.perQuery.map((q) => q.rank).filter((r): r is number => r != null);
  return { found: ranks.length, searched: ch.perQuery.length, best: ranks.length ? Math.min(...ranks) : null };
}

export type AiSummary = { mentioned: number; runs: number; byModel: { label: string; mentioned: number; runs: number }[] };

export function summarizeAi(ch: AiChannel): AiSummary | null {
  if (ch.status !== "ok") return null;
  const byModel = ch.models.map((m) => ({
    label: m.label,
    mentioned: m.perQuery.reduce((n, q) => n + q.mentioned, 0),
    runs: m.perQuery.reduce((n, q) => n + q.runs, 0),
  }));
  return {
    mentioned: byModel.reduce((n, m) => n + m.mentioned, 0),
    runs: byModel.reduce((n, m) => n + m.runs, 0),
    byModel,
  };
}

/** The names that show up most across every channel, other than the business
 *  itself (already excluded upstream). Used for "who shows up instead". */
export function topRivals(results: ScanResults, limit = 5): { name: string; appearances: number }[] {
  const tally = new Map<string, { name: string; n: number }>();
  const add = (name: string, n: number) => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) return;
    const cur = tally.get(key);
    if (cur) cur.n += n;
    else tally.set(key, { name, n });
  };
  for (const ch of [results.google, results.yelp]) {
    if (ch.status !== "ok") continue;
    for (const q of ch.perQuery) q.top.slice(0, 5).forEach((l) => add(l.name, 1));
  }
  if (results.ai.status === "ok") {
    for (const m of results.ai.models) for (const q of m.perQuery) q.named.forEach((x) => add(x.name, x.count));
  }
  return [...tally.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((x) => ({ name: x.name, appearances: x.n }));
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Reviews on this channel versus the typical top-three listing, only when we
 *  have the contractor's own listing and at least three others to compare. */
export function reviewGap(ch: SearchChannel): { yours: number; typicalTop3: number } | null {
  if (ch.status !== "ok") return null;
  const mine = ch.perQuery.find((q) => q.listing?.reviews != null && q.confidence !== "none")?.listing?.reviews;
  if (mine == null) return null;
  const tops: number[] = [];
  for (const q of ch.perQuery) q.top.slice(0, 3).forEach((l) => l.reviews != null && tops.push(l.reviews));
  if (tops.length < 3) return null;
  const typical = median(tops);
  return typical == null ? null : { yours: mine, typicalTop3: Math.round(typical) };
}

/** Hours until the next scan is allowed (the function enforces this too). */
export const SCAN_COOLDOWN_HOURS = 12;
export function cooldownLeftHours(lastIso: string | null, now = Date.now()): number {
  if (!lastIso) return 0;
  const left = SCAN_COOLDOWN_HOURS - (now - new Date(lastIso).getTime()) / 3_600_000;
  return left > 0 ? Math.ceil(left) : 0;
}
