// Pure helpers shared by the visibility-scan edge function and the app's tests.
// No Deno or browser APIs in here, so both sides can import it.

export type Confidence = "strong" | "name" | "none";

export type Candidate = { name: string; phone?: string | null; website?: string | null };
export type Target = { names: string[]; phone?: string | null; website?: string | null };

const LEGAL_SUFFIX = new Set(["inc", "llc", "corp", "co", "company", "incorporated", "ltd", "the", "and"]);

export const normalizeName = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !LEGAL_SUFFIX.has(t));

export const phoneDigits = (p?: string | null): string => (p ?? "").replace(/\D/g, "").slice(-10);

export const hostOf = (u?: string | null): string => {
  if (!u) return "";
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const jaccard = (a: string[], b: string[]): number => {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  return inter / (A.size + B.size - inter);
};

/** Confidence that `c` is the same business as `target`. Phone or website is
 *  strong; a matching name is strong only if it is exactly the same words. A
 *  near-match on a name of two or more words is reported as "name" so the UI
 *  can ask the contractor to confirm. One-word names never match loosely. */
export function matchConfidence(target: Target, c: Candidate): Confidence {
  const tp = phoneDigits(target.phone);
  if (tp.length === 10 && tp === phoneDigits(c.phone)) return "strong";
  const th = hostOf(target.website);
  if (th && th === hostOf(c.website)) return "strong";

  const cn = normalizeName(c.name);
  let best: Confidence = "none";
  for (const n of target.names) {
    const tn = normalizeName(n);
    if (!tn.length || !cn.length) continue;
    if (tn.join(" ") === cn.join(" ")) return "strong";
    if (tn.length >= 2 && cn.length >= 2 && jaccard(tn, cn) >= 0.8) best = "name";
  }
  return best;
}

/** Index of the best match in an ordered list, or -1. Strong beats name-only. */
export function findMatch(target: Target, list: Candidate[]): { index: number; confidence: Confidence } {
  let nameIdx = -1;
  for (let i = 0; i < list.length; i++) {
    const c = matchConfidence(target, list[i]);
    if (c === "strong") return { index: i, confidence: "strong" };
    if (c === "name" && nameIdx < 0) nameIdx = i;
  }
  return nameIdx >= 0 ? { index: nameIdx, confidence: "name" } : { index: -1, confidence: "none" };
}

export type ScanQuery = { key: string; text: string };

/** The searches a homeowner planning a big project actually types. */
export function buildQueries(city: string, specialty?: string | null): ScanQuery[] {
  const s = (specialty ?? "").toLowerCase();
  const third: ScanQuery = /adu|accessory|granny|in-?law/.test(s)
    ? { key: "adu", text: `ADU builder in ${city}` }
    : /addition|second story|build.?out/.test(s)
      ? { key: "addition", text: `home addition contractor in ${city}` }
      : { key: "kitchen_bath", text: `kitchen and bath remodel contractor in ${city}` };
  return [
    { key: "gc", text: `general contractor in ${city}` },
    { key: "remodel", text: `home remodel in ${city}` },
    third,
  ];
}
