// Scope-of-work + (optional) budget. The scope cards lead with what's
// included and a typical duration — no dollar amounts. Budget is fully
// optional: the user can type a number in mind, or tap a big "I'd rather
// not say" button and move on.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, Clock, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SCOPE_OPTIONS, scopeFor, type Address, type ScopeTier, type Timeline } from "@/lib/intake";
import { cn } from "@/lib/utils";

type Props = {
  scope?: ScopeTier;
  onScopeChange: (s: ScopeTier) => void;
  budgetMin?: number;
  budgetMax?: number;
  budgetSkipped?: boolean;
  onBudgetChange: (m: number, x: number) => void;
  onSkipBudget: () => void;
  selectedTimeline?: Timeline;
  onPickTimeline: (t: Timeline) => void;
  address?: Address;
  hideScope?: boolean;
};

// Parse loose budget input like "120k", "$80,000", "200" → number in $K.
const parseBudgetK = (raw: string): number | null => {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/[$,\s]/g, "");
  const isK = /k\b|k$/.test(cleaned);
  const n = parseFloat(cleaned.replace(/k/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  // If user typed "80000" assume dollars; "80" or "80k" assume thousands.
  const inK = isK || n < 1000 ? n : n / 1000;
  return Math.round(inK);
};

const ScopeBudgetStep = ({
  scope,
  onScopeChange,
  budgetMin,
  budgetSkipped,
  onBudgetChange,
  onSkipBudget,
  selectedTimeline,
  onPickTimeline,
  address,
  hideScope,
}: Props) => {
  const active = scopeFor(scope);

  // Local input state — converts to a single-point "range" on blur/enter.
  const [budgetText, setBudgetText] = useState<string>(
    budgetMin && !budgetSkipped ? String(budgetMin) : "",
  );

  useEffect(() => {
    // If parent clears or skips, reflect it locally.
    if (budgetSkipped) setBudgetText("");
    else if (budgetMin && !budgetText) setBudgetText(String(budgetMin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetSkipped, budgetMin]);

  const commitBudget = () => {
    const k = parseBudgetK(budgetText);
    if (k == null) return;
    // Store as a tight band around the user's number so downstream code keeps working.
    const lo = Math.max(5, Math.round(k * 0.85));
    const hi = Math.round(k * 1.15);
    onBudgetChange(lo, hi);
  };

  const timelines: { value: Timeline; label: string; sub: string }[] = [
    { value: "asap", label: "ASAP", sub: "Ready to move." },
    { value: "1-3", label: "1–3 months", sub: "Lining things up." },
    { value: "3-6", label: "3–6 months", sub: "Plenty of runway." },
    { value: "exploring", label: "Just exploring", sub: "Window-shopping ideas." },
  ];

  const showHood = useMemo(
    () => Boolean(address?.city && !address.skipped),
    [address],
  );

  return (
    <TooltipProvider delayDuration={120}>
      <div className="space-y-10">
        {/* ── Scope ── */}
        <section>
          <div className="mb-4">
            <p className="font-display text-2xl font-light leading-tight">
              What kind of project is this?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the closest match. Each one shows what's typically involved and how long it usually takes.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SCOPE_OPTIONS.map((o) => {
              const isActive = scope === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => onScopeChange(o.value)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border bg-card p-5 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift",
                    isActive ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-medium leading-tight">{o.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{o.oneLiner}</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-foreground/60 transition-smooth hover:bg-accent-soft hover:text-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        <p className="mb-1 font-semibold">{o.label} typically includes</p>
                        <ul className="list-inside list-disc space-y-0.5">
                          {o.includes.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-muted-foreground">
                          Permits: {o.permitLikely ? "usually required" : "usually exempt"}.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <ul className="space-y-1 text-xs text-foreground/75">
                    {o.includes.slice(0, 3).map((i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-accent" />
                    <span>
                      Typically <span className="font-medium text-foreground">{o.typicalDuration}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Budget (optional) ── */}
        <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <div>
            <p className="font-display text-xl font-light leading-tight">
              Have a budget in mind?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Totally optional. Sharing one helps tailor recommendations — skipping it is just as fine.
            </p>
          </div>

          {budgetSkipped ? (
            <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground/80">
                Skipped — we'll keep things open.
              </p>
              <button
                onClick={() => {
                  setBudgetText("");
                  // Re-enable the input by clearing the skipped flag via a 0,0 reset.
                  onBudgetChange(0, 0);
                }}
                className="text-xs font-medium text-accent underline-offset-4 hover:underline"
              >
                Change my mind
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg text-muted-foreground">
                  $
                </span>
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 80,000 or 120k"
                  value={budgetText}
                  onChange={(e) => setBudgetText(e.target.value)}
                  onBlur={commitBudget}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitBudget();
                    }
                  }}
                  className="h-14 pl-9 font-display text-xl"
                />
              </div>

              <button
                onClick={() => {
                  setBudgetText("");
                  onSkipBudget();
                }}
                className="w-full rounded-2xl border-2 border-dashed border-border bg-secondary/40 px-5 py-4 text-center font-display text-base font-medium text-foreground/80 transition-smooth hover:border-accent/60 hover:bg-accent-soft/40 hover:text-foreground"
              >
                I'd rather not say
              </button>
            </div>
          )}

          {/* Neighborhood intel strip — describes nearby projects, no dollars. */}
          {showHood && active && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-start gap-3 rounded-2xl bg-accent-soft/40 p-3 text-xs leading-relaxed text-foreground/85"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <p>
                <span className="font-medium">{address?.city}:</span>{" "}
                we'll surface what neighbors recently did for this kind of project.
              </p>
            </motion.div>
          )}
        </section>

        {/* ── Timeline ── */}
        <section className="mx-auto max-w-2xl space-y-4">
          <p className="text-center font-display text-2xl font-light text-foreground/90">
            When do you want to start?
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Pick the one that fits — last step.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {timelines.map((o) => (
              <button
                key={o.value}
                onClick={() => onPickTimeline(o.value)}
                className={cn(
                  "rounded-2xl border bg-card p-5 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift",
                  selectedTimeline === o.value
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-border hover:border-accent/40",
                )}
              >
                <p className="font-display text-xl font-medium">{o.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{o.sub}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
};

export default ScopeBudgetStep;
