// The /house report: a home's public record, read for the person holding it.
// Verdict first, then three vitals, then what to do (each step ready to act
// on), then the record itself and where every fact came from.
// The reading lives in src/lib/houseReport.ts.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
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
  Sparkles,
  ScrollText,
  Users,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/copyText";
import { houseReport, shareMessage, tidyName, type Reader, type Source, type Tone, type Vital, streetLine } from "@/lib/houseReport";
import type { HomeData } from "@/lib/useHomeData";
import { SHARE_TEXT } from "@/lib/houseLookup";
import HouseCard from "@/components/house/HouseCard";
import HouseWrapped from "@/components/house/HouseWrapped";
import { certificateUrl } from "@/lib/houseLookup";
import { AreaDrilldown, JobInMind, PermitList, type JobStart } from "@/components/house/HouseDetails";
import { useContractorJump } from "@/components/house/ContractorJump";
import { streetOf } from "@/lib/areaContractors";
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
  cancelled: "border-border bg-secondary text-muted-foreground",
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
  onProject: (job?: JobStart) => void;
  onCheck: (name: string) => void;
  onAnother: () => void;
  /** Arrived from /wrapped: play the house's story as soon as it's read. */
  autoWrap?: boolean;
};

/** While the lookups run: each source ticks off as it answers. */
function Reading({ data }: { data: HomeData }) {
  const lines = [
    { label: "Every permit and document on file with the city", done: data.cityDone },
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


/** A drill-down: closed until asked, so the permits stay the main event. */
function Drill({ title, sub, id, children }: { title: string; sub: string; id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl border border-border bg-card shadow-soft">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) track("house_drill_opened", { section: id });
        }}
        className="flex min-h-[64px] w-full items-center justify-between gap-3 px-5 py-4 text-left md:px-7"
      >
        <span className="min-w-0">
          <span className="block font-display text-[19px] leading-tight">{title}</span>
          <span className="block text-[13px] text-muted-foreground">{sub}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border px-5 pb-6 pt-5 md:px-7">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function HouseReport({ street, zip, data, reader, onReader, onProject, onCheck, onAnother, autoWrap }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [wrapOpen, setWrapOpen] = useState(!!autoWrap);
  const [showAll, setShowAll] = useState(false);
  const r = useMemo(
    () => houseReport({ street, zip, signal: data.signal, parcel: data.parcel, inspections: data.inspections, reader }),
    [street, zip, data.signal, data.parcel, data.inspections, reader],
  );

  const jump = useContractorJump({ from: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/house", zip, street: r.street?.name ?? streetOf(street) });
  if (!data.settled && !(data.parcel && data.signal && data.cityDone)) return <Reading data={data} />;

  const copy = (id: string, text: string) => {
    if (!copyText(text)) return;
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2200);
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
      copy("tool", `${SHARE_TEXT} ${url}`);
    } catch {
      /* closed the share sheet */
    }
  };

  const rows = showAll ? r.rows : r.rows.slice(0, 4);
  const hasStreet = !!r.street && r.street.total > 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
      {jump.element}
      {/* 1. The answer, on the card they'll share. Pinned while they read the rest. */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <HouseCard report={r} street={street} zip={zip} message={message} />
        {/* The house's story, two ways: one to post, one to frame. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWrapOpen(true)}
            className="group flex flex-col items-start gap-1 rounded-2xl border border-border bg-gradient-to-br from-[#f6b452]/25 via-card to-card p-3.5 text-left shadow-soft transition-smooth hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-[14px] font-medium leading-tight">Your house, wrapped</span>
            <span className="text-[12px] leading-snug text-muted-foreground">Its story in 30 seconds, made to post</span>
          </button>
          <a
            href={certificateUrl(street, zip)}
            onClick={() => track("house_certificate_opened", { permits: r.rows.length })}
            className="group flex flex-col items-start gap-1 rounded-2xl border border-border bg-card p-3.5 text-left shadow-soft transition-smooth hover:-translate-y-0.5"
          >
            <ScrollText className="h-4 w-4 text-accent" />
            <span className="text-[14px] font-medium leading-tight">Birth certificate</span>
            <span className="text-[12px] leading-snug text-muted-foreground">Its full history on one page, to print and frame</span>
          </a>
        </div>
      </aside>
      <AnimatePresence>
        {wrapOpen && (
          <HouseWrapped
            report={r}
            street={street}
            zip={zip}
            onClose={() => setWrapOpen(false)}
            onLooseEnds={() => {
              setWrapOpen(false);
              setTimeout(() => document.getElementById("permits")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
            }}
          />
        )}
      </AnimatePresence>

      <div className="min-w-0 space-y-5">
        {/* 2. The house's whole story: every permit, who did it, what to do, the city's documents. */}
        <div id="permits" className="scroll-mt-24">
        <PermitList rows={r.rows} read={!!data.parcel?.lookup_succeeded} onContractor={(name, job) => jump.open(name, undefined, job)} />
        </div>

        {/* 3. Drill-downs: the lot, then the neighborhood. */}
        <Drill title="Your lot and the ground" sub="Zoning, soil, groundwater, and the fire, flood and earthquake maps" id="lot">
          {data.city?.property && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px] sm:grid-cols-3">
              {data.city.property.zoning && (
                <div>
                  <dt className="text-muted-foreground">Zoning</dt>
                  <dd>{data.city.property.zoning}</dd>
                </div>
              )}
              {data.city.property.facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              {data.city.property.apn && (
                <div>
                  <dt className="text-muted-foreground">Parcel (APN)</dt>
                  <dd>{data.city.property.apn}</dd>
                </div>
              )}
            </dl>
          )}
          {/* The ground */}
          <div className="border-t border-border pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">The ground</p>
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

          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            {data.parcel?.apn ? `Assessor's parcel ${data.parcel.apn}. ` : ""}From the City of San José's permit and inspection records, CAL FIRE, FEMA and the
            California Geological Survey. Haleo reads public records; it doesn't inspect homes.
          </p>
        </Drill>

        <Drill title="Around you" sub={`Your street, and every contractor working in ${zip}`} id="around">
          {/* The street */}
          {hasStreet && (
            <div className="">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-[19px]">
                  On <span className="italic">{r.street!.name}</span>
                </h3>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground" title="Neighbors are shown by block, never by house number">By block</span>
              </div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-foreground/80">{streetLine(r.street!)}</p>
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
                          <button type="button" onClick={() => jump.open(c.raw)} className="min-h-[40px] truncate text-left underline underline-offset-4 decoration-border hover:decoration-foreground">
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

          <AreaDrilldown zip={zip} street={r.street?.name ?? streetOf(street)} onContractor={(name, id) => jump.open(name, id)} />
          <JobInMind zip={zip} onJob={onProject} />
        </Drill>

        {/* 5. The loops: the next house, and the neighbor. */}
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
