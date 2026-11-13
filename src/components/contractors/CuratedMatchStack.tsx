// Hinge-style curated match stack.
// One card at a time, peek of the next two behind it. Pass dismisses
// the current match; Send sends ONE brief (committed, considered).
// After the user works through the curated set, we offer to reveal more.
import { useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, X as XIcon, Send, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RankedContractor } from "@/lib/useContractors";
import type { IntakeData } from "@/lib/intake";
import type { JobFit } from "@/lib/jobFit";
import { useJobFit } from "@/lib/useJobFit";
import JobFitBreakdown from "@/components/contractors/JobFitBreakdown";

/** Lead with the facts that line up, strongest first. */
const leadFacts = (fit: JobFit): string[] =>
  fit.rows.filter((r) => r.level === "yes").concat(fit.rows.filter((r) => r.level === "some")).map((r) => r.fact).slice(0, 2);

const EYEBROW = ["Start here", "Also worth a call", "One more to compare"];

type CardProps = {
  rc: RankedContractor;
  index: number;
  data: IntakeData;
  onPass: () => void;
  onSend: () => void;
};

const MatchCard = ({ rc, index, data, onPass, onSend }: CardProps) => {
  const navigate = useNavigate();
  const { contractor, license } = rc;
  const fit = useJobFit(contractor.id, rc.permits, data, license);
  const lead = leadFacts(fit);
  const name = contractor.company ?? contractor.name;
  const [exitDir, setExitDir] = useState<-1 | 0 | 1>(0);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const x = info.offset.x;
    const v = info.velocity.x;
    if (x < -120 || v < -600) { setExitDir(-1); setTimeout(onPass, 160); }
    else if (x > 120 || v > 600) { setExitDir(1); setTimeout(onSend, 160); }
  };

  return (
    <motion.article
      key={contractor.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        x: exitDir === 0 ? 0 : exitDir * 480,
        rotate: exitDir * 8,
        transition: { duration: 0.22, ease: "easeOut" },
      }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      whileDrag={{ rotate: 0, cursor: "grabbing" }}
      style={{ touchAction: "pan-y" }}
      className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-lift"
    >
      <div className="px-6 pt-6 pb-5 md:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{fit.flag ? "Read this first" : EYEBROW[index] ?? "Worth a look"}</p>
        <h3 className="mt-2 font-display text-2xl font-light leading-tight text-foreground">{name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {contractor.specialty ?? "General contractor"} · {contractor.city ?? "San Jose"}
        </p>

        {lead.length > 0 && !fit.flag && (
          <ul className="mt-4 space-y-1.5">
            {lead.map((l) => (
              <li key={l} className="flex gap-2 text-[15px] leading-snug text-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                {l}
              </li>
            ))}
          </ul>
        )}

        <JobFitBreakdown fit={fit} who={name} defaultOpen className="mt-5" surface="curated" />

        <button
          onClick={() => navigate(`/contractors/${contractor.id}`)}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          See every permit <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 border-t border-border bg-background/60 px-5 py-4">
        <button
          onClick={() => { setExitDir(-1); setTimeout(onPass, 160); }}
          aria-label="Pass"
          className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-smooth hover:-translate-y-0.5 hover:border-foreground/30 hover:text-foreground"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <Button
          onClick={() => { setExitDir(1); setTimeout(onSend, 160); }}
          className="h-12 rounded-full px-6 shadow-soft"
        >
          <Send className="h-4 w-4" /> Send my brief
        </Button>
      </div>
    </motion.article>
  );
};

type Decision = "sent" | "passed";

type Props = {
  matches: RankedContractor[];           // top 3 (or fewer)
  /** The homeowner's intake: the job each record is read against. */
  data: IntakeData;
  onSend: (rc: RankedContractor) => void;
  onSendMany?: (rcs: RankedContractor[]) => void;  // second-chance mass invite
  onUnlockMore?: () => void;             // user wants to see the rest → paywall
};

function RecapView({
  matches, decisions, onSendMany, onUnlockMore,
}: {
  matches: RankedContractor[];
  decisions: Record<string, "sent" | "passed">;
  onSendMany?: (rcs: RankedContractor[]) => void;
  onUnlockMore?: () => void;
}) {
  const total = matches.length;
  const sentCount = Object.values(decisions).filter(d => d === "sent").length;

  // Second-chance multi-select: default-check anyone the user passed on.
  // Already-sent ones aren't selectable (no spamming).
  const [picks, setPicks] = useState<Set<string>>(() => {
    const s = new Set<string>();
    matches.forEach(rc => {
      if (decisions[rc.contractor.id] !== "sent") s.add(rc.contractor.id);
    });
    return s;
  });
  const togglable = matches.filter(rc => decisions[rc.contractor.id] !== "sent");
  const pickedRcs = togglable.filter(rc => picks.has(rc.contractor.id));
  const togglePick = (id: string) => {
    setPicks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lift"
    >
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-amber-50 via-card to-card px-5 py-3">
        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700">
          Your curated round · complete
        </p>
      </div>

      <div className="px-6 pt-6 pb-5 md:px-7">
        <h3 className="font-display text-2xl font-light leading-tight">
          {sentCount === 0
            ? "Reviewed all 3. None made the cut."
            : sentCount === total
            ? `Brief on its way to all ${total}.`
            : `Brief sent to ${sentCount} of ${total}.`}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {sentCount > 0
            ? "We'll notify you the moment any of them open it."
            : "It happens. The shortlist is opinionated — sometimes you want a wider pool."}
        </p>

        {/* Per-match rows: checkbox for passed ones, status pill for sent ones */}
        <ul className="mt-5 space-y-2">
          {matches.map((rc, i) => {
            const d = decisions[rc.contractor.id];
            const checked = picks.has(rc.contractor.id);
            if (d === "sent") {
              return (
                <li
                  key={rc.contractor.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <p className="min-w-0 truncate font-medium text-foreground">
                    {rc.contractor.company ?? rc.contractor.name}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2.5 py-0.5 text-[11px] font-medium text-sage">
                    <Send className="h-3 w-3" /> Brief sent
                  </span>
                </li>
              );
            }
            return (
              <li key={rc.contractor.id}>
                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition-smooth ${
                    checked
                      ? "border-amber-500 bg-amber-50/60"
                      : "border-border bg-background hover:border-foreground/30"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-smooth ${
                        checked ? "border-amber-500 bg-amber-500 text-white" : "border-border bg-card"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <p className="min-w-0 truncate font-medium text-foreground">
                      {rc.contractor.company ?? rc.contractor.name}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => togglePick(rc.contractor.id)}
                  />
                </label>
              </li>
            );
          })}
        </ul>

        {/* Second-chance mass invite — only when there's someone to invite */}
        {togglable.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-50/50 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Invite the ones you passed on, too?
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Same brief, one extra click. Check anyone else you want to hear from.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const allChecked = togglable.every(rc => picks.has(rc.contractor.id));
                  setPicks(prev => {
                    const next = new Set(prev);
                    if (allChecked) togglable.forEach(rc => next.delete(rc.contractor.id));
                    else togglable.forEach(rc => next.add(rc.contractor.id));
                    return next;
                  });
                }}
                className="text-xs font-medium text-amber-700 underline-offset-4 hover:underline"
              >
                {togglable.every(rc => picks.has(rc.contractor.id)) ? "Clear all" : "Select all"}
              </button>
              <Button
                disabled={pickedRcs.length === 0}
                onClick={() => pickedRcs.length > 0 && onSendMany?.(pickedRcs)}
                className="h-10 rounded-full bg-amber-500 px-4 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {pickedRcs.length === 1
                  ? "Send brief to 1 more"
                  : `Send brief to ${pickedRcs.length || 0} more`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Paywall */}
      <div className="border-t border-border bg-gradient-to-b from-amber-50/60 to-card px-6 py-5 md:px-7">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-soft">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-medium text-foreground">
              Want a wider pool? Unlock the full match list.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Every additional contractor is sourced the same way — real permit history, CSLB license file,
              public records only.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] uppercase tracking-wider text-amber-700">
            Test mode · no real card is charged
          </p>
          <Button
            onClick={() => onUnlockMore?.()}
            className="h-11 rounded-full bg-foreground px-5 text-background hover:bg-foreground/90"
          >
            Unlock the rest <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function CuratedMatchStack({ matches, data, onSend, onSendMany, onUnlockMore }: Props) {
  const [cursor, setCursor] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, "sent" | "passed">>({});
  const total = matches.length;
  const active = matches[cursor];
  const next1 = matches[cursor + 1];
  const next2 = matches[cursor + 2];

  const record = (id: string, d: "sent" | "passed") => {
    setDecisions(prev => ({ ...prev, [id]: d }));
    setCursor(c => c + 1);
  };

  if (!active) {
    return (
      <RecapView
        matches={matches}
        decisions={decisions}
        onSendMany={onSendMany}
        onUnlockMore={onUnlockMore}
      />
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-xl">
      {/* Stack of upcoming cards */}
      <div className="relative" style={{ minHeight: 540 }}>
        {next2 && (
          <div
            key={`peek2-${next2.contractor.id}`}
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-6 h-full rounded-[28px] border border-border bg-card/70 shadow-soft"
            style={{ transform: "scale(0.92)" }}
          />
        )}
        {next1 && (
          <div
            key={`peek1-${next1.contractor.id}`}
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-3 h-full rounded-[28px] border border-border bg-card/90 shadow-soft"
            style={{ transform: "scale(0.96)" }}
          />
        )}
        <AnimatePresence mode="wait">
          <MatchCard
            key={active.contractor.id}
            rc={active}
            index={cursor}
            data={data}
            onPass={() => record(active.contractor.id, "passed")}
            onSend={() => { onSend(active); record(active.contractor.id, "sent"); }}
          />
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="mt-5 flex items-center justify-center gap-1.5">
        {matches.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < cursor ? "w-2 bg-muted-foreground/40" :
              i === cursor ? "w-6 bg-amber-500" :
              "w-2 bg-border"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {cursor + 1} of {total} · swipe, or tap below
      </p>
    </div>
  );
}
