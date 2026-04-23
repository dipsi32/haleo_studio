// Detailed Space Analysis — sectioned read of the project, contractor-lens.
// Mirrors the structure used in the ClearContract Flow project so contractors
// get a familiar read: structure → finishes → constraints → opportunities → code.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Layers,
  Palette,
  Lock,
  Lightbulb,
  ScrollText,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { AnalysisSection } from "@/lib/brief";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<string, typeof Layers> = {
  structural: Layers,
  finishes: Palette,
  constraints: Lock,
  opportunities: Lightbulb,
  code: ScrollText,
};

const BASIS_META = {
  grounded: { label: "From you", icon: Check, cls: "text-sage" },
  inferred: { label: "Inferred", icon: AlertCircle, cls: "text-accent" },
  question: { label: "Open", icon: HelpCircle, cls: "text-foreground/60" },
} as const;

type Props = {
  sections: AnalysisSection[];
  defaultOpen?: number; // index of section open by default
};

const DetailedSpaceAnalysis = ({ sections, defaultOpen = 0 }: Props) => {
  const [open, setOpen] = useState<Set<number>>(new Set([defaultOpen]));
  const toggle = (i: number) => {
    const next = new Set(open);
    next.has(i) ? next.delete(i) : next.add(i);
    setOpen(next);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      {/* Legend strip — explains the badges once */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] text-foreground/70 md:px-6">
        <span className="font-medium uppercase tracking-wider text-foreground/60">
          How to read it
        </span>
        {(["grounded", "inferred", "question"] as const).map((b) => {
          const m = BASIS_META[b];
          const Icon = m.icon;
          return (
            <span key={b} className="inline-flex items-center gap-1">
              <Icon className={cn("h-3 w-3", m.cls)} />
              {m.label}
            </span>
          );
        })}
      </div>

      <ul className="divide-y divide-border">
        {sections.map((s, i) => {
          const Icon = SECTION_ICONS[s.key] ?? Layers;
          const isOpen = open.has(i);
          const groundedCount = s.items.filter((it) => it.basis === "grounded").length;
          const inferredCount = s.items.filter((it) => it.basis === "inferred").length;
          const questionCount = s.items.filter((it) => it.basis === "question").length;
          return (
            <li key={s.key}>
              <button
                onClick={() => toggle(i)}
                className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-smooth hover:bg-secondary/40 md:px-6"
                aria-expanded={isOpen}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-medium leading-tight">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                </div>
                <span className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/60 sm:flex">
                  {groundedCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-sage">
                      <Check className="h-2.5 w-2.5" /> {groundedCount}
                    </span>
                  )}
                  {inferredCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                      <AlertCircle className="h-2.5 w-2.5" /> {inferredCount}
                    </span>
                  )}
                  {questionCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-foreground/60">
                      <HelpCircle className="h-2.5 w-2.5" /> {questionCount}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-foreground/50 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <ul className="space-y-2 px-5 pb-5 md:px-6 md:pb-6">
                      {s.items.map((it, idx) => {
                        const meta = BASIS_META[it.basis];
                        const Icon = meta.icon;
                        return (
                          <li
                            key={idx}
                            className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-3"
                          >
                            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.cls)} />
                            <p className="text-sm leading-relaxed text-foreground/85">
                              {it.text}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DetailedSpaceAnalysis;
