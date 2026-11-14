// The job at a glance: the first thing a contractor sees when a brief opens.
// What the job is, in their words, how big, which trades, and the work by
// trade. Pure: built from the brief snapshot, nothing invented.
import { projectKindOf, type DealSnapshot, type ProjectKind } from "@/lib/dealRead";

const JOB_NAME: Record<ProjectKind, string> = {
  kitchen: "Kitchen remodel",
  bathroom: "Bathroom remodel",
  addition: "Addition or ADU",
  "whole-home": "Whole-home remodel",
  other: "Home project",
};

export type JobGlance = {
  /** "Kitchen remodel" */
  title: string;
  /** What they want, in their own words, one or two lines. */
  goal: string | null;
  /** True when `goal` is what the homeowner typed, so it can be quoted as theirs. */
  goalIsTheirs: boolean;
  /** "Medium job · Electrician, Finish carpenter · about 2–4 weeks": Haleo's estimate. */
  size: string | null;
  /** The work, by trade, at most four lines. */
  scope: string[];
  /** Where, budget, timeline. */
  facts: string[];
};

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const jobGlance = (snap: DealSnapshot): JobGlance => {
  const sections = snap.haleo_read?.sections ?? [];
  const find = (re: RegExp) => sections.find((s) => re.test(s.title));
  const size = find(/^job summary$|^at a glance$/i)?.items[0]?.text?.trim() || null;
  const scopeSection = find(/^scope of work$|^likely work$/i);
  const scope = scopeSection
    ? scopeSection.items.map((i) => i.text.trim()).filter(Boolean).slice(0, 4)
    : (snap.trade_groups ?? []).slice(0, 4).map((g) => `${g.trade}: ${g.lines[0] ?? ""}`.replace(/:\s*$/, ""));

  // Their words when they typed some; otherwise the brief's plain opener,
  // which is ours and must never be dressed up as a quote.
  const typed = (snap.goal_note || snap.vision || "").trim();
  const raw = typed || (snap.scope_summary || "").replace(/^\s*our project:\s*/i, "").trim();
  const goal = raw ? clip(sentence(raw), 140) : null;
  const goalIsTheirs = !!typed || /^\s*our project:/i.test(snap.scope_summary ?? "");

  const facts = [snap.neighborhood, snap.budget, snap.timeline].filter((f): f is string => Boolean(f && f.trim()));
  return { title: JOB_NAME[projectKindOf(snap)], goal, goalIsTheirs, size, scope, facts };
};

/** Sections already shown at a glance, so the full brief doesn't repeat them. */
export const isGlanceSection = (title: string) => /^(job summary|at a glance|scope of work|likely work)$/i.test(title.trim());
