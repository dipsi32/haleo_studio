// The /house report: a home's public record, read for the person holding it.
// Verdict first, then three vitals, then what to do (each step ready to act
// on), then the record itself and where every fact came from.
// The reading lives in src/lib/houseReport.ts.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ClipboardCopy,
  ExternalLink,
  FileText,
  HelpCircle,
  Home,
  Layers,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  Users,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { houseReport, READERS, shareMessage, smsLink, tidyName, type Reader, type Source, type Step, type Tone, type Vital } from "@/lib/houseReport";
import type { HomeData } from "@/lib/useHomeData";
import { SHARE_TEXT } from "@/lib/houseLookup";
import HouseCard from "@/components/house/HouseCard";
import { CITY_PERMIT_ARCHIVE, HAZARD_MAPS, type RecordState } from "@/lib/homeRecord";

const TONE: Record<Tone | "unknown", { dot: string; chip: string; ring: string }> = {
  clear: { dot: "bg-sage", chip: "border-sage/30 bg-sage/10 text-sage", ring: "from-sage/25" },
  watch: { dot: "bg-amber-500", chip: "border-amber-400/40 bg-amber-50 text-amber-700", ring: "from-amber-300/30" },
  act: { dot: "bg-destructive", chip: "border-destructive/30 bg-destructive/10 text-destructive", ring: "from-destructive/20" },
  unknown: { dot: "bg-muted-foreground/40", chip: "border-border bg-secondary text-muted-foreground", ring: "from-secondary" },
};

const STATE_CHIP: Record<RecordState, string> = {
  finaled: "border-sage/30 bg-sage/10 text-sage",
  in_progress: "border-amber-400/40 bg-amber-50 text-amber-700",
  open: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  unknown: "border-border bg-secondary text-muted-foreground",
};

const SOURCE_CHIP: Record<Source, string> = {
  "Public record": "border-sage/30 bg-sage/10 text-sage",
  "Our read": "border-amber-400/40 bg-amber-50 text-amber-700",
};

const SourceBadge = ({ source }: { source: Source }) => (
  <span className={`ml-2 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide ${SOURCE_CHIP[source]}`}>
    {source}
  </span>
);

const VITAL_ICON = { permits: FileText, ground: Layers, latest: Users } as const;

type Props = {
  street: string;
  zip: string;
  data: HomeData;
  reader: Reader;
  onReader: (r: Reader) => void;
  onProject: () => void;
  onCheck: (name: string) => void;
  onAnother: () => void;
};

/** While the lookups run: each source ticks off as it answers. */
function Reading({ data }: { data: HomeData }) {
  const lines = [
    { label: "Permits on file with the city", done: !!data.parcel || data.settled },
    { label: "Inspector sign-offs", done: data.inspections.length > 0 || data.settled },
    { label: "Fire, flood and earthquake maps", done: !!data.signal || data.settled },
  ];
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      <p className="font-display text-[22px] font-light">Reading the record for you…</p>
      <ul className="mt-5 space-y-3">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center gap-3 text-[15px]">
            {l.done ? (
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-6 w-6 place-items-center rounded-full bg-sage/15 text-sage">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <span className="grid h-6 w-6 place-items-center">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              </span>
            )}
            <span className={l.done ? "text-foreground" : "text-muted-foreground"}>{l.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[13px] text-muted-foreground">The first look at an address can take up to 20 seconds.</p>
    </div>
  );
}

function VitalTile({ v, i }: { v: Vital; i: number }) {
  const Icon = VITAL_ICON[v.id];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + i * 0.08 }}
      className="rounded-2xl border border-border bg-background/70 p-4"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {v.label}
      </p>
      <p className="mt-2 flex items-start gap-2 text-[15px] leading-snug">
        <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${TONE[v.tone].dot}`} />
        <span>{v.value}</span>
      </p>
    </motion.div>
  );
}

function StepCard({ step, n, onRun, done }: { step: Step; n: number; onRun: () => void; done: boolean }) {
  const a = step.action;
  const label = done && a.kind === "copy" ? "Copied" : a.label;
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + n * 0.07 }}
      className="flex gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft sm:gap-4 sm:p-5"
    >
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground font-display text-[13px] text-background sm:h-8 sm:w-8">{n + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[17px] leading-snug sm:text-[18px]">{step.title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{step.why}</p>
        {a.kind === "link" ? (
          <a
            href={a.href}
            target="_blank"
            rel="noreferrer"
            onClick={onRun}
            className="mt-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-border px-4 text-[14px] font-medium transition-smooth hover:bg-secondary"
          >
            {a.label} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={onRun}
            className={`mt-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-smooth ${
              a.kind === "project" ? "bg-foreground text-background hover:opacity-90" : "border border-border hover:bg-secondary"
            }`}
          >
            {a.kind === "copy" && (done ? <Check className="h-4 w-4 text-sage" /> : <ClipboardCopy className="h-4 w-4" />)}
            {a.kind === "check" && <Search className="h-4 w-4" />}
            {label}
            {a.kind === "project" && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>
    </motion.li>
  );
}

export default function HouseReport({ street, zip, data, reader, onReader, onProject, onCheck, onAnother }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const r = useMemo(
    () => houseReport({ street, zip, signal: data.signal, parcel: data.parcel, inspections: data.inspections, reader }),
    [street, zip, data.signal, data.parcel, data.inspections, reader],
  );

  if (!data.settled && !(data.parcel && data.signal)) return <Reading data={data} />;

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2200);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const run = (s: Step) => {
    track("house_action", { step: s.id, reader, tone: r.tone });
    const a = s.action;
    if (a.kind === "copy") void copy(s.id, a.text);
    else if (a.kind === "project") onProject();
    else if (a.kind === "check") onCheck(a.name);
  };

  // The report itself, for a spouse, a client, a buyer's agent. The message
  // carries the results (not just a link), and the link opens this report.
  const reportUrl = `${window.location.origin}/house?${new URLSearchParams({ street, zip, for: reader }).toString()}`;
  const message = shareMessage(r, street, reportUrl);
  // The neighbor gets the tool, never this address.
  const shareTool = async () => {
    const url = `${window.location.origin}/house`;
    track("house_shared", { reader });
    try {
      if (navigator.share) {
        await navigator.share({ text: `${SHARE_TEXT} ${url}` });
        return;
      }
      await copy("tool", `${SHARE_TEXT} ${url}`);
    } catch {
      /* closed the share sheet */
    }
  };

  const rows = showAll ? r.rows : r.rows.slice(0, 4);
  const hasStreet = !!r.street && r.street.total > 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
      {/* 1. The answer, on the card they'll share. Pinned while they read the rest. */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <HouseCard report={r} street={street} zip={zip} message={message} />
      </aside>

      <div className="min-w-0 space-y-6">
        {/* 2. What to do. Who's reading only changes this, so it lives here. */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <h3 className="font-display text-[24px] leading-tight">
              What to do <span className="italic">next</span>
            </h3>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Who's reading">
              {READERS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={reader === x.id}
                  onClick={() => {
                    onReader(x.id);
                    track("house_reader", { reader: x.id });
                  }}
                  className={`min-h-[40px] rounded-full border px-3.5 text-[13.5px] transition-smooth ${
                    reader === x.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <ol className="mt-3 space-y-3">
            {r.steps.map((s, i) => (
              <StepCard key={s.id} step={s} n={i} onRun={() => run(s)} done={copied === s.id} />
            ))}
          </ol>
        </section>

        {/* 3. The details: only what the card can't hold. */}
        <section className="rounded-3xl border border-border bg-card shadow-soft">
          {/* This house */}
          <div className="p-5 md:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[19px]">This house</h3>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {r.rows.length ? `${r.rows.length} permit${r.rows.length === 1 ? "" : "s"} on file` : "City permits"}
              </span>
            </div>
            {r.rows.length === 0 ? (
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {data.parcel?.lookup_succeeded
                  ? "No active, in-progress or expired permits. Finished ones drop out of the city's open records."
                  : "The city's permit records didn't answer just now. Try again in a minute."}
              </p>
            ) : (
              <>
                <ol className="relative mt-4 space-y-4 border-l border-border pl-6">
                  {rows.map((row, i) => (
                    <li key={`${row.permit}-${i}`} className="relative">
                      <span
                        className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-card ${
                          TONE[row.state === "finaled" ? "clear" : row.state === "in_progress" ? "watch" : row.state === "unknown" ? "unknown" : "act"].dot
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-display text-[13px] text-muted-foreground">{row.year ?? "—"}</span>
                        <span className="text-[15px]">{row.what}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${STATE_CHIP[row.state]}`}>{row.stateLabel}</span>
                      </div>
                      <p className="mt-1 text-[13.5px] text-muted-foreground">
                        {row.contractor ? (
                          <button type="button" onClick={() => onCheck(row.contractor!)} className="-my-2 inline-block py-2 text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground">
                            {tidyName(row.contractor)}
                          </button>
                        ) : (
                          "No contractor named"
                        )}
                        {row.signoffs.length > 0 && (
                          <span className="text-sage">
                            {" "}
                            · <Check className="inline h-3.5 w-3.5" strokeWidth={2.5} /> {row.state === "finaled" ? "Signed off" : "Passed so far"}: {row.signoffs.join(", ")}
                            {(row.state === "expired" || row.state === "open") && <span className="text-destructive">, but no final</span>}
                          </span>
                        )}
                        {row.permit && <span className="text-muted-foreground/80"> · {row.permit}</span>}
                      </p>
                    </li>
                  ))}
                </ol>
                {r.rows.length > 4 && (
                  <button type="button" onClick={() => setShowAll((x) => !x)} className="mt-3 text-[13.5px] font-medium underline-offset-4 hover:underline">
                    {showAll ? "Show fewer" : `Show all ${r.rows.length}`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* The street */}
          {hasStreet && (
            <div className="border-t border-border p-5 md:p-7">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-[19px]">
                  On <span className="italic">{r.street!.name}</span>
                </h3>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground" title="Neighbors are shown by block, never by house number">By block</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.street!.kinds.slice(0, 6).map((k) => (
                  <span key={k.kind} className="rounded-full border border-border bg-background px-2.5 py-1 text-[12.5px]">
                    {k.kind} <span className="text-muted-foreground">· {k.count}</span>
                  </span>
                ))}
              </div>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {r.street!.crew.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Who your neighbors hire</p>
                    <ul className="mt-1">
                      {r.street!.crew.slice(0, 4).map((c) => (
                        <li key={c.raw} className="flex items-center justify-between gap-3 text-[14px]">
                          <button type="button" onClick={() => onCheck(c.raw)} className="min-h-[40px] truncate text-left underline underline-offset-4 decoration-border hover:decoration-foreground">
                            {c.name}
                          </button>
                          <span className="shrink-0 text-[12.5px] text-muted-foreground">{c.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest</p>
                  <ul className="mt-2 space-y-1.5">
                    {r.street!.recent.slice(0, 4).map((x, i) => (
                      <li key={i} className="text-[13.5px]">
                        {x.what}
                        <span className="text-muted-foreground">
                          {" "}
                          · {[x.block, x.when].filter(Boolean).join(", ")}
                          {x.done ? " · signed off" : x.expired ? " · expired" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* The ground */}
          <div className="border-t border-border p-5 md:p-7">
            <h3 className="font-display text-[19px]">The ground</h3>
            <ul className="mt-3 space-y-3.5">
              {r.ground.map((g) => (
                <li key={g.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                      g.status === "clear" ? "bg-sage/15 text-sage" : g.status === "zone" ? "bg-amber-50 text-amber-700" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {g.status === "clear" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : g.status === "zone" ? "!" : "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14.5px]">
                      <span className="text-muted-foreground">{g.map}:</span> {g.title}
                    </p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">
                      {g.meaning}{" "}
                      <a href={g.href} target="_blank" rel="noreferrer" className="-my-2 inline-block whitespace-nowrap py-2 text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground">
                        {g.source} map <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="border-t border-border px-6 py-4 text-[12px] leading-relaxed text-muted-foreground md:px-7">
            {data.parcel?.apn ? `Assessor's parcel ${data.parcel.apn}. ` : ""}From the City of San José's permit and inspection records, CAL FIRE, FEMA and the
            California Geological Survey. Haleo reads public records; it doesn't inspect homes.
          </p>
        </section>

        {/* 4. The loops: the next house, and the neighbor. */}
        <section className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onAnother}
            className="flex items-center gap-3 rounded-3xl border border-accent/30 bg-accent-soft/60 p-4 text-left transition-smooth hover:-translate-y-0.5 hover:shadow-soft"
          >
            <Home className="h-5 w-5 shrink-0 text-accent" />
            <span>
              <span className="block text-[15px] font-medium">Touring a house this weekend?</span>
              <span className="block text-[13px] text-muted-foreground">Look it up before you fall for it.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={shareTool}
            className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
          >
            {copied === "tool" ? <Check className="h-5 w-5 shrink-0 text-sage" /> : <Share2 className="h-5 w-5 shrink-0" />}
            <span>
              <span className="block text-[15px] font-medium">{copied === "tool" ? "Link copied" : "Know a neighbor who'd want this?"}</span>
              <span className="block text-[13px] text-muted-foreground">Send them the lookup, never your address.</span>
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
