// The five questions, answered from public record, for one contractor and
// one homeowner's job. Collapsed: the headline and five dots. Open: each
// answer with its fact and source. Logic: src/lib/jobFit.ts.
import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { FitLevel, JobFit } from "@/lib/jobFit";

const DOT: Record<FitLevel, string> = {
  yes: "bg-sage border-sage",
  some: "bg-sage/40 border-sage/60",
  no: "bg-transparent border-foreground/25",
  not_checked: "bg-transparent border-dashed border-muted-foreground/50",
  flag: "bg-destructive border-destructive",
};

const ANSWER: Record<FitLevel, string> = {
  yes: "Yes",
  some: "Some",
  no: "Not yet",
  not_checked: "Not checked",
  flag: "Check this",
};

export const FitDots = ({ fit, className }: { fit: JobFit; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
    {fit.rows.map((r) => (
      <span key={r.id} className={cn("h-2.5 w-2.5 rounded-full border", DOT[r.level])} />
    ))}
  </span>
);

type Props = { fit: JobFit; who: string; defaultOpen?: boolean; className?: string; surface?: string };

export default function JobFitBreakdown({ fit, who, defaultOpen = false, className, surface = "card" }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-2xl border border-border bg-secondary/40", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) track("job_fit_opened", { surface, lined: fit.lined, checked: fit.checked, flag: !!fit.flag });
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        {fit.flag ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> : <FitDots fit={fit} />}
        <span className={cn("min-w-0 flex-1 text-[14px] leading-snug", fit.flag ? "font-medium text-destructive" : "text-foreground")}>{fit.headline}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <ul className="space-y-3">
            {fit.rows.map((r) => (
              <li key={r.id} className="flex gap-3">
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border", DOT[r.level])} />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium leading-snug">
                    {r.question}{" "}
                    <span className={cn("font-normal", r.level === "flag" ? "text-destructive" : "text-muted-foreground")}>{ANSWER[r.level]}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {r.fact}
                    <span className="ml-2 rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.source}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-snug text-muted-foreground">
            How {who}'s public record lines up with your job, from San Jose permits, the city's inspection sign-offs and the
            state license board. Haleo doesn't rate people: these are counts, and "Not checked" is never a pass.
          </p>
        </div>
      )}
    </div>
  );
}
