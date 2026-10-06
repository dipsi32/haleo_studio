// The deal read: one screen to decide whether a brief is worth a site visit.
// Everything on it comes from what the homeowner entered or from public
// records attached to the brief (see src/lib/dealRead.ts). Where we can't say,
// it says what is missing and lets the contractor ask.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CircleHelp, Info, ListChecks, Ruler, ShieldCheck, Wallet } from "lucide-react";
import { computeDealRead, type BuyBox, type DealSnapshot, type FitLevel } from "@/lib/dealRead";

const FIT_STYLE: Record<FitLevel, string> = {
  fits: "border-sage/30 bg-sage/10 text-sage",
  check: "border-amber-400/40 bg-amber-50 text-amber-700",
  below: "border-border bg-secondary text-muted-foreground",
  unset: "border-border bg-secondary text-muted-foreground",
};

const COMPLETE_STYLE = {
  strong: "text-sage",
  some: "text-amber-700",
  light: "text-muted-foreground",
} as const;

type Props = {
  snapshot: DealSnapshot;
  buyBox?: BuyBox | null;
  /** Called with a ready-to-send question when the contractor taps an open item. */
  onAsk?: (question: string) => void;
};

export default function DealReadCard({ snapshot, buyBox, onAsk }: Props) {
  const read = useMemo(() => computeDealRead(snapshot, buyBox), [snapshot, buyBox]);
  const { fit, size, permit, flags, unknowns, completeness } = read;

  return (
    <section className="rounded-2xl border border-foreground/15 bg-card p-5" aria-label="Deal read">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deal read</p>
          <p className="mt-1 font-display text-lg leading-snug">{read.headline}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${FIT_STYLE[fit.level]}`}>
          {fit.title}
        </span>
      </div>

      {fit.level === "unset" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Tell Haleo what you take on and this will say yes, maybe or no.{" "}
          <Link to="/pro/links#fit" className="text-foreground underline underline-offset-4 hover:text-accent">
            Set your fit criteria
          </Link>
        </p>
      ) : (
        fit.reasons.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-foreground/80">
            {fit.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Ruler className="h-3 w-3" /> Size and budget
          </div>
          <p className="mt-1 text-sm font-medium">
            {size.sqft ? `${size.sqft.toLocaleString("en-US")} sq ft` : "Size not given"}
          </p>
          <p className="text-sm">{size.budgetLabel ?? "Budget not shared"}</p>
          {size.perSqft && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-foreground/80">
              <Wallet className="h-3 w-3" /> {size.perSqft}
            </p>
          )}
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{size.note}</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Permit path
          </div>
          <p className="mt-1 text-sm font-medium">{permit.label}</p>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{permit.note}</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Brief completeness
          </div>
          <p className={`mt-1 text-sm font-medium ${COMPLETE_STYLE[completeness.level]}`}>
            {completeness.score} of {completeness.total} shared
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {completeness.missing.length ? `Missing: ${completeness.missing.join(", ")}` : "Everything we ask for is here."}
          </p>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Flags from public records</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {flags.map((f) => (
              <li
                key={f.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  f.tone === "watch" ? "border-amber-400/40 bg-amber-50 text-amber-700" : "border-border bg-secondary text-foreground/80"
                }`}
              >
                {f.tone === "watch" ? <AlertTriangle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unknowns.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Still open</p>
          <ul className="mt-2 space-y-1.5">
            {unknowns.map((q) => (
              <li key={q} className="flex items-start gap-2 text-sm text-foreground/85">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{q}</span>
                {onAsk && (
                  <button
                    type="button"
                    onClick={() => onAsk(q)}
                    className="shrink-0 text-xs font-medium text-foreground underline underline-offset-4 hover:text-accent"
                  >
                    Ask
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
