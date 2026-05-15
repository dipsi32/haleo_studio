// Pure logic for comparing 2-3 analyzed proposals.
//
// IMPORTANT — RISK SCORE DIRECTION:
// The stored `proposal_analyses.risk_score` is 0-100 where LOWER = SAFER
// (the existing ProposalsReceivedSection already renders it that way:
// ≤25 sage, ≥56 danger). The multi-bid comparison spec, however, talks about
// a "Haleo score" where HIGHER = BETTER ("85-100 sage = Clean"). To honor the
// spec without breaking the existing single-proposal view, we expose a derived
// homeowner-facing score: haleoScore = 100 - risk_score. All "higher is better"
// math in this file uses that derived value.
//
// The five weighted dimensions:
//  1. Risk score        (30%)  — derived haleoScore (0-100, higher better)
//  2. Permit completion (25%)  — permit_data.stats.finaled_percentage
//  3. Red-flag severity (20%)  — penalize critical flags heavily
//  4. Payment terms     (15%)  — deposit ≤10% & ≥3 milestones is ideal
//  5. Scope completeness(10%)  — covered trades vs requested trades
//
// All inputs come from rows already in `proposal_analyses` + the matching
// `outreach_sends` row + the homeowner's `outreach_batches.brief_snapshot`.
// No invented fields.

// Where this proposal came into Haleo. "uploaded" = homeowner uploaded a PDF
// themselves; "haleo" = a contractor submitted via an outreach batch. Used for
// honest disclosure ("uploaded bids have less data than Haleo-submitted ones").
export type ProposalSourceKind = "uploaded" | "haleo";

export type AnalyzedProposal = {
  send_id: string;
  contractor_id: string | null;
  contractor_name: string;
  proposal_analysis_id: string;
  status: string; // outreach_sends.status (e.g. 'proposal_submitted', 'negotiating')
  proposal_source: string | null;
  proposal_structured: any | null;
  source_kind?: ProposalSourceKind;
  // From proposal_analyses
  analysis_status: string | null;
  risk_score: number | null;          // 0-100, LOWER is safer (raw)
  red_flags: any[];
  extracted_data: any;
  permit_data: any;
  license_data: any;
  next_actions: any[];
  analysis_jsonb: any;
  total_cost: number | null;
};

export type DimensionScore = {
  key: "risk" | "permits" | "flags" | "payment" | "scope";
  label: string;
  weight: number;          // 0..1
  score: number;           // 0..100, higher = better
  explanation: string;     // one short sentence
};

export type ScoredProposal = {
  proposal: AnalyzedProposal;
  haleoScore: number;                 // weighted total, 0-100, higher better
  dimensions: DimensionScore[];
  criticalFlagCount: number;
  warningFlagCount: number;
  missingTrades: string[];
  coveredTrades: string[];
  vagueTrades: string[];
  depositPct: number | null;
  milestoneCount: number;
  finaledPct: number | null;
  permitCount: number | null;
  recommendedAction:
    | "strongest"
    | "clean_with_minor"
    | "significant_concerns"
    | "do_not_sign";
  recommendedActionLabel: string;
};

export type Verdict =
  | {
      kind: "winner";
      winnerSendId: string;
      winnerName: string;
      headline: string;
      explanation: string;
    }
  | {
      kind: "tie";
      headline: string;
      explanation: string;
    }
  | {
      kind: "all_flagged";
      headline: string;
      explanation: string;
    };

// ─── Helpers ─────────────────────────────────────────────────────────

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const toNumber = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const m = v.replace(/[^0-9.]/g, "");
    if (!m) return null;
    const n = parseFloat(m);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// Parse "$213,350.00", "213350", "213,350.00", etc.
const parseCurrency = (v: any): number | null => toNumber(v);

// Parse "10%" / "10" / "$5,000 of $50,000" → percentage 0..100
const parseDepositPct = (depositRaw: any, total: number | null): number | null => {
  if (depositRaw == null) return null;
  const s = String(depositRaw).trim();
  if (!s || /not specified/i.test(s)) return null;
  const pctMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  const dollar = toNumber(s);
  if (dollar != null && total && total > 0) return (dollar / total) * 100;
  if (dollar != null && dollar <= 100) return dollar; // bare number ≤100 → assume %
  return null;
};

const parseMilestoneCount = (paymentSchedule: any): number => {
  if (!paymentSchedule) return 0;
  const s = String(paymentSchedule);
  if (!s.trim() || /not specified/i.test(s)) return 0;
  // Count distinct percentage tokens or distinct dollar amounts as milestones.
  const pcts = s.match(/\d+\s*%/g) ?? [];
  if (pcts.length > 0) return pcts.length;
  const dollars = s.match(/\$\s?\d/g) ?? [];
  return dollars.length;
};

// Pull the list of trades the homeowner asked about, from the brief snapshot.
// brief_snapshot shape varies — try several common locations and fall back to
// scanning the scope text for known trade keywords.
const KNOWN_TRADES = [
  "Demolition", "Cabinetry", "Countertops", "Electrical", "Plumbing",
  "Tile", "Flooring", "Drywall", "Paint", "Lighting", "Appliances",
  "HVAC", "Framing", "Insulation", "Windows", "Doors", "Fixtures",
  "Permits", "Finishes",
];

export function extractRequestedTrades(briefSnapshot: any): string[] {
  if (!briefSnapshot) return [];
  // Preferred: explicit trade breakdown
  const tb = briefSnapshot.trade_breakdown ?? briefSnapshot.tradeBreakdown ?? briefSnapshot.trades;
  if (Array.isArray(tb) && tb.length > 0) {
    return tb
      .map((t: any) => (typeof t === "string" ? t : t?.trade ?? t?.name ?? ""))
      .filter(Boolean);
  }
  // Fall back: scan scope/description for trade keywords
  const text = [
    briefSnapshot.scope, briefSnapshot.description, briefSnapshot.summary,
    briefSnapshot.title, briefSnapshot.room,
  ].filter(Boolean).join(" ").toLowerCase();
  if (!text) return [];
  return KNOWN_TRADES.filter((t) => text.includes(t.toLowerCase()));
}

// Classify how each requested trade is covered in this proposal.
// ✓ included & itemized   ~ mentioned vaguely   ✗ missing
export type TradeCoverage = "covered" | "vague" | "missing";

export function classifyTradeCoverage(
  trade: string,
  proposal: AnalyzedProposal,
): TradeCoverage {
  const tradeLower = trade.toLowerCase();

  // Builder-mode proposals have explicit line items — strongest signal.
  const items: any[] = proposal.proposal_structured?.line_items ?? [];
  if (Array.isArray(items) && items.length > 0) {
    const hit = items.find((i) =>
      String(i.trade ?? "").toLowerCase().includes(tradeLower) ||
      String(i.description ?? "").toLowerCase().includes(tradeLower),
    );
    if (hit) {
      const total = toNumber(hit.total) ?? toNumber(hit.unit_price) ?? 0;
      return total > 0 ? "covered" : "vague";
    }
    return "missing";
  }

  // PDF-mode: fall back to scanning the extracted scope text.
  const scope = String(proposal.extracted_data?.project_scope ?? "").toLowerCase();
  if (!scope) return "missing";
  if (scope.includes(tradeLower)) {
    // "vague" if mentioned but no surrounding numeric/quantitative context
    const idx = scope.indexOf(tradeLower);
    const window = scope.slice(Math.max(0, idx - 40), idx + 80);
    const hasDetail = /\$|\d+\s*(sq|lf|hr|each|ea\b)/i.test(window) || window.length > 60;
    return hasDetail ? "covered" : "vague";
  }
  return "missing";
}

// ─── Per-dimension scoring ───────────────────────────────────────────

function scoreRisk(p: AnalyzedProposal): DimensionScore {
  // Stored risk_score: lower=safer. Derived haleoScore: higher=better.
  const raw = typeof p.risk_score === "number" ? p.risk_score : 50;
  const haleo = clamp(100 - raw);
  return {
    key: "risk",
    label: "Risk score",
    weight: 0.30,
    score: haleo,
    explanation:
      haleo >= 85 ? "Clean — no critical issues found."
      : haleo >= 70 ? "Mostly clean — a few items worth reviewing."
      : haleo >= 55 ? "Significant concerns flagged."
      : "Multiple serious issues — do not sign as written.",
  };
}

function scorePermits(p: AnalyzedProposal): DimensionScore {
  const stats = p.permit_data?.stats ?? {};
  const pct = toNumber(stats.finaled_percentage);
  const total = toNumber(stats.total_permits) ?? 0;
  if (pct == null || total === 0) {
    return {
      key: "permits",
      label: "Permit track record",
      weight: 0.25,
      score: 50, // neutral — we have no data either way
      explanation: "No San Jose permits found under this contractor's name.",
    };
  }
  // Reward both completion rate AND volume (a 100% rate on 1 permit ≠ a 90% on 30).
  const volumeBonus = Math.min(15, total / 2);
  const score = clamp(pct + volumeBonus - 15);
  return {
    key: "permits",
    label: "Permit track record",
    weight: 0.25,
    score,
    explanation: `${total} permit${total === 1 ? "" : "s"} on file · ${pct}% finalized.`,
  };
}

function scoreFlags(p: AnalyzedProposal): { dim: DimensionScore; critical: number; warning: number } {
  const flags = Array.isArray(p.red_flags) ? p.red_flags : [];
  const critical = flags.filter((f: any) => f?.severity === "critical").length;
  const warning = flags.filter((f: any) => f?.severity === "warning").length;
  const notice = flags.filter((f: any) => f?.severity === "notice").length;
  // Each critical = -25, warning = -8, notice = -2 from a 100 base.
  const score = clamp(100 - critical * 25 - warning * 8 - notice * 2);
  const explanation =
    critical === 0 && warning === 0
      ? "No red flags raised."
      : `${critical} critical · ${warning} warning${notice ? ` · ${notice} notice` : ""}.`;
  return {
    dim: { key: "flags", label: "Red flags", weight: 0.20, score, explanation },
    critical,
    warning,
  };
}

function scorePayment(p: AnalyzedProposal): { dim: DimensionScore; depositPct: number | null; milestones: number } {
  const ex = p.extracted_data ?? {};
  const total = parseCurrency(ex.contract_value) ?? p.total_cost ?? null;
  const depositPct = parseDepositPct(ex.deposit_percentage, total);
  const milestones = parseMilestoneCount(ex.payment_schedule);

  // California cap: deposit ≤ 10% OR $1,000 (whichever is less).
  let depositScore = 70; // unknown → neutral-ish
  if (depositPct != null) {
    if (depositPct <= 10) depositScore = 100;
    else if (depositPct <= 20) depositScore = 60;
    else if (depositPct <= 35) depositScore = 30;
    else depositScore = 10;
  }

  let milestoneScore = 50;
  if (milestones >= 4) milestoneScore = 100;
  else if (milestones === 3) milestoneScore = 85;
  else if (milestones === 2) milestoneScore = 60;
  else if (milestones === 1) milestoneScore = 25;
  else milestoneScore = 20;

  const score = clamp(depositScore * 0.6 + milestoneScore * 0.4);
  const explanation =
    depositPct == null
      ? `Payment structure ${milestones ? `has ${milestones} milestone${milestones === 1 ? "" : "s"}` : "not clearly defined"}.`
      : `${Math.round(depositPct)}% deposit · ${milestones} milestone${milestones === 1 ? "" : "s"}.`;
  return {
    dim: { key: "payment", label: "Payment terms", weight: 0.15, score, explanation },
    depositPct,
    milestones,
  };
}

function scoreScope(
  p: AnalyzedProposal,
  requestedTrades: string[],
): { dim: DimensionScore; covered: string[]; vague: string[]; missing: string[] } {
  if (requestedTrades.length === 0) {
    // No trade list available — fall back to "did the proposal at least
    // specify materials and mention permits?"
    const ex = p.extracted_data ?? {};
    let s = 60;
    if (ex.materials_specified) s += 20;
    if (ex.permits_mentioned) s += 20;
    return {
      dim: {
        key: "scope", label: "Scope completeness", weight: 0.10, score: clamp(s),
        explanation: ex.materials_specified
          ? "Materials specified in the proposal."
          : "No itemized trade list to compare against.",
      },
      covered: [], vague: [], missing: [],
    };
  }
  const covered: string[] = [];
  const vague: string[] = [];
  const missing: string[] = [];
  for (const t of requestedTrades) {
    const c = classifyTradeCoverage(t, p);
    if (c === "covered") covered.push(t);
    else if (c === "vague") vague.push(t);
    else missing.push(t);
  }
  const total = requestedTrades.length;
  const score = clamp(((covered.length + vague.length * 0.5) / total) * 100);
  const explanation =
    missing.length === 0
      ? `All ${total} requested trades covered.`
      : `${missing.length} of ${total} requested trade${total === 1 ? "" : "s"} missing.`;
  return {
    dim: { key: "scope", label: "Scope completeness", weight: 0.10, score, explanation },
    covered, vague, missing,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export function scoreProposal(
  proposal: AnalyzedProposal,
  requestedTrades: string[],
): ScoredProposal {
  const risk = scoreRisk(proposal);
  const permits = scorePermits(proposal);
  const flagsResult = scoreFlags(proposal);
  const payment = scorePayment(proposal);
  const scope = scoreScope(proposal, requestedTrades);

  const dimensions = [risk, permits, flagsResult.dim, payment.dim, scope.dim];
  const haleoScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  let recommendedAction: ScoredProposal["recommendedAction"];
  let recommendedActionLabel: string;
  if (flagsResult.critical >= 2 || haleoScore < 50) {
    recommendedAction = "do_not_sign";
    recommendedActionLabel = "Do not sign as written";
  } else if (flagsResult.critical === 1 || haleoScore < 65) {
    recommendedAction = "significant_concerns";
    recommendedActionLabel = "Significant concerns — negotiate before signing";
  } else if (scope.missing.length > 0 || flagsResult.warning > 0 || haleoScore < 80) {
    recommendedAction = "clean_with_minor";
    recommendedActionLabel = scope.missing.length
      ? `Clean but missing ${scope.missing.length} item${scope.missing.length === 1 ? "" : "s"} — push back first`
      : "Clean overall — push back on the warnings first";
  } else {
    recommendedAction = "strongest";
    recommendedActionLabel = "Strongest overall — consider accepting";
  }

  return {
    proposal,
    haleoScore,
    dimensions,
    criticalFlagCount: flagsResult.critical,
    warningFlagCount: flagsResult.warning,
    missingTrades: scope.missing,
    coveredTrades: scope.covered,
    vagueTrades: scope.vague,
    depositPct: payment.depositPct,
    milestoneCount: payment.milestones,
    finaledPct: toNumber(proposal.permit_data?.stats?.finaled_percentage),
    permitCount: toNumber(proposal.permit_data?.stats?.total_permits),
    recommendedAction,
    recommendedActionLabel,
  };
}

export function computeVerdict(scored: ScoredProposal[]): Verdict {
  if (scored.length === 0) {
    return { kind: "tie", headline: "No proposals to compare yet.", explanation: "" };
  }
  const sorted = [...scored].sort((a, b) => b.haleoScore - a.haleoScore);
  const top = sorted[0];
  const second = sorted[1];

  const allHaveCritical = scored.every((s) => s.criticalFlagCount > 0);
  if (allHaveCritical) {
    return {
      kind: "all_flagged",
      headline: "All proposals have things worth pushing back on before signing.",
      explanation:
        "Each one has at least one critical issue. Use the negotiation tools below to address them — don't make a final decision yet.",
    };
  }

  // Tie if top two are within 4 points AND neither has a clear edge on critical flags.
  if (
    second &&
    Math.abs(top.haleoScore - second.haleoScore) <= 4 &&
    top.criticalFlagCount === second.criticalFlagCount
  ) {
    const diffParts: string[] = [];
    if (top.proposal.total_cost && second.proposal.total_cost) {
      const diff = Math.abs(top.proposal.total_cost - second.proposal.total_cost);
      if (diff > 1000) {
        const cheaper = top.proposal.total_cost < second.proposal.total_cost ? top : second;
        diffParts.push(`${cheaper.proposal.contractor_name} is $${Math.round(diff).toLocaleString()} less`);
      }
    }
    if (top.missingTrades.length !== second.missingTrades.length) {
      const fewer = top.missingTrades.length < second.missingTrades.length ? top : second;
      diffParts.push(`${fewer.proposal.contractor_name} covers more trades`);
    }
    if ((top.finaledPct ?? 0) !== (second.finaledPct ?? 0)) {
      const better = (top.finaledPct ?? 0) > (second.finaledPct ?? 0) ? top : second;
      diffParts.push(`${better.proposal.contractor_name} has the stronger permit history`);
    }
    return {
      kind: "tie",
      headline: `${top.proposal.contractor_name} and ${second.proposal.contractor_name} are closely matched — here's what sets them apart.`,
      explanation: diffParts.length
        ? diffParts.join(". ") + "."
        : "Both score similarly across risk, permits, and scope. The decision comes down to fit and rapport.",
    };
  }

  // Clear winner — explain why in plain language using the top scoring dimensions.
  const reasons: string[] = [];
  if (top.finaledPct != null && top.finaledPct >= 80) {
    reasons.push(`the highest permit completion rate in your area (${Math.round(top.finaledPct)}%)`);
  }
  if (top.depositPct != null && top.depositPct <= 10) {
    reasons.push("the cleanest payment terms");
  }
  if (top.criticalFlagCount === 0) {
    reasons.push("no critical red flags");
  }
  if (top.missingTrades.length === 0 && top.coveredTrades.length > 0) {
    reasons.push("the most complete scope");
  }

  let explanation: string;
  if (reasons.length >= 2) {
    explanation = `They have ${reasons.slice(0, 3).join(", ")}.`;
  } else if (reasons.length === 1) {
    explanation = `They have ${reasons[0]} — and the strongest weighted score across risk, permits, and completeness.`;
  } else {
    explanation = `Across risk, permits, payment terms, and scope completeness, they score ${top.haleoScore} — the highest of the ${scored.length} proposals received.`;
  }

  return {
    kind: "winner",
    winnerSendId: top.proposal.send_id,
    winnerName: top.proposal.contractor_name,
    headline: `Based on permit history, risk score, and proposal completeness — ${top.proposal.contractor_name}'s proposal is the strongest overall.`,
    explanation,
  };
}

// Build a pre-drafted pushback message for a single proposal, combining
// the analysis's whatToDo language with any missing-scope items.
export function draftPushback(scored: ScoredProposal): string {
  const lines: string[] = [];
  const flags = Array.isArray(scored.proposal.red_flags) ? scored.proposal.red_flags : [];
  const critical = flags.filter((f: any) => f?.severity === "critical");
  const warning = flags.filter((f: any) => f?.severity === "warning");

  lines.push(`Hi ${scored.proposal.contractor_name?.split(" ")[0] ?? "there"},`);
  lines.push("");
  lines.push("Thanks for sending your proposal. Before we move forward, I'd like to address a few things:");
  lines.push("");

  let n = 1;
  for (const f of critical.slice(0, 3)) {
    lines.push(`${n}. ${f.title ?? f.category ?? "Concern"} — ${f.whatToDo ?? f.detail ?? ""}`);
    n++;
  }
  for (const f of warning.slice(0, 2)) {
    lines.push(`${n}. ${f.title ?? f.category ?? "Question"} — ${f.whatToDo ?? f.detail ?? ""}`);
    n++;
  }
  if (scored.missingTrades.length > 0) {
    lines.push(
      `${n}. The proposal doesn't itemize ${scored.missingTrades.join(", ")}. Could you add line items for these so I can compare apples to apples?`,
    );
    n++;
  }

  // Pull questions from the analysis if available
  const questions: string[] =
    scored.proposal.analysis_jsonb?.questions_to_ask ??
    scored.proposal.analysis_jsonb?.questionsToAsk ??
    [];
  for (const q of questions.slice(0, 2)) {
    lines.push(`${n}. ${q}`);
    n++;
  }

  if (n === 1) {
    lines.push("Everything looks reasonable — I just want to confirm a few details before signing. Could we hop on a quick call this week?");
  }

  lines.push("");
  lines.push("Once these are sorted I'll be ready to make a decision. Thanks for the care here.");
  return lines.join("\n");
}

// ─── Standout chips ──────────────────────────────────────────────────
//
// Diff each proposal's per-dimension score against the SET MEDIAN. Emit a chip
// only when this proposal is meaningfully better (or worse) than the others on
// that dimension — i.e. the gap is ≥10 points. Each chip carries an evidence
// sentence pulled from fields already in the row, so claims map back to data
// the homeowner can verify in the drilldown. No invented numbers.

export type StandoutTone = "positive" | "negative";
export type StandoutChip = {
  key: DimensionScore["key"];
  label: string;
  tone: StandoutTone;
  delta: number;       // points above (or below) the set median
  evidence: string;    // one short, concrete sentence
};

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

function evidenceFor(
  key: DimensionScore["key"],
  s: ScoredProposal,
  tone: StandoutTone,
): string {
  switch (key) {
    case "permits": {
      if (s.permitCount != null && s.permitCount > 0 && s.finaledPct != null) {
        return tone === "positive"
          ? `${s.permitCount} permit${s.permitCount === 1 ? "" : "s"} on file · ${Math.round(s.finaledPct)}% finalized — strongest local track record in this set.`
          : `Only ${s.permitCount} permit${s.permitCount === 1 ? "" : "s"} on file · ${Math.round(s.finaledPct)}% finalized.`;
      }
      return tone === "positive"
        ? "Has a documented local permit history — others don't."
        : "No San Jose permits on file under this name.";
    }
    case "payment": {
      const dep = s.depositPct == null ? null : Math.round(s.depositPct);
      const ms = s.milestoneCount;
      if (dep != null) {
        return tone === "positive"
          ? `${dep}% deposit · ${ms} milestone${ms === 1 ? "" : "s"} — cleanest payment terms in this set.`
          : `${dep}% deposit · ${ms} milestone${ms === 1 ? "" : "s"} — heaviest up-front ask in this set.`;
      }
      return tone === "positive"
        ? `${ms} milestone${ms === 1 ? "" : "s"} structured — most defined payment plan here.`
        : "Payment structure isn't clearly defined.";
    }
    case "flags": {
      if (tone === "positive") {
        return s.criticalFlagCount === 0 && s.warningFlagCount === 0
          ? "No red flags raised — only proposal in this set with a clean read."
          : `Only ${s.criticalFlagCount} critical · ${s.warningFlagCount} warning — fewest flags here.`;
      }
      return `${s.criticalFlagCount} critical · ${s.warningFlagCount} warning flag${s.warningFlagCount === 1 ? "" : "s"} — most issues raised in this set.`;
    }
    case "scope": {
      if (tone === "positive") {
        return s.missingTrades.length === 0
          ? "Itemizes every requested trade — most complete scope here."
          : `Covers ${s.coveredTrades.length} of ${s.coveredTrades.length + s.vagueTrades.length + s.missingTrades.length} requested trades — most complete here.`;
      }
      return s.missingTrades.length > 0
        ? `Missing ${s.missingTrades.slice(0, 3).join(", ")}${s.missingTrades.length > 3 ? " and more" : ""} from the requested scope.`
        : "Scope is vaguer than the others in this set.";
    }
    case "risk": {
      return tone === "positive"
        ? `Lowest overall risk score in this set (${s.haleoScore}/100).`
        : `Highest overall risk in this set (${s.haleoScore}/100).`;
    }
  }
}

export function computeStandouts(
  scored: ScoredProposal[],
): Record<string, StandoutChip[]> {
  const out: Record<string, StandoutChip[]> = {};
  if (scored.length < 2) {
    for (const s of scored) out[s.proposal.send_id] = [];
    return out;
  }
  const dimKeys = scored[0].dimensions.map((d) => d.key);
  // Pre-compute the set median per dimension.
  const medians: Record<string, number> = {};
  for (const key of dimKeys) {
    medians[key] = median(
      scored.map((s) => s.dimensions.find((d) => d.key === key)?.score ?? 0),
    );
  }

  const THRESHOLD = 10; // points

  for (const s of scored) {
    const chips: StandoutChip[] = [];
    for (const dim of s.dimensions) {
      const delta = dim.score - medians[dim.key];
      if (Math.abs(delta) < THRESHOLD) continue;
      const tone: StandoutTone = delta > 0 ? "positive" : "negative";
      chips.push({
        key: dim.key,
        label: dim.label,
        tone,
        delta: Math.round(delta),
        evidence: evidenceFor(dim.key, s, tone),
      });
    }
    // Show the most meaningful 3 (largest absolute deltas), positive first.
    chips.sort((a, b) => {
      if (a.tone !== b.tone) return a.tone === "positive" ? -1 : 1;
      return Math.abs(b.delta) - Math.abs(a.delta);
    });
    out[s.proposal.send_id] = chips.slice(0, 3);
  }
  return out;
}
