// How ready is this lead? The lead sheet a remodeler would fill in on a
// 45-minute call, answered before the phone rings. A plain call, the four
// things behind it, and the one question worth asking. No score: the
// contractor's judgment wins.
import { useEffect } from "react";
import { ArrowDown, ArrowUp, Minus, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { SIGNAL_SOURCE_LABEL, type LeadReadiness, type ReadinessLevel, type Strength } from "@/lib/leadReadiness";

const LEVEL: Record<ReadinessLevel, { dot: string; ring: string }> = {
  ready: { dot: "bg-sage", ring: "border-sage/40 bg-sage/5" },
  serious: { dot: "bg-accent", ring: "border-accent/30 bg-accent/5" },
  early: { dot: "bg-amber-500", ring: "border-amber-400/40 bg-amber-50/60" },
  unclear: { dot: "bg-foreground/30", ring: "border-border bg-card" },
};

/** For a chip in a list. */
export const READY_CHIP: Record<ReadinessLevel, { cls: string; dot: string }> = {
  ready: { cls: "border-sage/40 bg-sage/10 text-sage", dot: "bg-sage" },
  serious: { cls: "border-accent/30 bg-accent/10 text-accent", dot: "bg-accent" },
  early: { cls: "border-amber-400/40 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  unclear: { cls: "border-border bg-muted text-muted-foreground", dot: "bg-foreground/30" },
};

const STRENGTH: Record<Strength, { label: string; bars: number; cls: string }> = {
  strong: { label: "Strong", bars: 3, cls: "bg-sage" },
  some: { label: "Some", bars: 2, cls: "bg-accent" },
  weak: { label: "Low", bars: 1, cls: "bg-amber-500" },
  unknown: { label: "Not shared", bars: 0, cls: "bg-foreground/20" },
};

const Bars = ({ s }: { s: Strength }) => (
  <span className="inline-flex items-end gap-0.5" aria-hidden>
    {[1, 2, 3].map((i) => (
      <span key={i} className={cn("w-1.5 rounded-sm", i <= STRENGTH[s].bars ? STRENGTH[s].cls : "bg-foreground/10")} style={{ height: 4 + i * 3 }} />
    ))}
  </span>
);

const EffectIcon = ({ effect }: { effect: "up" | "down" | "neutral" }) =>
  effect === "up" ? (
    <ArrowUp className="mt-0.5 h-3 w-3 shrink-0 text-sage" />
  ) : effect === "down" ? (
    <ArrowDown className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
  ) : (
    <Minus className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
  );

export default function ReadinessCard({ readiness: r, compact = false }: { readiness: LeadReadiness; compact?: boolean }) {
  const lv = LEVEL[r.level];
  useEffect(() => {
    track("lead_readiness_shown", { level: r.level, compact });
  }, [r.level, compact]);

  return (
    <section className={cn("rounded-2xl border", lv.ring, compact ? "p-4" : "p-5")} aria-label="Lead readiness">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lead readiness</p>
      <p className={cn("mt-1 flex items-center gap-2 font-display font-light", compact ? "text-lg" : "text-2xl")}>
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", lv.dot)} />
        {r.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground/75">{r.summary}</p>

      <ul className={cn("mt-4 grid gap-3", !compact && "sm:grid-cols-2")}>
        {r.dimensions.map((d) => (
          <li key={d.key} className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="flex items-center justify-between gap-2 text-xs font-medium">
              <span>{d.label}</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                {STRENGTH[d.strength].label} <Bars s={d.strength} />
              </span>
            </p>
            {d.signals.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {d.signals.slice(0, compact ? 2 : 4).map((s) => (
                  <li key={s.text} className="flex items-start gap-1.5 text-[13px] leading-snug text-foreground/85">
                    <EffectIcon effect={s.effect} />
                    <span className="min-w-0">
                      {s.text}
                      {!compact && <span className="ml-1.5 text-[10px] text-muted-foreground">{SIGNAL_SOURCE_LABEL[s.source]}</span>}
                      {s.note && !compact && <span className="block text-xs text-muted-foreground">{s.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">They didn't say. Worth asking, not a bad sign.</p>
            )}
          </li>
        ))}
      </ul>

      {r.ask && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-background/80 p-3">
          <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-sm leading-snug">
            <span className="font-medium">Ask first: </span>“{r.ask.question}”
            <span className="block text-xs text-muted-foreground">{r.ask.why}</span>
          </p>
        </div>
      )}

      {!compact && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Our read of how ready the project is, from their answers and what they did in the brief. It isn't a rating of
          anyone. Haleo gathers the context; you make the call.
        </p>
      )}
    </section>
  );
}
