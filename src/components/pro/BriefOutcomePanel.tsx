// "Your call": one quick question at a time, under the brief. Pursue, ask
// first or pass; then whether Haleo saved back-and-forth; for a job they
// pursued, how the visit matched the brief and how it ended. Every tap is
// saved, and every answer feeds the pilot scorecard.
import { useEffect, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import {
  DECISIONS,
  EFFORTS,
  EMPTY_OUTCOME,
  REASONS,
  RESULTS,
  VISIT_MATCHES,
  nextStep,
  outcomeSummary,
  parseValueK,
  toOutcome,
  type Outcome,
} from "@/lib/briefOutcome";

type Props = { sendId: string; contractorId: string | null; homeowner: string };

const Chip = ({ on, onClick, children, className }: { on?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) => (
  <button
    type="button"
    aria-pressed={!!on}
    onClick={onClick}
    className={cn(
      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
      className,
    )}
  >
    {children}
  </button>
);

export default function BriefOutcomePanel({ sendId, contractorId, homeowner }: Props) {
  const [o, setO] = useState<Outcome>(EMPTY_OUTCOME);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("brief_outcomes")
      .select("*")
      .eq("outreach_send_id", sendId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setO(toOutcome(data as Partial<Record<keyof Outcome, unknown>> | null));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sendId]);

  const save = async (patch: Partial<Outcome> & Record<string, unknown>, event: Parameters<typeof track>[0], props: Record<string, unknown>) => {
    if (!contractorId) return;
    const next = { ...o, ...patch } as Outcome;
    setO(next);
    const now = new Date().toISOString();
    const stamps: Record<string, string> = {};
    if ("decision" in patch) stamps.decided_at = now;
    if ("visit_match" in patch) stamps.visit_reported_at = now;
    if ("result" in patch) stamps.result_at = now;
    await supabase.from("brief_outcomes").upsert(
      { outreach_send_id: sendId, contractor_id: contractorId, ...next, ...stamps, updated_at: now },
      { onConflict: "outreach_send_id" },
    );
    track(event, { send_id: sendId, ...props });
  };

  if (!loaded) return <div className="h-24 animate-pulse rounded-2xl bg-muted/40" />;

  const step = editing ? "decision" : nextStep(o);
  const summary = outcomeSummary(o);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft" aria-label="Your call">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your call</p>
        {summary && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" /> Change
          </button>
        )}
      </div>
      {summary && step !== "decision" && <p className="mt-1 text-sm font-medium">{summary}</p>}

      {step === "decision" && (
        <div className="mt-2">
          <p className="font-display text-lg">What's next with {homeowner}?</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={o.decision === d.value}
                onClick={() => {
                  void save({ decision: d.value, decision_reasons: d.value === "pursue" ? [] : o.decision_reasons }, "brief_decision_made", { decision: d.value });
                  // Ask first or pass: stay here for the sticking point, then Done.
                  setEditing(d.value !== "pursue");
                }}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  o.decision === d.value ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
                )}
              >
                <span className="block text-sm font-medium">{d.label}</span>
                <span className={cn("block text-[11px]", o.decision === d.value ? "text-background/70" : "text-muted-foreground")}>{d.hint}</span>
              </button>
            ))}
          </div>
          {(o.decision === "clarify" || o.decision === "pass") && (
            <div className="mt-4">
              <p className="text-sm">What's the sticking point? <span className="text-muted-foreground">Optional</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {REASONS.map((r) => {
                  const on = o.decision_reasons.includes(r);
                  return (
                    <Chip
                      key={r}
                      on={on}
                      onClick={() => {
                        const reasons = on ? o.decision_reasons.filter((x) => x !== r) : [...o.decision_reasons, r];
                        void save({ decision_reasons: reasons }, "brief_decision_made", { decision: o.decision, reasons });
                      }}
                    >
                      {r}
                    </Chip>
                  );
                })}
              </div>
              <Button size="sm" className="mt-3 rounded-full" onClick={() => setEditing(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "effort" && (
        <div className="mt-3">
          <p className="text-sm">Did the brief save you back-and-forth with {homeowner}?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EFFORTS.map((e) => (
              <Chip key={e.value} onClick={() => void save({ effort: e.value }, "brief_effort_rated", { effort: e.value })}>
                {e.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {step === "visit" && (
        <div className="mt-3">
          <p className="text-sm">After the visit: did the job match the brief?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VISIT_MATCHES.map((v) => (
              <Chip key={v.value} on={o.visit_match === v.value} onClick={() => void save({ visit_match: v.value }, "brief_visit_reported", { visit_match: v.value })}>
                {v.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Come back to this after you've been out.</p>
        </div>
      )}

      {step === "result" && (
        <div className="mt-3">
          {(o.visit_match === "big_mismatch" || o.visit_match === "small_surprise") && !o.mismatch_note && (
            <div className="mb-4">
              <p className="text-sm">What didn't match? <span className="text-muted-foreground">Optional</span></p>
              <div className="mt-2 flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="e.g. Wall was load-bearing" className="h-10 rounded-xl" />
                <Button size="sm" variant="outline" className="h-10 rounded-full" disabled={!note.trim()} onClick={() => void save({ mismatch_note: note.trim() }, "brief_visit_reported", { has_note: true })}>
                  Save
                </Button>
              </div>
            </div>
          )}
          <p className="text-sm">How did it end?</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {RESULTS.map((r) => (
              <Chip key={r.value} on={o.result === r.value} onClick={() => void save({ result: r.value }, "brief_result_reported", { result: r.value })}>
                {r.label}
              </Chip>
            ))}
          </div>
          {o.result === "open" && <p className="mt-2 text-xs text-muted-foreground">We'll ask again later.</p>}
        </div>
      )}

      {step === "done" && o.result === "won" && o.contract_value_k == null && (
        <div className="mt-3">
          <p className="text-sm">Nice. Roughly what's the job worth? <span className="text-muted-foreground">Optional, only you and Haleo see it</span></p>
          <div className="mt-2 flex gap-2">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 62K" inputMode="decimal" className="h-10 max-w-[10rem] rounded-xl" />
            <Button
              size="sm"
              className="h-10 rounded-full"
              disabled={parseValueK(value) == null}
              onClick={() => void save({ contract_value_k: parseValueK(value) }, "brief_result_reported", { result: "won", has_value: true })}
            >
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
