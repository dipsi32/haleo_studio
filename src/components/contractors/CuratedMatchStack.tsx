// Hinge-style curated match stack.
// One card at a time, peek of the next two behind it. Pass dismisses
// the current match; Send sends ONE brief (committed, considered).
// After the user works through the curated set, we offer to reveal more.
import { useMemo, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Hammer, MapPin, Calendar, ShieldCheck, Sparkles,
  X as XIcon, Send, ArrowRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RankedContractor } from "@/lib/useContractors";
import { evaluateDiscipline } from "@/lib/cslbSignals";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;

/** Hand-tuned, opinionated reasons drawn from real signals on the rank object. */
function buildReasons(rc: RankedContractor, projectLabel: string, neighborhood: string): string[] {
  const reasons: string[] = [];
  const { contractor, permits, license, matchCount, recentPermit, score } = rc;

  if (matchCount > 0) {
    reasons.push(
      `${matchCount} permitted ${projectLabel} job${matchCount === 1 ? "" : "s"} in ${neighborhood} — verified by city records`
    );
  } else if (permits.length > 0) {
    reasons.push(`${permits.length} permitted job${permits.length === 1 ? "" : "s"} pulled in ${neighborhood}`);
  }

  if (recentPermit?.issued_date) {
    const last = fmtDate(recentPermit.issued_date);
    if (last) reasons.push(`Most recent job: ${last}${recentPermit.address ? ` · ${recentPermit.address}` : ""}`);
  }

  if (license?.status?.toLowerCase().includes("active")) {
    if (license.issue_date) {
      const years = Math.max(0, Math.floor((Date.now() - new Date(license.issue_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
      if (years >= 1) reasons.push(`CSLB license active ${years} year${years === 1 ? "" : "s"} — clean standing`);
      else reasons.push(`CSLB license active and in clean standing`);
    } else {
      reasons.push(`CSLB license active and in clean standing`);
    }
  }

  // Top component highlight (e.g. "Local track record")
  const top = [...score.components].filter(c => c.weight > 0 && c.earned > 0)
    .sort((a, b) => (b.earned / Math.max(1, b.weight)) - (a.earned / Math.max(1, a.weight)))[0];
  if (top && reasons.length < 3) {
    reasons.push(top.detail);
  }

  if (reasons.length === 0) reasons.push(`Verified local contractor near ${neighborhood}`);
  return reasons.slice(0, 3);
}

function rankHeadline(idx: number): { eyebrow: string; rationale: string } {
  if (idx === 0) return {
    eyebrow: "Top pick · the one I'd call first",
    rationale: "Closest fit by project type, location, and verified track record.",
  };
  if (idx === 1) return {
    eyebrow: "Strong second",
    rationale: "Different style, equally credible — worth a conversation.",
  };
  return {
    eyebrow: "Wild card worth meeting",
    rationale: "A specialist that brings a sharper angle on your scope.",
  };
}

type CardProps = {
  rc: RankedContractor;
  index: number;
  projectLabel: string;
  neighborhood: string;
  onPass: () => void;
  onSend: () => void;
};

const MatchCard = ({ rc, index, projectLabel, neighborhood, onPass, onSend }: CardProps) => {
  const navigate = useNavigate();
  const { contractor, license, score } = rc;
  const reasons = useMemo(() => buildReasons(rc, projectLabel, neighborhood), [rc, projectLabel, neighborhood]);
  const head = rankHeadline(index);
  const discipline = evaluateDiscipline(license);
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
      {/* Amber rank ribbon */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-amber-50 via-card to-card px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700">{head.eyebrow}</p>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
          {score.total} Trust
        </div>
      </div>

      <div className="px-6 pt-6 pb-5 md:px-7">
        <h3 className="font-display text-2xl font-light leading-tight text-foreground">
          {contractor.company ?? contractor.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {contractor.specialty ?? "General contractor"} · {contractor.city ?? "San Jose"}
        </p>

        {/* The opinionated bit — why Haleo picked them */}
        <div className="mt-5 rounded-2xl bg-secondary/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Why this match
          </p>
          <p className="mt-1.5 text-sm text-foreground/90">{head.rationale}</p>
          <ul className="mt-3 space-y-2">
            {reasons.map((r, i) => {
              const Icon = i === 0 ? Hammer : i === 1 ? Calendar : ShieldCheck;
              return (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>{r}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {discipline.hasRecord && (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Heads up: CSLB shows a disciplinary record. Tap "View profile" for details.
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Based in {contractor.city ?? "San Jose"}{contractor.zip ? ` · ${contractor.zip}` : ""}</span>
        </div>

        <button
          onClick={() => navigate(`/contractors/${contractor.id}`)}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          View full profile <ArrowRight className="h-3.5 w-3.5" />
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
          className="h-12 rounded-full bg-amber-500 px-6 text-white shadow-soft hover:bg-amber-600"
        >
          <Send className="h-4 w-4" /> Send my brief
        </Button>
      </div>

      {/* Drag affordance hint chips */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-4">
        <motion.div
          className="rounded-full border-2 border-muted-foreground/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
          initial={false}
        >
          Pass
        </motion.div>
        <motion.div
          className="rounded-full border-2 border-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-600"
          initial={false}
        >
          Send
        </motion.div>
      </div>
    </motion.article>
  );
};

type Props = {
  matches: RankedContractor[];           // top 3 (or fewer)
  projectLabel: string;
  neighborhood: string;
  onSend: (rc: RankedContractor) => void;
  onExhausted?: () => void;              // user passed/sent everything
};

export default function CuratedMatchStack({ matches, projectLabel, neighborhood, onSend, onExhausted }: Props) {
  const [cursor, setCursor] = useState(0);
  const total = matches.length;
  const active = matches[cursor];
  const next1 = matches[cursor + 1];
  const next2 = matches[cursor + 2];

  const advance = () => {
    setCursor(c => {
      const n = c + 1;
      if (n >= total) onExhausted?.();
      return n;
    });
  };

  if (!active) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <p className="font-display text-xl font-light">You've reviewed all 3 curated matches.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Want a wider pool? Open the full list of verified contractors below.
        </p>
      </div>
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
            projectLabel={projectLabel}
            neighborhood={neighborhood}
            onPass={advance}
            onSend={() => { onSend(active); advance(); }}
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
