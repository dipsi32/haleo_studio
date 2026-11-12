// A small note at the top of a brief: what kind of lead this looks like, a
// spectrum from early to ready, and the two or three reasons behind it.
// Glanceable, dismissible, never in the way of the brief itself.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronDown, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { readinessPosition, topReasons, type LeadReadiness } from "@/lib/leadReadiness";

const LABEL: Record<LeadReadiness["level"], string> = {
  ready: "Looks like a ready lead",
  serious: "Looks like a serious lead",
  early: "Looks like an early lead",
  unclear: "Too early to tell what kind of lead",
};

export default function LeadToast({ readiness: r }: { readiness: LeadReadiness }) {
  const [open, setOpen] = useState(true);
  const [more, setMore] = useState(false);
  const pos = readinessPosition(r);
  const reasons = topReasons(r);

  useEffect(() => {
    track("lead_readiness_shown", { level: r.level, compact: true });
  }, [r.level]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16, height: 0, marginBottom: 0 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 280, damping: 26 }}
          className="mb-3 overflow-hidden rounded-2xl border border-border bg-background p-3.5 shadow-lift"
          role="status"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[14px] font-semibold leading-snug">{LABEL[r.level]}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* The spectrum */}
          <div className="mt-3">
            <div className="relative h-2 rounded-full bg-gradient-to-r from-amber-300 via-accent/70 to-sage">
              {pos != null && (
                <motion.span
                  initial={{ left: "50%" }}
                  animate={{ left: `${pos}%` }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-foreground shadow"
                  aria-label={`Position: ${r.title}`}
                />
              )}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Early</span>
              <span>Serious</span>
              <span>Ready</span>
            </div>
          </div>

          {/* Why */}
          {reasons.length > 0 ? (
            <ul className="mt-2.5 space-y-1">
              {reasons.map((s) => (
                <li key={s.text} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground/85">
                  {s.effect === "up" ? <ArrowUp className="mt-0.5 h-3 w-3 shrink-0 text-sage" /> : <ArrowDown className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />}
                  {s.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-[12.5px] text-foreground/75">They skipped most of the questions. One short call will tell you more.</p>
          )}

          {r.ask && (
            <>
              <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent">
                What to ask first <ChevronDown className={`h-3 w-3 transition-transform ${more ? "rotate-180" : ""}`} />
              </button>
              {more && <p className="mt-1 text-[12.5px] leading-snug text-foreground/80">“{r.ask.question}” {r.ask.why}</p>}
            </>
          )}
          <p className="mt-2 text-[10.5px] text-muted-foreground">From their answers and the brief. Haleo gathers the context; you make the call.</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
