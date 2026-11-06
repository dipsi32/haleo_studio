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
  Clock,
  MessageCircle,
  Hammer,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import type { AnalysisSection } from "@/lib/brief";
import BasisPill from "@/components/intake/BasisPill";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<string, typeof Layers> = {
  job_summary: Clock,
  homeowner_answers: MessageCircle,
  scope_of_work: Hammer,
  risks: AlertTriangle,
  verify_on_site: ClipboardCheck,
  structural: Layers,
  finishes: Palette,
  constraints: Lock,
  opportunities: Lightbulb,
  code: ScrollText,
};


type Props = {
  sections: AnalysisSection[];
  defaultOpen?: number; // index of section open by default
};

const DetailedSpaceAnalysis = ({ sections, defaultOpen = 0 }: Props) => {
  const [open, setOpen] = useState<Set<number>>(new Set([defaultOpen]));
  const toggle = (i: number) => {
    const next = new Set(open);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOpen(next);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <ul className="divide-y divide-border">
        {sections.map((s, i) => {
          const Icon = SECTION_ICONS[s.key] ?? Layers;
          const isOpen = open.has(i);
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
                <span className="shrink-0 text-xs text-muted-foreground">{s.items.length}</span>
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
                        return (
                          <li
                            key={idx}
                            className="rounded-xl border border-border bg-background/60 p-3 text-sm leading-relaxed text-foreground/85"
                          >
                            {it.text}
                            <BasisPill basis={it.basis} section={s.title} />
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
