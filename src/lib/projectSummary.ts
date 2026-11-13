// The project summary: one page a contractor can assess in a minute, in the
// order they think about a job. The homeowner sees exactly the same page
// before sending ("Here's what Matt gets"), so it has to be worth sending.
//
//   1. The job: what it is, in their words.
//   2. The numbers they price from: size, scope, finish, budget, timing.
//   3. What they want fixed.
//   4. The space today (Haleo's read of their photos).
//   5. The likely work, by trade.
//   6. What to settle on site.
//   7. Logistics: when they can meet, who decides, how they'll pay.
//
// Pure: built from the brief snapshot, nothing invented. A missing number
// reads "Not shared yet" (an open question), never a guess.
import type { DealSnapshot } from "@/lib/dealRead";
import { jobGlance } from "@/lib/jobGlance";
import { FOUND_VIA_OPTIONS, FUNDING_OPTIONS, WHO_DECIDES_OPTIONS, WHY_NOW_OPTIONS } from "@/lib/prepTypes";
import { cleanVisitTimes, formatVisitTime } from "@/lib/visitTimes";

export type Fact = { label: string; value: string; open?: boolean };

export type ProjectSummary = {
  title: string;
  goal: string | null;
  where: string | null;
  facts: Fact[];
  /** Haleo's size, trades and duration estimate from the photos, labelled as an estimate. */
  estimate: string | null;
  wants: string[];
  today: { headline: string | null; photos: string[]; answers: string[] };
  work: { trade: string | null; text: string }[];
  settle: string[];
  logistics: Fact[];
};

const SCOPE_LABEL: Record<string, string> = {
  refresh: "Refresh (same layout)",
  remodel: "Full remodel",
  reconfigure: "Change the layout",
  structural: "Add space",
};

const readOf = <T extends readonly { value: string; read: string }[]>(opts: T, v?: string) => opts.find((o) => o.value === v)?.read;

const sectionItems = (s: DealSnapshot, re: RegExp) =>
  (s.haleo_read?.sections ?? []).filter((x) => re.test(x.title)).flatMap((x) => x.items.map((i) => i.text.trim())).filter(Boolean);

export const projectSummary = (s: DealSnapshot): ProjectSummary => {
  const job = jobGlance(s);
  const ctx = s.context ?? {};
  const scopeKey = (s as { scope?: string }).scope;
  const scopeLabel = s.scope_label || (scopeKey ? SCOPE_LABEL[scopeKey] : undefined);

  const facts: Fact[] = [
    { label: "Size", value: s.room_size || (s.addition_size_sqft ? `${s.addition_size_sqft.toLocaleString("en-US")} sq ft` : "Not shared yet"), open: !s.room_size && !s.addition_size_sqft },
    ...(scopeLabel ? [{ label: "Scope", value: scopeLabel }] : []),
    ...(s.finish_level ? [{ label: "Finish", value: s.finish_level, open: /not sure/i.test(s.finish_level) }] : []),
    { label: "Budget", value: s.budget || "Not shared yet", open: !s.budget },
    { label: "Start", value: s.timeline || "Not shared yet", open: !s.timeline || /exploring/i.test(s.timeline) },
  ];

  // What they want fixed: their pain points, plus the reason it's happening now.
  const wants = [...(s.frustrations ?? [])].slice(0, 5);
  const why = readOf(WHY_NOW_OPTIONS, ctx.why_now);

  // The likely work: Haleo's scope of work, else the trade groups.
  const scopeItems = sectionItems(s, /^(scope of work|likely work)$/i);
  const work = (scopeItems.length ? scopeItems : (s.trade_groups ?? []).map((g) => `${g.trade}: ${g.lines[0] ?? ""}`.replace(/:\s*$/, "")))
    .slice(0, 5)
    .map((line) => {
      const i = line.indexOf(":");
      return i > 0 && i < 30 ? { trade: line.slice(0, i).trim(), text: line.slice(i + 1).trim() } : { trade: null, text: line };
    });

  // What only a visit can settle, and the risks: verify-on-site first.
  const settle = [...sectionItems(s, /^verify on site$/i), ...sectionItems(s, /^(risks|watch-outs)/i)].slice(0, 4);

  const logistics: Fact[] = [];
  const times = cleanVisitTimes(ctx.visit_times);
  if (times.length) logistics.push({ label: "Can meet", value: times.map(formatVisitTime).join("; ") });
  if (why) logistics.push({ label: "Why now", value: why });
  if (ctx.hard_date?.trim()) logistics.push({ label: "Needs it by", value: ctx.hard_date.trim() });
  const who = readOf(WHO_DECIDES_OPTIONS, ctx.who_decides);
  if (who) logistics.push({ label: "Decides", value: who });
  const funding = readOf(FUNDING_OPTIONS, ctx.funding);
  if (funding) logistics.push({ label: "Paying with", value: funding });
  const found = readOf(FOUND_VIA_OPTIONS, ctx.found_via);
  if (found) logistics.push({ label: "Found you", value: found });

  const city = s.neighborhood && s.neighborhood !== "your area" ? s.neighborhood : null;

  return {
    title: job.title,
    goal: job.goal,
    where: city,
    facts,
    estimate: job.size,
    wants,
    today: {
      headline: s.haleo_read?.summary?.trim() || null,
      photos: (s.room_photo_urls ?? []).slice(0, 4),
      // Their answers to the questions Haleo asked about the photos.
      answers: sectionItems(s, /^homeowner's answers$/i).slice(0, 4),
    },
    work,
    settle,
    logistics,
  };
};
