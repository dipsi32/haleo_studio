// Scope-of-work + budget — anchors the user's number to a real tier.
// Tooltips explain what each tier includes; an info strip nudges neighborhood
// intel once the user has shared an address.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SCOPE_OPTIONS, scopeFor, type Address, type ScopeTier, type Timeline } from "@/lib/intake";
import { cn } from "@/lib/utils";

const fmtMoney = (v: number) => (v >= 500 ? "$500K+" : `$${v}K`);

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
};

const ScopeBudgetStep = ({
  scope,
  onScopeChange,
  budgetMin,
  budgetMax,
  budgetSkipped,
  onBudgetChange,
  onSkipBudget,
  selectedTimeline,
  onPickTimeline,
  address,
}: Props) => {
  const active = scopeFor(scope);
  const min = budgetMin ?? active?.range.min ?? 40;
  const max = budgetMax ?? active?.range.max ?? 80;

  // Whenever scope changes, snap budget to that tier's range — but only once,
  // so the user can still drag away.
  const [snappedScope, setSnappedScope] = useState<ScopeTier | undefined>(scope);
  useEffect(() => {
    if (scope && scope !== snappedScope && !budgetSkipped) {
      const opt = scopeFor(scope);
      if (opt) onBudgetChange(opt.range.min, opt.range.max);
      setSnappedScope(scope);
    }
  }, [scope, snappedScope, budgetSkipped, onBudgetChange]);

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
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-light leading-tight">
                What kind of project is this?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the closest match. Each tier shows what's typically included and a starting cost band.
              </p>
            </div>
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

                  <div className="flex items-baseline gap-2">
                    <p className="font-display text-2xl font-medium tabular-nums">
                      {fmtMoney(o.range.min)}
                      <span className="text-muted-foreground"> – </span>
                      {fmtMoney(o.range.max)}
                    </p>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      typical
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Budget ── */}
        <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Budget range
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {active
                  ? `Anchored to ${active.label.toLowerCase()} — drag to fit your situation.`
                  : "Pick a scope above and we'll suggest a starting band."}
              </p>
            </div>
            <button
              onClick={onSkipBudget}
              className="text-xs text-muted-foreground underline-offset-4 transition-smooth hover:text-foreground hover:underline"
            >
              {budgetSkipped ? "Set a range instead" : "I'd rather not say"}
            </button>
          </div>

          {budgetSkipped ? (
            <p className="py-6 text-center font-display text-3xl font-light text-muted-foreground">
              Skipped — that's fine.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              <p className="text-center font-display text-5xl font-medium tabular-nums">
                {fmtMoney(min)} <span className="text-muted-foreground">–</span> {fmtMoney(max)}
              </p>
              <Slider
                value={[min, max]}
                min={5}
                max={500}
                step={5}
                minStepsBetweenThumbs={1}
                onValueChange={(v) => onBudgetChange(v[0], v[1])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$5K</span>
                <span>$500K+</span>
              </div>
            </div>
          )}

          {/* Neighborhood intel strip */}
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
                <span className="font-medium">{address?.city} ballpark:</span>{" "}
                a typical {active.label.toLowerCase()} in your zip lands around{" "}
                <span className="font-medium text-foreground">
                  {fmtMoney(Math.round((active.range.min + active.range.max) / 2 - 5))}–
                  {fmtMoney(Math.round((active.range.min + active.range.max) / 2 + 15))}
                </span>
                . We'll sharpen this with real local comps as more projects come in.
              </p>
            </motion.div>
          )}
          {!showHood && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <p>
                Add your address (previous step) to see what neighbors paid for the same kind of project.
              </p>
            </div>
          )}
        </section>

        {/* ── Timeline ── */}
        <section className="mx-auto max-w-2xl space-y-4">
          <p className="text-center font-display text-2xl font-light text-foreground/90">
            When do you want to start?
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Tap one — that's the last thing.
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
