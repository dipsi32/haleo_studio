// What a contractor did with a brief, asked one tap at a time, only when it
// makes sense: the call first (pursue / ask first / pass), then whether it
// saved back-and-forth, then (for jobs they pursued) how the visit matched
// the brief, then how it ended. Each answer moves the launch scorecard.

export type Decision = "pursue" | "clarify" | "pass";
export type Effort = "saved_a_lot" | "saved_some" | "no_difference" | "more_work";
export type VisitMatch = "as_expected" | "small_surprise" | "big_mismatch" | "no_visit";
export type Result = "won" | "lost" | "open";

export type Outcome = {
  decision: Decision | null;
  decision_reasons: string[];
  effort: Effort | null;
  visit_match: VisitMatch | null;
  mismatch_note: string | null;
  result: Result | null;
  contract_value_k: number | null;
};

export const EMPTY_OUTCOME: Outcome = {
  decision: null,
  decision_reasons: [],
  effort: null,
  visit_match: null,
  mismatch_note: null,
  result: null,
  contract_value_k: null,
};

export const DECISIONS: { value: Decision; label: string; hint: string }[] = [
  { value: "pursue", label: "Pursue it", hint: "Set up a visit" },
  { value: "clarify", label: "Ask first", hint: "Something to clear up" },
  { value: "pass", label: "Pass", hint: "Not a fit" },
];

/** Why they paused or passed: the mismatches Haleo surfaced early. */
export const REASONS = ["Budget", "Timing", "Scope", "Location", "Not my kind of job", "Other"] as const;

export const EFFORTS: { value: Effort; label: string }[] = [
  { value: "saved_a_lot", label: "A lot" },
  { value: "saved_some", label: "Some" },
  { value: "no_difference", label: "No difference" },
  { value: "more_work", label: "More work" },
];

export const VISIT_MATCHES: { value: VisitMatch; label: string }[] = [
  { value: "as_expected", label: "As expected" },
  { value: "small_surprise", label: "Small surprises" },
  { value: "big_mismatch", label: "Big mismatch" },
  { value: "no_visit", label: "No visit" },
];

export const RESULTS: { value: Result; label: string }[] = [
  { value: "won", label: "Won it" },
  { value: "lost", label: "Lost it" },
  { value: "open", label: "Still open" },
];

export type Step = "decision" | "effort" | "visit" | "result" | "done";

/** The next question worth asking, or "done". */
export const nextStep = (o: Outcome): Step => {
  if (!o.decision) return "decision";
  if (!o.effort) return "effort";
  if (o.decision === "pass") return "done";
  if (!o.visit_match) return "visit";
  if (o.visit_match === "no_visit") return "done";
  if (!o.result || o.result === "open") return "result";
  return "done";
};

/** One line that sums up what they've told us, for the collapsed view. */
export const outcomeSummary = (o: Outcome): string | null => {
  if (!o.decision) return null;
  const parts = [DECISIONS.find((d) => d.value === o.decision)!.label];
  if (o.decision_reasons.length) parts[0] += ` (${o.decision_reasons.join(", ").toLowerCase()})`;
  if (o.visit_match && o.visit_match !== "no_visit") parts.push(`visit: ${VISIT_MATCHES.find((v) => v.value === o.visit_match)!.label.toLowerCase()}`);
  if (o.result) parts.push(RESULTS.find((r) => r.value === o.result)!.label.toLowerCase());
  return parts.join(" · ");
};

/** "62", "$62K", "62,000" → thousands, or null. */
export const parseValueK = (raw: string): number | null => {
  const s = raw.replace(/[$,\s]/g, "").toLowerCase();
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const k = m[2] === "m" ? n * 1000 : m[2] === "k" ? n : n >= 1000 ? n / 1000 : n;
  return k > 0 && k < 100000 ? Math.round(k * 10) / 10 : null;
};

/** Stored row → typed outcome, tolerant of anything a past version wrote. */
export const toOutcome = (row: Partial<Record<keyof Outcome, unknown>> | null | undefined): Outcome => {
  if (!row) return EMPTY_OUTCOME;
  const pick = <T extends string>(v: unknown, opts: { value: T }[]): T | null => (opts.some((o) => o.value === v) ? (v as T) : null);
  return {
    decision: pick(row.decision, DECISIONS),
    decision_reasons: Array.isArray(row.decision_reasons) ? row.decision_reasons.filter((r): r is string => typeof r === "string") : [],
    effort: pick(row.effort, EFFORTS),
    visit_match: pick(row.visit_match, VISIT_MATCHES),
    mismatch_note: typeof row.mismatch_note === "string" ? row.mismatch_note : null,
    result: pick(row.result, RESULTS),
    contract_value_k: typeof row.contract_value_k === "number" ? row.contract_value_k : null,
  };
};
