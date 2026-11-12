// The launch scorecard: seven questions, answered per pilot contractor from
// what they and their homeowners actually did (admin_pilot_scorecard()).
//
// Honest by construction: below a minimum sample the answer is "Too early",
// never a percentage of two. Each answer says what it was measured against,
// and a gap in the data reads as a gap ("Not reported"), never as good news.

export type PilotRow = {
  contractor_id: string;
  name: string;
  slug: string;
  claimed: boolean;
  status: "invited" | "active" | "paused" | "ended";
  started_at: string;
  baseline: Baseline;
  price_offered_monthly: number | null;
  paying_since: string | null;
  inquiries_reported: number;
  links_reported: number;
  weeks_reported: number;
  front_door_views: number;
  links_made: number;
  links_opened: number;
  intakes_started: number;
  briefs_sent: number;
  median_minutes_to_send: number | null;
  homeowner_ease: { easy: number; okay: number; hard: number } | null;
  outcomes: Outcomes | null;
  active_weeks: number;
  last_activity: string | null;
  would_pay: { answer?: "yes" | "maybe" | "no"; price?: number } | null;
};

/** Their normal intake before Haleo, per month, asked at kickoff. */
export type Baseline = {
  inquiries?: number;
  visits?: number;
  jobs_won?: number;
  minutes_per_lead?: number;
  late_mismatches_per_10_visits?: number;
};

export type Outcomes = {
  decided: number;
  pursue: number;
  clarify: number;
  pass: number;
  median_hours_to_decision: number | null;
  effort_answers: number;
  saved_a_lot: number;
  saved_some: number;
  no_difference: number;
  more_work: number;
  visits: number;
  as_expected: number;
  small_surprise: number;
  big_mismatch: number;
  won: number;
  lost: number;
  open: number;
  won_value_k: number;
};

export type Verdict = "good" | "watch" | "concern" | "early";

export type Answer = {
  n: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  question: string;
  verdict: Verdict;
  /** One line, the answer. */
  headline: string;
  /** The numbers behind it. */
  details: string[];
};

export const QUESTIONS: Record<Answer["n"], string> = {
  1: "Did we capture all eligible inquiries?",
  2: "Did homeowners participate without excessive friction?",
  3: "Did contractors use the information to take a specific next step?",
  4: "Did Haleo improve that outcome relative to normal intake?",
  5: "Did it reduce effort or prevent identifiable late mismatches?",
  6: "Did worthwhile business and homeowner experience remain healthy?",
  7: "Did contractors voluntarily use it again and pay?",
};

/** Fewer than this many data points and we say "Too early". */
export const MIN_SAMPLE = 5;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const ratio = (num: number, den: number) => (den > 0 ? num / den : null);
const n0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const grade = (v: number, good: number, watch: number): Verdict => (v >= good ? "good" : v >= watch ? "watch" : "concern");

const EMPTY_OUTCOMES: Outcomes = {
  decided: 0, pursue: 0, clarify: 0, pass: 0, median_hours_to_decision: null,
  effort_answers: 0, saved_a_lot: 0, saved_some: 0, no_difference: 0, more_work: 0,
  visits: 0, as_expected: 0, small_surprise: 0, big_mismatch: 0, won: 0, lost: 0, open: 0, won_value_k: 0,
};

export const scorecard = (r: PilotRow): Answer[] => {
  const o = { ...EMPTY_OUTCOMES, ...(r.outcomes ?? {}) };
  const ease = r.homeowner_ease ?? { easy: 0, okay: 0, hard: 0 };
  const easeN = ease.easy + ease.okay + ease.hard;
  const b = r.baseline ?? {};
  const out: Answer[] = [];

  // 1. Capture: of every inquiry they told us about, how many got the link.
  {
    const inq = n0(r.inquiries_reported);
    const linked = n0(r.links_reported);
    out.push(
      r.weeks_reported === 0 || inq === 0
        ? { n: 1, question: QUESTIONS[1], verdict: "early", headline: "Not reported yet", details: ["Ask them to fill in the weekly inquiry count in their inbox."] }
        : {
            n: 1,
            question: QUESTIONS[1],
            verdict: inq < MIN_SAMPLE ? "early" : grade(linked / inq, 0.8, 0.5),
            headline: `${pct(linked, inq)}% of inquiries got the link`,
            details: [`${linked} of ${inq} inquiries over ${r.weeks_reported} week${r.weeks_reported === 1 ? "" : "s"} (their count)`, `${r.briefs_sent} brief${r.briefs_sent === 1 ? "" : "s"} came back`],
          },
    );
  }

  // 2. Participation: of homeowners who started, how many sent; and how it felt.
  {
    const reached = Math.max(n0(r.intakes_started), n0(r.links_opened));
    const sent = n0(r.briefs_sent);
    const hardShare = easeN ? ease.hard / easeN : 0;
    const details = [
      `${r.front_door_views} link view${r.front_door_views === 1 ? "" : "s"} · ${reached} started · ${sent} sent`,
      r.median_minutes_to_send != null ? `Median ${Math.round(r.median_minutes_to_send)} min from start to send` : "No completed briefs yet",
      easeN ? `Homeowners said: ${ease.easy} easy, ${ease.okay} okay, ${ease.hard} hard` : "No homeowner ratings yet",
    ];
    out.push(
      reached < MIN_SAMPLE
        ? { n: 2, question: QUESTIONS[2], verdict: "early", headline: reached ? `${sent} of ${reached} sent so far` : "No homeowners yet", details }
        : {
            n: 2,
            question: QUESTIONS[2],
            verdict: hardShare > 0.25 ? "concern" : grade(sent / reached, 0.6, 0.35),
            headline: `${pct(sent, reached)}% of homeowners who started sent a brief`,
            details,
          },
    );
  }

  // 3. Next step: did the contractor make a call on each brief.
  {
    const sent = n0(r.briefs_sent);
    const details = [
      `Pursue ${o.pursue} · Ask first ${o.clarify} · Pass ${o.pass}`,
      o.median_hours_to_decision != null ? `Median ${o.median_hours_to_decision < 1 ? "under an hour" : `${Math.round(o.median_hours_to_decision)} h`} from brief to decision` : "No decisions yet",
    ];
    out.push(
      sent < MIN_SAMPLE
        ? { n: 3, question: QUESTIONS[3], verdict: "early", headline: sent ? `${o.decided} of ${sent} briefs have a decision` : "No briefs yet", details }
        : { n: 3, question: QUESTIONS[3], verdict: grade(o.decided / sent, 0.8, 0.5), headline: `${pct(o.decided, sent)}% of briefs led to a clear next step`, details },
    );
  }

  // 4. Better than normal intake: visits per inquiry, and wins per visit, against their baseline.
  {
    const baseVisitRate = ratio(n0(b.visits), n0(b.inquiries));
    const baseWinRate = ratio(n0(b.jobs_won), n0(b.visits));
    const haleoVisitRate = ratio(o.pursue, o.decided);
    const haleoWinRate = ratio(o.won, o.won + o.lost);
    const details: string[] = [];
    if (baseVisitRate != null && haleoVisitRate != null) details.push(`Leads worth a visit: ${pct(o.pursue, o.decided)}% with Haleo vs ${Math.round(baseVisitRate * 100)}% before`);
    if (baseWinRate != null && haleoWinRate != null) details.push(`Won after a visit: ${pct(o.won, o.won + o.lost)}% with Haleo vs ${Math.round(baseWinRate * 100)}% before`);
    if (!details.length) details.push(baseVisitRate == null ? "No baseline yet: add their normal numbers on the pilot card" : "Not enough outcomes yet");
    const closed = o.won + o.lost;
    if (baseWinRate == null || closed < MIN_SAMPLE) {
      out.push({ n: 4, question: QUESTIONS[4], verdict: "early", headline: closed ? `${o.won} won of ${closed} closed so far` : "Too early to compare", details });
    } else {
      const lift = (haleoWinRate ?? 0) - baseWinRate;
      out.push({
        n: 4,
        question: QUESTIONS[4],
        verdict: lift >= 0.05 ? "good" : lift >= -0.05 ? "watch" : "concern",
        headline: lift >= 0 ? `Win rate up ${Math.round(lift * 100)} points on their baseline` : `Win rate down ${Math.round(-lift * 100)} points on their baseline`,
        details: [...details, "Small samples swing. Read with the outcomes, not alone."],
      });
    }
  }

  // 5. Effort and late mismatches.
  {
    const saved = o.saved_a_lot + o.saved_some;
    const mismatchRate = ratio(o.big_mismatch, o.visits);
    const baseMismatch = n0(b.late_mismatches_per_10_visits) ? n0(b.late_mismatches_per_10_visits) / 10 : null;
    const details = [
      o.effort_answers ? `Saved effort on ${saved} of ${o.effort_answers} briefs (${o.more_work} said it added work)` : "No effort answers yet",
      o.visits ? `Visits matched the brief: ${o.as_expected} as expected, ${o.small_surprise} small surprise, ${o.big_mismatch} big mismatch` : "No visits reported yet",
    ];
    if (baseMismatch != null && mismatchRate != null) details.push(`Big mismatches found on site: ${Math.round(mismatchRate * 100)}% vs ${Math.round(baseMismatch * 100)}% before`);
    out.push(
      o.effort_answers < MIN_SAMPLE
        ? { n: 5, question: QUESTIONS[5], verdict: "early", headline: o.effort_answers ? `Saved effort on ${saved} of ${o.effort_answers} so far` : "No answers yet", details }
        : {
            n: 5,
            question: QUESTIONS[5],
            verdict: o.more_work / o.effort_answers > 0.25 ? "concern" : grade(saved / o.effort_answers, 0.6, 0.4),
            headline: `Saved back-and-forth on ${pct(saved, o.effort_answers)}% of briefs`,
            details,
          },
    );
  }

  // 6. Health: real business won, homeowners not put off.
  {
    const hardShare = easeN ? ease.hard / easeN : 0;
    const details = [
      `${o.won} won${o.won_value_k ? ` ($${Math.round(o.won_value_k)}K)` : ""}, ${o.lost} lost, ${o.open} open`,
      easeN ? `${pct(ease.hard, easeN)}% of homeowners found it hard` : "No homeowner ratings yet",
    ];
    const started = Math.max(n0(r.intakes_started), n0(r.links_opened));
    if (started) details.push(`${pct(started - n0(r.briefs_sent), started)}% of homeowners who started didn't send`);
    out.push(
      easeN + o.won + o.lost < MIN_SAMPLE
        ? { n: 6, question: QUESTIONS[6], verdict: "early", headline: "Too early to tell", details }
        : {
            n: 6,
            question: QUESTIONS[6],
            verdict: hardShare > 0.25 ? "concern" : hardShare > 0.1 || (o.won === 0 && o.lost >= MIN_SAMPLE) ? "watch" : "good",
            headline: o.won ? `${o.won} job${o.won === 1 ? "" : "s"} won, ${pct(ease.easy + ease.okay, easeN || 1)}% of homeowners found it easy` : "No jobs won yet",
            details,
          },
    );
  }

  // 7. Repeat use and money.
  {
    const wp = r.would_pay?.answer;
    const details = [
      `Active ${r.active_weeks} week${r.active_weeks === 1 ? "" : "s"} since start${r.last_activity ? `, last ${new Date(r.last_activity).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`,
      wp ? `Would pay${r.would_pay?.price ? ` $${r.would_pay.price}/mo` : ""}: ${wp}` : "Hasn't answered the would-pay question",
      r.paying_since ? `Paying since ${new Date(r.paying_since).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not paying yet",
    ];
    const verdict: Verdict = r.paying_since
      ? "good"
      : r.active_weeks >= 3 && wp === "yes"
        ? "good"
        : r.active_weeks >= 2 || wp === "yes" || wp === "maybe"
          ? "watch"
          : r.active_weeks <= 1 && Date.now() - new Date(r.started_at).getTime() < 21 * 864e5
            ? "early"
            : "concern";
    out.push({
      n: 7,
      question: QUESTIONS[7],
      verdict,
      headline: r.paying_since ? "Paying" : r.active_weeks >= 2 ? `Used it in ${r.active_weeks} separate weeks` : r.active_weeks === 1 ? "Used it in one week so far" : "Not used yet",
      details,
    });
  }

  return out;
};

/** Every pilot added together, as one row, for the top of the page. */
export const totalRow = (rows: PilotRow[]): PilotRow | null => {
  if (!rows.length) return null;
  const sum = (f: (r: PilotRow) => number) => rows.reduce((t, r) => t + n0(f(r)), 0);
  const sumO = (k: keyof Outcomes) => rows.reduce((t, r) => t + n0(r.outcomes?.[k]), 0);
  const base = (k: keyof Baseline) => rows.reduce((t, r) => t + n0(r.baseline?.[k]), 0);
  const meds = rows.map((r) => r.median_minutes_to_send).filter((v): v is number => v != null).sort((a, b) => a - b);
  return {
    contractor_id: "all",
    name: "All pilots",
    slug: "",
    claimed: true,
    status: "active",
    started_at: rows.map((r) => r.started_at).sort()[0],
    baseline: { inquiries: base("inquiries"), visits: base("visits"), jobs_won: base("jobs_won") },
    price_offered_monthly: null,
    paying_since: rows.find((r) => r.paying_since)?.paying_since ?? null,
    inquiries_reported: sum((r) => r.inquiries_reported),
    links_reported: sum((r) => r.links_reported),
    weeks_reported: sum((r) => r.weeks_reported),
    front_door_views: sum((r) => r.front_door_views),
    links_made: sum((r) => r.links_made),
    links_opened: sum((r) => r.links_opened),
    intakes_started: sum((r) => r.intakes_started),
    briefs_sent: sum((r) => r.briefs_sent),
    median_minutes_to_send: meds.length ? meds[Math.floor(meds.length / 2)] : null,
    homeowner_ease: {
      easy: sum((r) => r.homeowner_ease?.easy ?? 0),
      okay: sum((r) => r.homeowner_ease?.okay ?? 0),
      hard: sum((r) => r.homeowner_ease?.hard ?? 0),
    },
    outcomes: {
      ...(Object.fromEntries(Object.keys(EMPTY_OUTCOMES).map((k) => [k, sumO(k as keyof Outcomes)])) as Outcomes),
      median_hours_to_decision: null,
    },
    active_weeks: Math.max(...rows.map((r) => n0(r.active_weeks))),
    last_activity: rows.map((r) => r.last_activity).filter(Boolean).sort().pop() ?? null,
    would_pay: null,
  };
};

// ───── Weekly pulse ─────

/** Monday of the week, as YYYY-MM-DD in local time: the key for the weekly inquiry count. */
export const weekStart = (d = new Date()): string => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/** What we ask contractors once they've made a few calls with Haleo. */
export const PILOT_PRICE_MONTHLY = 49;
export const WOULD_PAY_AFTER_DECISIONS = 3;
