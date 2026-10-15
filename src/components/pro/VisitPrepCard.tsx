// Visit prep: know the job before you drive out.
// A decision on top (worth the drive or not), then the few things worth
// knowing before you knock, then a cheat sheet. Every line says where it came
// from. See src/lib/visitPrep.ts for the rules.
import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, CircleHelp, Compass, Home, MessageCircle, Quote, Users, Wrench } from "lucide-react";
import { computeVisitPrep, prepToText, SOURCE_LABEL, type CallLevel, type PrepItem, type Source } from "@/lib/visitPrep";
import type { BuyBox, DealSnapshot } from "@/lib/dealRead";
import { track } from "@/lib/analytics";

const CALL_STYLE: Record<CallLevel, string> = {
  drive: "border-sage/30 bg-sage/10 text-sage",
  "call-first": "border-amber-400/40 bg-amber-50 text-amber-700",
  skip: "border-border bg-secondary text-muted-foreground",
  unset: "border-border bg-secondary text-muted-foreground",
};

const SOURCE_STYLE: Record<Source, string> = {
  record: "border-sage/30 bg-sage/10 text-sage",
  asked: "border-border bg-secondary text-foreground/70",
  math: "border-border bg-secondary text-foreground/70",
  inferred: "border-amber-400/40 bg-amber-50 text-amber-700",
};

const SourceBadge = ({ source }: { source: Source }) => (
  <span className={`ml-2 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 align-middle text-[10px] font-medium ${SOURCE_STYLE[source]}`}>
    {SOURCE_LABEL[source]}
  </span>
);

function ItemList({ items, empty }: { items: PrepItem[]; empty: string }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-2 space-y-2">
      {items.map((i) => (
        <li key={i.text} className="text-sm leading-snug text-foreground/90">
          <span className={i.tone === "watch" ? "font-medium" : undefined}>{i.text}</span>
          <SourceBadge source={i.source} />
          {i.note && <span className="mt-0.5 block text-[12px] text-muted-foreground">{i.note}</span>}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  snapshot: DealSnapshot;
  buyBox?: BuyBox | null;
  homeownerName?: string | null;
  /** Called with a ready-to-send question when the contractor taps Ask. */
  onAsk?: (question: string) => void;
};

export default function VisitPrepCard({ snapshot, buyBox, homeownerName, onAsk }: Props) {
  const prep = useMemo(() => computeVisitPrep(snapshot, buyBox), [snapshot, buyBox]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("visit_prep_viewed", { call: prep.call.level, surprises: prep.surprises.length, has_records: !prep.noRecords });
    // One event per brief, not per re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const copy = async () => {
    const text = prepToText(prep, { homeowner: homeownerName ?? undefined, address: snapshot.neighborhood });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      track("visit_prep_copied", { call: prep.call.level });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked; the sheet is still on screen.
    }
  };

  return (
    <section className="rounded-2xl border border-foreground/15 bg-card p-5" aria-label="Visit prep">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Compass className="h-3.5 w-3.5" /> Visit prep
          </p>
          <p className="mt-1 font-display text-lg leading-snug">Know the job before you drive out.</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${CALL_STYLE[prep.call.level]}`}>
          {prep.call.title}
        </span>
      </div>

      {prep.call.why.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-foreground/80">
          {prep.call.why.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}

      {prep.surprises.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Worth knowing before you knock</p>
          <ol className="mt-2 space-y-3">
            {prep.surprises.map((s) => (
              <li key={s.text} className="rounded-xl border border-border bg-background p-3.5">
                <p className="text-sm font-medium leading-snug">
                  {s.text}
                  <SourceBadge source={s.source} />
                </p>
                {s.note && <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{s.note}</p>}
                <p className="mt-2 flex items-start gap-1.5 text-[13px] italic leading-snug text-foreground/80">
                  <Quote className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                  <span>{s.opener}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground">
          {prep.noRecords
            ? "No public records came through for this address, so nothing here is pulled from them. The questions below will get you most of the way."
            : "Nothing in the records stands out, which is good news. The questions below will fill in the rest."}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Home className="h-3 w-3" /> Home and lot
          </p>
          <ItemList items={prep.home} empty="Nothing came through from public records for this address." />
        </div>
        <div className="rounded-xl border border-border bg-background p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3 w-3" /> The work
          </p>
          <ItemList items={prep.work} empty="" />
        </div>
        <div className="rounded-xl border border-border bg-background p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="h-3 w-3" /> The people
          </p>
          <ItemList items={prep.people} empty="They haven't shared more yet. Good questions below." />
        </div>
      </div>

      {prep.confirm.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Confirm on site</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Nobody knows these until someone is standing there. Naming them out loud reads as craft.
          </p>
          <ul className="mt-2 space-y-1.5">
            {prep.confirm.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-foreground/85">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prep.asks.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Good questions to ask</p>
          <ul className="mt-2 space-y-2">
            {prep.asks.map((a) => (
              <li key={a.question} className="flex items-start gap-2 text-sm text-foreground/90">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {a.question}
                  <span className="block text-[12px] text-muted-foreground">{a.why}</span>
                </span>
                {onAsk && (
                  <button
                    type="button"
                    onClick={() => {
                      onAsk(a.question);
                      track("visit_prep_question_added", {});
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4 hover:text-accent"
                  >
                    <MessageCircle className="h-3 w-3" /> Ask
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="max-w-md text-[11px] leading-snug text-muted-foreground">
          Built from public records and the homeowner's brief. Codes and setbacks change, so confirm anything that matters with the city.
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium hover:border-foreground/40"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-sage" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied ? "Copied. Paste it anywhere." : "Copy cheat sheet"}
        </button>
      </div>
    </section>
  );
}
