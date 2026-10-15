// Visit prep: know the job before you drive out.
//
// A contractor gets a big inquiry and has one question: is this worth my
// Saturday, and what do I say when I get there? This turns a brief plus the
// public record into a call on the first and a cheat sheet for the second.
//
// Rules this file keeps:
//  - Every line says where it came from: a public record, the homeowner's own
//    words, plain arithmetic on their numbers, or Haleo's inference. Inference
//    is always phrased as something to confirm, never as a fact.
//  - Nothing estimates a price, scores a person, or states a code rule. Where
//    a rule matters, the sheet says to check it with the city.
//  - Nothing the homeowner didn't share is invented. A gap is shown as a gap
//    and turned into a question worth asking.
import { computeDealRead, type BuyBox, type DealRead, type DealSnapshot } from "@/lib/dealRead";
import { FUNDING_OPTIONS, SHOPPING_OPTIONS, WHO_DECIDES_OPTIONS, WHY_NOW_OPTIONS } from "@/lib/prepTypes";

export type Source = "record" | "asked" | "math" | "inferred";

export const SOURCE_LABEL: Record<Source, string> = {
  record: "Public record",
  asked: "Their words",
  math: "Their numbers",
  inferred: "Our inference",
};

export type PrepItem = {
  text: string;
  source: Source;
  /** A hedge about what this might mean. Always something to confirm. */
  note?: string;
  tone?: "watch" | "info";
};

export type Surprise = PrepItem & {
  /** A line the contractor could say at the door, as a question not a verdict. */
  opener: string;
  weight: number;
};

export type CallLevel = "drive" | "call-first" | "skip" | "unset";

export type VisitPrep = {
  read: DealRead;
  call: { level: CallLevel; title: string; why: string[] };
  surprises: Surprise[];
  home: PrepItem[];
  work: PrepItem[];
  people: PrepItem[];
  confirm: string[];
  asks: { question: string; why: string }[];
  /** True when there is nothing from public records at all. */
  noRecords: boolean;
};

const CALL_TITLE: Record<CallLevel, string> = {
  drive: "Worth the drive",
  "call-first": "Worth a quick call first",
  skip: "Probably not your kind of job",
  unset: "Tell us what you take on and we'll make the call",
};

const n = (v: number) => v.toLocaleString("en-US");
const year = (d?: string | null) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : null);
const clip = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const readOf = <T extends readonly { value: string; read: string }[]>(opts: T, v?: string) => opts.find((o) => o.value === v)?.read;

const hazardIsHigh = (v?: string | null) => /high|very/i.test(v ?? "") && !/low|moderate/i.test(v ?? "");
const looksLikeConversion = (d?: string | null) => /garage|convert|conversion|adu|addition|second unit|accessory/i.test(d ?? "");

export const computeVisitPrep = (snap: DealSnapshot, buyBox?: BuyBox | null): VisitPrep => {
  const read = computeDealRead(snap, buyBox);
  const kind = read.kind;
  const parcel = snap.parcel;
  const ctx = snap.context ?? {};
  const risk = snap.address_risk;
  const hasLot = Boolean(parcel?.lot_size_sqft);
  const noRecords = !parcel && !risk;

  // ── the call ──
  const gaps: string[] = [];
  if (!read.size.budgetLabel) gaps.push("No budget shared yet, so a short call would settle whether the numbers work.");
  if (read.fit.level === "check") gaps.push(...read.fit.reasons.filter((r) => /can't be tested|below your/.test(r)));
  let level: CallLevel;
  let why: string[];
  if (read.fit.level === "below") {
    level = "skip";
    why = read.fit.reasons;
  } else if (read.fit.level === "unset") {
    level = "unset";
    why = [];
  } else if (gaps.length > 0) {
    level = "call-first";
    why = [...new Set(gaps)];
  } else {
    level = "drive";
    why = read.fit.reasons;
  }

  // ── what the homeowner may not know (the "how did you know that?" lines) ──
  const surprises: Surprise[] = [];
  if (parcel) {
    const expired = parcel.expired_without_final_count ?? 0;
    const open = parcel.open_permit_count ?? 0;
    if (expired > 0) {
      surprises.push({
        text: `${expired} permit${expired === 1 ? " on this address shows" : "s on this address show"} no final sign-off.`,
        source: "record",
        note: "Could be paperwork that never got closed out. Worth asking about before it becomes part of your scope.",
        tone: "watch",
        opener: "I noticed the city shows a permit on this address that never got a final. Do you know the story there?",
        weight: 10,
      });
    } else if (open > 0) {
      surprises.push({
        text: `${open} permit${open === 1 ? " is" : "s are"} still open on this address.`,
        source: "record",
        note: "Worth knowing who is carrying it and where it stands.",
        tone: "watch",
        opener: "I saw an open permit on the address. Is that work still underway?",
        weight: 9,
      });
    }
    const conv = (parcel.permits ?? []).find((p) => looksLikeConversion(p.description) && !p.is_expired_without_final);
    if (conv) {
      const y = year(conv.issued_date);
      surprises.push({
        text: `Past work on file${y ? ` (${y})` : ""}: ${clip(conv.description ?? "permit")}.`,
        source: "record",
        note: "Compare it with what is there now. A mismatch is something to confirm, not a conclusion.",
        tone: "info",
        opener: `I looked at the permit history and saw ${clip(conv.description ?? "earlier work", 50).toLowerCase()}. Can you walk me through what was done?`,
        weight: 6,
      });
    }
    if (parcel.lot_size_sqft && parcel.existing_footprints_sqft && parcel.lot_size_sqft > 0) {
      const pct = Math.round((parcel.existing_footprints_sqft / parcel.lot_size_sqft) * 100);
      if (pct >= 30 && pct <= 100) {
        surprises.push({
          text: `Existing buildings cover about ${pct}% of the ${n(parcel.lot_size_sqft)} sq ft lot.`,
          source: "record",
          note: "Lot coverage and setbacks decide how much can be added. Check the limits with the city before promising a footprint.",
          tone: pct >= 40 ? "watch" : "info",
          opener: `The house covers about ${pct}% of the lot, so I'd like to start by looking at where new space could realistically go.`,
          weight: pct >= 40 ? 7 : 4,
        });
      }
    }
  }
  if (risk?.fire_hazard_class && hazardIsHigh(risk.fire_hazard_class)) {
    surprises.push({
      text: `Fire hazard zone: ${risk.fire_hazard_class}.`,
      source: "record",
      note: "Often means ignition-resistant materials and extra review. Confirm what applies.",
      tone: "watch",
      opener: "You're in a high fire hazard zone, so I'd like to talk materials early. It shapes the budget.",
      weight: 8,
    });
  }
  if (risk?.in_special_flood_hazard_area) {
    surprises.push({
      text: `Special flood hazard area${risk.flood_zone ? ` (zone ${risk.flood_zone})` : ""}.`,
      source: "record",
      note: "Can bring elevation rules and a flood insurance conversation. Confirm with the city.",
      tone: "watch",
      opener: "The address sits in a mapped flood area, so let's make sure we plan around that from the start.",
      weight: 8,
    });
  }
  if (kind === "addition" && (snap.floorplan_urls?.length ?? 0) === 0) {
    surprises.push({
      text: "No plans have been shared for an addition.",
      source: "asked",
      note: "Ask whether an architect or designer is involved, and how far along they are.",
      tone: "info",
      opener: "Do you have drawings yet, or would you like help getting to that point?",
      weight: 5,
    });
  }
  surprises.sort((a, b) => b.weight - a.weight);
  const topSurprises = surprises.slice(0, 3);

  // ── the home and lot (public records) ──
  const home: PrepItem[] = [];
  if (parcel?.apn) home.push({ text: `Parcel number ${parcel.apn}`, source: "record" });
  if (parcel?.zoning) home.push({ text: `Zoned ${parcel.zoning}`, source: "record" });
  if (parcel?.lot_size_sqft) home.push({ text: `Lot size ${n(parcel.lot_size_sqft)} sq ft`, source: "record" });
  if (parcel?.primary_dwelling_sqft) home.push({ text: `Existing home about ${n(parcel.primary_dwelling_sqft)} sq ft`, source: "record" });
  if (parcel && (parcel.permit_count ?? 0) > 0) {
    const oldest = year(parcel.oldest_permit_date);
    home.push({
      text: `${parcel.permit_count} permit${parcel.permit_count === 1 ? "" : "s"} on file${oldest ? ` since ${oldest}` : ""}`,
      source: "record",
    });
  } else if (parcel) {
    home.push({ text: "No permits on file for this address", source: "record", note: "Doesn't mean no work was done. Older work often predates the online records." });
  }
  if (risk?.fire_hazard_class) home.push({ text: `Fire hazard: ${risk.fire_hazard_class}`, source: "record", tone: hazardIsHigh(risk.fire_hazard_class) ? "watch" : "info" });
  if (risk?.in_special_flood_hazard_area) home.push({ text: `Special flood hazard area${risk.flood_zone ? ` (zone ${risk.flood_zone})` : ""}`, source: "record", tone: "watch" });
  else if (risk?.flood_zone) home.push({ text: `Flood zone ${risk.flood_zone}`, source: "record" });
  if (risk?.seismic_hazard_type) home.push({ text: `Seismic: ${risk.seismic_hazard_type}`, source: "record" });

  // ── the work ──
  const work: PrepItem[] = [{ text: read.headline, source: "asked" }];
  if (read.size.perSqft) work.push({ text: `Budget works out to ${read.size.perSqft}`, source: "math", note: "Set it against your recent jobs. It's arithmetic, not an estimate." });
  if (parcel?.primary_dwelling_sqft && read.size.sqft && kind === "addition") {
    const pct = Math.round((read.size.sqft / parcel.primary_dwelling_sqft) * 100);
    work.push({ text: `The addition is about ${pct}% of the existing home's size`, source: "math" });
  }
  work.push({ text: `Permit path: ${read.permit.label.toLowerCase()}`, source: "asked" });
  const sharedBits = [
    (snap.room_photo_urls?.length ?? 0) > 0 ? `${snap.room_photo_urls!.length} photo${snap.room_photo_urls!.length === 1 ? "" : "s"}` : null,
    (snap.floorplan_urls?.length ?? 0) > 0 ? `${snap.floorplan_urls!.length} plan${snap.floorplan_urls!.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  work.push({ text: sharedBits.length ? `Shared: ${sharedBits.join(" and ")}` : "No photos or plans shared yet", source: "asked" });

  // ── the people (only they can say) ──
  const people: PrepItem[] = [];
  const why_now = readOf(WHY_NOW_OPTIONS, ctx.why_now);
  const who = readOf(WHO_DECIDES_OPTIONS, ctx.who_decides);
  const funding = readOf(FUNDING_OPTIONS, ctx.funding);
  const shopping = readOf(SHOPPING_OPTIONS, ctx.shopping);
  if (why_now) people.push({ text: `Why now: ${why_now.toLowerCase()}`, source: "asked" });
  if (who) people.push({ text: who, source: "asked" });
  if (funding) people.push({ text: `Paying with: ${funding.toLowerCase()}`, source: "asked", note: ctx.funding === "construction-loan" || ctx.funding === "heloc" ? "A lender can set the start date. Ask where that stands." : undefined });
  if (ctx.hard_date?.trim()) people.push({ text: `Date that matters: ${ctx.hard_date.trim()}`, source: "asked", tone: "watch" });
  if (shopping) people.push({ text: shopping, source: "asked" });
  if (ctx.past_note?.trim()) people.push({ text: `From past projects: ${ctx.past_note.trim()}`, source: "asked", tone: "info" });
  if (snap.read_feedback?.trim()) people.push({ text: `They flagged Haleo's read: "${clip(snap.read_feedback.trim(), 120)}"`, source: "asked", tone: "watch" });

  // ── what only a site visit can settle (said out loud, so it reads as craft) ──
  const confirm: string[] = [];
  if ((parcel?.open_permit_count ?? 0) + (parcel?.expired_without_final_count ?? 0) > 0) confirm.push("Where the open permit stands with the city");
  if (!hasLot && !noRecords) confirm.push("Lot size, setbacks and coverage, since no parcel record came through");
  if (noRecords) confirm.push("Zoning, setbacks and lot coverage, since no public record came through");
  confirm.push("Year built, and what is behind the walls (wiring, plumbing, anything that predates current code)");
  if (kind === "addition" || kind === "whole-home") {
    confirm.push("Electrical panel and service size");
    confirm.push("Foundation type and soil");
  }
  if (kind === "addition") confirm.push("Sewer lateral and gas and water meter sizes");
  if (kind === "kitchen" || kind === "bathroom") {
    confirm.push("Where plumbing and venting run, and whether any wall is load-bearing");
    confirm.push("Electrical panel capacity for the new loads");
  }
  if (kind === "other") confirm.push("What would have to move: structure, plumbing, electrical");

  // ── questions worth asking, ranked by how much they change your decision ──
  const asks: { question: string; why: string }[] = [];
  const push = (question: string, whyLine: string) => {
    if (!asks.some((a) => a.question === question)) asks.push({ question, why: whyLine });
  };
  for (const u of read.unknowns) {
    if (/budget/i.test(u)) push(u, "Settles whether the numbers work.");
    else if (/start/i.test(u)) push(u, "Tells you whether the schedule fits yours.");
    else if (/how large|roughly/i.test(u)) push(u, "Sizing is the first thing a price depends on.");
    else if (/permit/i.test(u)) push(u, "Decides who owns the paperwork and the timeline.");
  }
  if (!ctx.who_decides) push("Who else will be part of the decision?", "So the right people are at the table.");
  if (!ctx.why_now) push("What's prompting the project now?", "Tells you what to lead with.");
  if (!ctx.funding) push("How are you thinking of paying for it: savings, a home equity loan, or a construction loan?", "A lender can set the start date.");
  if (!ctx.hard_date?.trim()) push("Is there a date this needs to be done by?", "A fixed date changes how you schedule and price.");
  if (!ctx.shopping) push("Are you talking with other contractors too?", "Helps you decide how quickly to move.");
  for (const u of read.unknowns) if (!asks.some((a) => a.question === u)) push(u, "Open in the homeowner's own brief.");

  return { read, call: { level, title: CALL_TITLE[level], why }, surprises: topSurprises, home, work, people, confirm: confirm.slice(0, 6), asks: asks.slice(0, 5), noRecords };
};

// ───── A plain-text cheat sheet for the phone's notes app or a text to yourself ─────
export const prepToText = (prep: VisitPrep, who: { homeowner?: string; address?: string } = {}): string => {
  const lines: string[] = [];
  lines.push(`Visit prep${who.homeowner ? `: ${who.homeowner}` : ""}${who.address ? `, ${who.address}` : ""}`);
  lines.push(prep.read.headline);
  lines.push(`${prep.call.title}${prep.call.why.length ? `. ${prep.call.why[0]}` : ""}`);
  const block = (title: string, items: PrepItem[]) => {
    if (items.length === 0) return;
    lines.push("", title);
    for (const i of items) lines.push(`- ${i.text} [${SOURCE_LABEL[i.source]}]${i.note ? `. ${i.note}` : ""}`);
  };
  if (prep.surprises.length) {
    lines.push("", "Worth knowing before you knock");
    for (const s of prep.surprises) lines.push(`- ${s.text} [${SOURCE_LABEL[s.source]}]. Say: "${s.opener}"`);
  }
  block("Home and lot", prep.home);
  block("The work", prep.work);
  block("The people", prep.people);
  if (prep.confirm.length) {
    lines.push("", "Confirm on site");
    for (const c of prep.confirm) lines.push(`- ${c}`);
  }
  if (prep.asks.length) {
    lines.push("", "Good questions to ask");
    for (const a of prep.asks) lines.push(`- ${a.question}`);
  }
  lines.push("", "Prepared by Haleo from public records and the homeowner's brief. Confirm anything that matters on site.");
  return lines.join("\n");
};
