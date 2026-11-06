// Lead readiness: how ready is this homeowner to actually do the project?
//
// A remodeler's lead sheet, done for them. The classic one (Joe Cracco,
// JLC) asks the caller why now, what the budget is, whether there are plans
// and financing, who else decides, who else they're talking to, and how they
// heard about you. It takes about 45 minutes per lead, and the five hours of
// a first meeting follow. Haleo has those answers before the phone rings,
// plus what no phone call shows: how much effort they put into the brief.
//
// Rules this file keeps:
//  - No number out of 100. Cracco tried scoring leads and found people too
//    unpredictable for a score to help. So the read is a plain call ("Ready
//    to move", "Serious, a few things open", "Early days") with every reason
//    behind it, and the contractor's judgment wins.
//  - It reads the project's readiness, never the person's worth. Language
//    stays respectful: "comparing several contractors", not "price shopper".
//  - Unknown is not bad. A question they skipped is shown as unknown and
//    turned into the one question worth asking, never counted against them.
//  - Every signal says where it came from: their words, their numbers, or
//    what they did in the brief.
import { computeDealRead, type BuyBox, type DealSnapshot } from "@/lib/dealRead";
import { FOUND_VIA_OPTIONS, FUNDING_OPTIONS, SHOPPING_OPTIONS, WHO_DECIDES_OPTIONS, WHY_NOW_OPTIONS } from "@/lib/prepTypes";
import { cleanVisitTimes } from "@/lib/visitTimes";

export type SignalSource = "asked" | "math" | "did";

export const SIGNAL_SOURCE_LABEL: Record<SignalSource, string> = {
  asked: "Their words",
  math: "Their numbers",
  did: "What they did",
};

export type Signal = {
  text: string;
  source: SignalSource;
  /** Which way it moves the read. Neutral lines are context worth knowing. */
  effect: "up" | "down" | "neutral";
  /** A hedge or a tip for the visit. */
  note?: string;
  weight: number;
};

export type Strength = "strong" | "some" | "weak" | "unknown";

export type DimensionKey = "urgency" | "money" | "prep" | "commitment";

export type Dimension = { key: DimensionKey; label: string; strength: Strength; signals: Signal[] };

export type ReadinessLevel = "ready" | "serious" | "early" | "unclear";

export type LeadReadiness = {
  level: ReadinessLevel;
  title: string;
  summary: string;
  dimensions: Dimension[];
  /** The single question that would change this read the most. */
  ask: { question: string; why: string } | null;
};

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  urgency: "Why now",
  money: "Budget & funding",
  prep: "Plans & decisions",
  commitment: "Commitment",
};

export const READINESS_TITLE: Record<ReadinessLevel, string> = {
  ready: "Ready to move",
  serious: "Serious, a few things open",
  early: "Early days",
  unclear: "Not enough to tell yet",
};

const readOf = <T extends readonly { value: string; read: string }[]>(opts: T, v?: string) => opts.find((o) => o.value === v)?.read;

// Pain points that mean something is failing, not just dated. "The sliders
// all leak" is a project that has to happen.
const FAILING = /leak|fail|trip|unsafe|crack|rot\b|rot \/|damage|mold|sewer|insurance|safety|knob|end of life|broken|not working|sinking|uneven floors/i;

const strengthOf = (signals: Signal[]): Strength => {
  if (signals.length === 0) return "unknown";
  const total = signals.reduce((t, s) => t + (s.effect === "up" ? s.weight : s.effect === "down" ? -s.weight : 0), 0);
  if (total >= 3) return "strong";
  if (total <= -1) return "weak";
  return "some";
};

const answersIn = (snap: DealSnapshot): number =>
  (snap.haleo_read?.sections ?? []).find((s) => /homeowner's answers/i.test(s.title))?.items.length ?? 0;

export const computeLeadReadiness = (snap: DealSnapshot, buyBox?: BuyBox | null): LeadReadiness => {
  const ctx = snap.context ?? {};
  const deal = computeDealRead(snap, buyBox);
  const timeline = snap.timeline ?? "";

  // ── Why now: the reason it has to happen, and when ──
  const urgency: Signal[] = [];
  if (/ready to start/i.test(timeline)) urgency.push({ text: "Ready to start now", source: "asked", effect: "up", weight: 2 });
  else if (/1.?3 months/i.test(timeline)) urgency.push({ text: "Wants to start in 1–3 months", source: "asked", effect: "up", weight: 2 });
  else if (/3.?6 months/i.test(timeline)) urgency.push({ text: "Wants to start in 3–6 months", source: "asked", effect: "up", weight: 1 });
  else if (/exploring/i.test(timeline)) urgency.push({ text: "Still exploring, no start date", source: "asked", effect: "down", weight: 2 });

  const why = readOf(WHY_NOW_OPTIONS, ctx.why_now);
  if (why) {
    const lifeEvent = ctx.why_now === "repair" || ctx.why_now === "moving-in" || ctx.why_now === "family" || ctx.why_now === "selling";
    urgency.push({
      text: why,
      source: "asked",
      effect: lifeEvent ? "up" : ctx.why_now === "rental" ? "up" : "neutral",
      weight: lifeEvent ? 2 : 1,
      note: ctx.why_now === "selling" ? "Sellers move fast and watch cost. Lead with schedule." : undefined,
    });
  }
  if (ctx.hard_date?.trim()) urgency.push({ text: `Has a date: ${ctx.hard_date.trim()}`, source: "asked", effect: "up", weight: 2 });
  const failing = (snap.frustrations ?? []).filter((f) => FAILING.test(f));
  if (failing.length) urgency.push({ text: `Something is failing: ${failing.slice(0, 2).join(", ").toLowerCase()}`, source: "asked", effect: "up", weight: 2 });

  // ── Budget & funding: can the numbers work ──
  const money: Signal[] = [];
  if (deal.size.budgetLabel) money.push({ text: `Shared a budget: ${deal.size.budgetLabel}`, source: "asked", effect: "up", weight: 2 });
  if (deal.fit.level === "below") {
    const budgetReason = deal.fit.reasons.find((r) => /budget/i.test(r));
    if (budgetReason) money.push({ text: budgetReason, source: "math", effect: "down", weight: 3 });
  }
  const funding = readOf(FUNDING_OPTIONS, ctx.funding);
  if (funding) {
    const effect = ctx.funding === "unsure" ? "down" : "up";
    money.push({
      text: ctx.funding === "unsure" ? "Still working out how to pay" : `Paying with ${funding.toLowerCase()}`,
      source: "asked",
      effect,
      weight: ctx.funding === "cash" ? 2 : 1,
      note: ctx.funding === "heloc" || ctx.funding === "construction-loan" ? "A lender can set the start date. Ask where it stands." : undefined,
    });
  }

  // ── Plans & decisions: how far along, and who signs ──
  const prep: Signal[] = [];
  const plans = snap.floorplan_urls?.length ?? 0;
  if (plans > 0) prep.push({ text: `Has plans (${plans})`, source: "did", effect: "up", weight: 2 });
  if (snap.permit_status === "yes") prep.push({ text: "Permit in hand", source: "asked", effect: "up", weight: 2 });
  else if (snap.permit_status === "in-progress") prep.push({ text: "Permit in progress", source: "asked", effect: "up", weight: 1 });
  const who = readOf(WHO_DECIDES_OPTIONS, ctx.who_decides);
  if (ctx.who_decides === "me") prep.push({ text: "Decides alone", source: "asked", effect: "up", weight: 1 });
  else if (ctx.who_decides === "partner")
    prep.push({ text: who ?? "Decides with a partner", source: "asked", effect: "neutral", weight: 0, note: "Make sure both are at the first visit." });
  else if (ctx.who_decides === "others")
    prep.push({ text: who ?? "Several people weigh in", source: "asked", effect: "down", weight: 1, note: "Expect a longer decision. Ask who has the final say." });

  // ── Commitment: to the project, and to you ──
  const commitment: Signal[] = [];
  if (ctx.shopping === "only") commitment.push({ text: readOf(SHOPPING_OPTIONS, "only")!, source: "asked", effect: "up", weight: 2 });
  else if (ctx.shopping === "few") commitment.push({ text: readOf(SHOPPING_OPTIONS, "few")!, source: "asked", effect: "neutral", weight: 0 });
  else if (ctx.shopping === "many")
    commitment.push({ text: "Comparing several contractors", source: "asked", effect: "down", weight: 2, note: "Often a price-led decision. Worth a short call before a long visit." });
  if (ctx.found_via === "referral" || ctx.found_via === "past-client")
    commitment.push({ text: readOf(FOUND_VIA_OPTIONS, ctx.found_via)!, source: "asked", effect: "up", weight: 2 });
  else if (ctx.found_via === "saw-work") commitment.push({ text: readOf(FOUND_VIA_OPTIONS, ctx.found_via)!, source: "asked", effect: "up", weight: 1 });
  else if (ctx.found_via === "online") commitment.push({ text: readOf(FOUND_VIA_OPTIONS, ctx.found_via)!, source: "asked", effect: "neutral", weight: 0 });
  if (cleanVisitTimes(ctx.visit_times).length) commitment.push({ text: "Offered times for a visit", source: "did", effect: "up", weight: 2 });

  // Effort is the signal no phone call can give you.
  const photos = (snap.room_photo_urls?.length ?? 0) + (snap.rendering_urls?.length ?? 0);
  const answers = answersIn(snap);
  const effort: string[] = [];
  if (photos >= 3) effort.push(`${photos} photos`);
  if (answers > 0) effort.push(`answered ${answers} question${answers === 1 ? "" : "s"}`);
  if ((snap.vision ?? "").trim().length >= 120) effort.push("described it in detail");
  if (snap.homeowner_phone) effort.push("left a number");
  if (effort.length >= 2) commitment.push({ text: `Put real effort in: ${effort.join(", ")}`, source: "did", effect: "up", weight: effort.length >= 3 ? 2 : 1 });
  else if (photos === 0 && !(snap.vision ?? "").trim() && !(snap.scope_summary ?? "").trim())
    commitment.push({ text: "Shared very little so far", source: "did", effect: "down", weight: 1 });

  const dimensions: Dimension[] = (
    [
      ["urgency", urgency],
      ["money", money],
      ["prep", prep],
      ["commitment", commitment],
    ] as const
  ).map(([key, signals]) => ({ key, label: DIMENSION_LABEL[key], strength: strengthOf([...signals]), signals: [...signals].sort((a, b) => b.weight - a.weight) }));

  const by = (k: DimensionKey) => dimensions.find((d) => d.key === k)!.strength;
  const strong = dimensions.filter((d) => d.strength === "strong").length;
  const weak = dimensions.filter((d) => d.strength === "weak").length;
  const unknown = dimensions.filter((d) => d.strength === "unknown").length;
  const exploring = /exploring/i.test(timeline);
  // Ready means a budget has been shared and nothing in the numbers says no.
  const moneyClear = Boolean(deal.size.budgetLabel) && !money.some((m) => m.effect === "down");

  let level: ReadinessLevel;
  if (unknown >= 3) level = "unclear";
  else if (exploring || weak >= 2 || (by("urgency") !== "strong" && ctx.shopping === "many")) level = "early";
  else if (by("urgency") === "strong" && weak === 0 && moneyClear && strong >= 2) level = "ready";
  else level = "serious";

  const ask = nextQuestion(snap, level);

  const summary =
    level === "ready"
      ? "A reason to act now, the means to do it, and real effort in the brief."
      : level === "serious"
        ? "Real intent. Settle the open points on a short call or at the visit."
        : level === "early"
          ? "Still exploring. A short call first will tell you if it's worth the drive."
          : "They skipped most of the questions. One short call will tell you more than this can.";

  return { level, title: READINESS_TITLE[level], summary, dimensions, ask };
};

// The one question worth asking, softly worded, in the order that changes a
// decision most: money, timing, reason, competition, decision-makers.
const nextQuestion = (snap: DealSnapshot, level: ReadinessLevel): LeadReadiness["ask"] => {
  const ctx = snap.context ?? {};
  if (!snap.budget) return { question: "Have you set a range you'd like to stay within?", why: "The quickest way to know if the numbers can work." };
  if (!snap.timeline || /exploring/i.test(snap.timeline)) return { question: "When would you ideally like the work done?", why: "Tells you if it's a project or a someday." };
  if (!ctx.why_now && !(snap.frustrations ?? []).some((f) => FAILING.test(f)))
    return { question: "What's making now the right time for this?", why: "The reason behind it tells you how real it is, and what to lead with." };
  if (!ctx.shopping) return { question: "Are you talking with any other contractors?", why: "Most people answer honestly, and it tells you how hard to chase." };
  if (!ctx.who_decides) return { question: "Will anyone else be part of the decision?", why: "So everyone who signs is at the first meeting." };
  if (!ctx.funding && level !== "ready") return { question: "How are you thinking of paying for it?", why: "A lender can set the start date." };
  return null;
};

/** One line for a list: "Ready to move · Why now, Budget & funding". */
export const readinessLine = (r: LeadReadiness): string => {
  const strong = r.dimensions.filter((d) => d.strength === "strong").map((d) => d.label);
  return strong.length ? `${r.title} · strong on ${strong.join(", ").toLowerCase()}` : r.title;
};
