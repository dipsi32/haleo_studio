// Ready-to-send first replies for a contractor answering a homeowner's brief.
// Everything in a draft comes from the brief or from a choice the contractor
// just made (which days, which reason). Nothing is invented: no promised
// availability, no claims about the contractor. They can edit before sending.

export const MESSAGE_LIMIT = 800;

export type DraftCtx = {
  homeowner: string;
  company: string | null;
  /** Lowercase, e.g. "second-story addition". Falls back to "project". */
  project: string | null;
};

const firstName = (full: string): string => {
  const t = full.trim().split(/\s+/)[0] ?? "";
  return t && t.toLowerCase() !== "the" ? t : "there";
};

const who = (c: DraftCtx) => (c.company?.trim() ? `this is ${c.company.trim()}.` : "");
const proj = (c: DraftCtx) => (c.project?.trim() ? `your ${c.project.trim().toLowerCase()}` : "your project");

const clamp = (s: string): string => (s.length <= MESSAGE_LIMIT ? s : `${s.slice(0, MESSAGE_LIMIT - 1).trimEnd()}…`);

/** Ask the open questions in one message, numbered, so they can answer in one go. */
export function questionsReply(c: DraftCtx, questions: string[]): string {
  const head = `Hi ${firstName(c.homeowner)}, ${who(c)} I read your brief for ${proj(c)} and it was clear. Before we meet, a few quick things:`.replace(/\s+/g, " ");
  const tail = "A short reply is plenty. Then we can find a time to look at the space.";
  const lines: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const next = [...lines, `${i + 1}. ${questions[i]}`];
    if ([head, next.join("\n"), tail].join("\n\n").length > MESSAGE_LIMIT) break;
    lines.push(`${i + 1}. ${questions[i]}`);
  }
  if (!lines.length) return clamp(`${head}\n\n${tail}`);
  return clamp([head, lines.join("\n"), tail].join("\n\n"));
}

export type Slot = { key: string; label: string };

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The next `n` weekdays after `from`, skipping weekends. */
export function nextBusinessDays(from: Date, n = 4): Slot[] {
  const out: Slot[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ key, label: `${WEEKDAY[wd]} ${d.getMonth() + 1}/${d.getDate()}` });
  }
  return out;
}

const joinOr = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

export function visitReply(c: DraftCtx, slotLabels: string[]): string {
  const when = slotLabels.length ? ` I can come by ${joinOr(slotLabels)}. What works best for you?` : " What days work best for you?";
  return clamp(`Hi ${firstName(c.homeowner)}, ${who(c)} I read your brief for ${proj(c)} and I'd like to see the space.${when}`.replace(/\s+/g, " "));
}

export type DeclineReason = "range" | "booked" | "type";

export const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
  range: "Outside my size or budget range",
  booked: "My schedule is full",
  type: "Not the work I do",
};

const DECLINE_TEXT: Record<DeclineReason, string> = {
  range: "it's outside the size and budget range I take on",
  booked: "my schedule is full for the timeline you described",
  type: "it isn't the kind of work I do",
};

export function declineReply(c: DraftCtx, reason: DeclineReason): string {
  return clamp(
    `Hi ${firstName(c.homeowner)}, thank you for sending your brief for ${proj(c)}. I read it carefully. I'm going to pass on this one because ${DECLINE_TEXT[reason]}. I didn't want to leave you waiting. Best of luck with the project.`,
  );
}

export type ThreadMsg = { sender_role: "contractor" | "homeowner"; created_at: string };

/** Where a conversation stands from the contractor's side. */
export type ReplyState = "new" | "homeowner_replied" | "waiting";

export function replyState(msgs: ThreadMsg[]): ReplyState {
  if (!msgs.length) return "new";
  const last = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at))[msgs.length - 1];
  return last.sender_role === "homeowner" ? "homeowner_replied" : "waiting";
}

type Triage = { passed: boolean; state: ReplyState; sentAt: string | null };

/** Lowest first: homeowner wrote back, then never contacted, then waiting, then passed. */
export function triageRank(t: Triage): number {
  if (t.passed) return 3;
  return t.state === "homeowner_replied" ? 0 : t.state === "new" ? 1 : 2;
}

export function triageCompare(a: Triage, b: Triage): number {
  return triageRank(a) - triageRank(b) || (b.sentAt ?? "").localeCompare(a.sentAt ?? "");
}

export type InboxFilter = "action" | "waiting" | "all";

export function matchesFilter(t: Triage, f: InboxFilter): boolean {
  if (f === "all") return true;
  if (f === "waiting") return !t.passed && t.state === "waiting";
  return !t.passed && t.state !== "waiting";
}
