// The reply panel: answer a homeowner in under a minute. Three one-tap starting
// points (ask what's open, offer a visit, politely pass) that fill an editable
// draft from the brief. The contractor reads it, changes anything, and sends.
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CalendarCheck, CircleHelp, MessageSquare, Send as SendIcon, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DECLINE_REASON_LABEL,
  MESSAGE_LIMIT,
  declineReply,
  nextBusinessDays,
  questionsReply,
  replyState,
  visitReply,
  type DeclineReason,
  type DraftCtx,
} from "@/lib/replyDrafts";

export type ThreadItem = { id: string; sender_role: "contractor" | "homeowner"; message: string; created_at: string };

type Mode = "questions" | "visit" | "decline" | null;

type Props = {
  ctx: DraftCtx;
  thread: ThreadItem[];
  openQuestions: string[];
  sentAt: string | null;
  value: string;
  onChange: (v: string) => void;
  canSend: boolean;
  sending: boolean;
  onSend: () => void;
  /** Sends the current draft, then marks the brief as passed. */
  onSendAndPass: () => void;
};

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
    on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground/80 hover:border-foreground/40"
  }`;

export default function ReplyPanel({ ctx, thread, openQuestions, sentAt, value, onChange, canSend, sending, onSend, onSendAndPass }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [days, setDays] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<DeclineReason>("range");

  const slots = useMemo(() => nextBusinessDays(new Date(), 4), []);
  const state = replyState(thread);
  const name = ctx.homeowner.trim().split(/\s+/)[0] || "the homeowner";
  const last = thread.length ? thread[thread.length - 1] : null;

  const status =
    state === "homeowner_replied" && last
      ? `${name} replied ${formatDistanceToNow(new Date(last.created_at), { addSuffix: true })}`
      : state === "waiting"
        ? `Waiting on ${name}`
        : sentAt
          ? `You haven't replied yet · sent ${formatDistanceToNow(new Date(sentAt), { addSuffix: true })}`
          : "You haven't replied yet";

  const drafts = {
    questions: (sel: Set<number>) => questionsReply(ctx, openQuestions.filter((_, i) => sel.has(i))),
    visit: (sel: Set<string>) => visitReply(ctx, slots.filter((s) => sel.has(s.key)).map((s) => s.label)),
    decline: (r: DeclineReason) => declineReply(ctx, r),
  };

  const startQuestions = () => {
    const all = new Set(openQuestions.map((_, i) => i));
    setMode("questions");
    setPicked(all);
    onChange(drafts.questions(all));
  };
  const startVisit = () => {
    setMode("visit");
    setDays(new Set());
    onChange(drafts.visit(new Set()));
  };
  const startDecline = () => {
    setMode("decline");
    setReason("range");
    onChange(drafts.decline("range"));
  };

  const toggleQuestion = (i: number) => {
    const next = new Set(picked);
    if (!next.delete(i)) next.add(i);
    setPicked(next);
    onChange(drafts.questions(next));
  };
  const toggleDay = (k: string) => {
    const next = new Set(days);
    if (!next.delete(k)) next.add(k);
    setDays(next);
    onChange(drafts.visit(next));
  };

  const submit = () => (mode === "decline" ? onSendAndPass() : onSend());
  const disabled = sending || !value.trim() || !canSend;

  return (
    <section id="ask-homeowner" className="rounded-2xl border border-accent/30 bg-accent/5 p-5" aria-label="Reply to the homeowner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
          <MessageSquare className="h-3 w-3" /> Reply to {name}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            state === "homeowner_replied" ? "bg-amber-100 text-amber-800" : state === "waiting" ? "bg-muted text-muted-foreground" : "bg-foreground text-background"
          }`}
        >
          {status}
        </span>
      </div>

      {thread.length > 0 && (
        <ul className="mt-3 space-y-2">
          {thread.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl px-3 py-2 text-sm ${c.sender_role === "contractor" ? "ml-8 bg-foreground text-background" : "mr-8 border border-border bg-card"}`}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                {c.sender_role === "contractor" ? "You" : name} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{c.message}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick replies">
        {openQuestions.length > 0 && (
          <button type="button" onClick={startQuestions} className={chip(mode === "questions")}>
            <CircleHelp className="h-3.5 w-3.5" /> Ask what's open ({openQuestions.length})
          </button>
        )}
        <button type="button" onClick={startVisit} className={chip(mode === "visit")}>
          <CalendarCheck className="h-3.5 w-3.5" /> Offer a visit
        </button>
        <button type="button" onClick={startDecline} className={chip(mode === "decline")}>
          <ThumbsDown className="h-3.5 w-3.5" /> Not a fit
        </button>
      </div>

      {mode === "questions" && (
        <ul className="mt-3 space-y-1.5">
          {openQuestions.map((q, i) => (
            <li key={q}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground/85">
                <input type="checkbox" checked={picked.has(i)} onChange={() => toggleQuestion(i)} className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]" />
                <span>{q}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {mode === "visit" && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Which days can you come by?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s.key} type="button" onClick={() => toggleDay(s.key)} className={chip(days.has(s.key))} aria-pressed={days.has(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === "decline" && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">A short, kind no beats silence. Pick the reason:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(DECLINE_REASON_LABEL) as DeclineReason[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r);
                  onChange(drafts.decline(r));
                }}
                className={chip(reason === r)}
                aria-pressed={reason === r}
              >
                {DECLINE_REASON_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MESSAGE_LIMIT))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) submit();
          }}
          placeholder="Pick a quick reply above, or write your own."
          rows={mode ? 6 : 3}
          aria-label={`Message to ${name}`}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {value.length}/{MESSAGE_LIMIT} · goes to {name}'s notifications · Ctrl+Enter to send
          </span>
          <Button size="sm" onClick={submit} disabled={disabled}>
            <SendIcon className="h-3.5 w-3.5" /> {sending ? "Sending…" : mode === "decline" ? "Send and pass" : `Send to ${name}`}
          </Button>
        </div>
        {!canSend && <p className="text-[11px] text-muted-foreground">This brief was sent before reply-routing was set up.</p>}
      </div>
    </section>
  );
}
