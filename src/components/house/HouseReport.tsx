// The /house report: a home's public record, read for the person holding it.
// Verdict first, then three vitals, then what to do (each step ready to act
// on), then the record itself and where every fact came from.
// The reading lives in src/lib/houseReport.ts.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  FileText,
  Home,
  Layers,
  Loader2,
  Share2,
  Sparkles,
  Download,
  Users,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/copyText";
import { houseReport, shareMessage, type HouseReport as HouseReportModel, type Reader, streetLine } from "@/lib/houseReport";
import type { HomeData } from "@/lib/useHomeData";
import { SHARE_TEXT } from "@/lib/houseLookup";
import HouseCard from "@/components/house/HouseCard";
import HouseWrapped from "@/components/house/HouseWrapped";
import BirthCertificate from "@/components/house/BirthCertificate";
import CertificateGate from "@/components/house/CertificateGate";
import DetailSheet from "@/components/house/DetailSheet";
import { useAuth } from "@/context/AuthContext";
import { certificateEntries, fromRow, houseStory } from "@/lib/houseStory";
import type { HouseJob } from "@/components/house/ContractorJump";
import { certificateUrl } from "@/lib/houseLookup";
import { AreaDrilldown, JobInMind, PermitList, type JobStart } from "@/components/house/HouseDetails";
import { useContractorJump } from "@/components/house/ContractorJump";
import { streetOf } from "@/lib/areaContractors";


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

export default function HouseReport({ street, zip, data, reader, onProject, onAnother, autoWrap }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const { user } = useAuth();
  // Signed in for real (not a guest session): the certificate and its story are theirs.
  const member = !!user && !user.is_anonymous;
  const [wrapWanted, setWrapOpen] = useState(!!autoWrap);
  const wrapOpen = wrapWanted && member;
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const r = useMemo(
    () => houseReport({ street, zip, signal: data.signal, parcel: data.parcel, inspections: data.inspections, reader }),
    [street, zip, data.signal, data.parcel, data.inspections, reader],
  );
  const entries = useMemo(() => certificateEntries(r.rows), [r.rows]);
  const story = useMemo(
    () => houseStory(r.rows.map(fromRow), r.rows.filter((x) => x.state === "expired" || x.state === "open").length),
    [r.rows],
  );
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/house?ref=certificate`, { margin: 0, width: 160, color: { dark: "#2a2620", light: "#fdfaf3" } })
      .then(setQr)
      .catch(() => undefined);
  }, []);
  // They came back signed in from the unlock: count it once.
  useEffect(() => {
    if (!member) return;
    try {
      const from = sessionStorage.getItem("haleo:unlock");
      if (from) {
        sessionStorage.removeItem("haleo:unlock");
        track("house_unlocked", { reason: from });
      }
    } catch {
      /* fine */
    }
  }, [member]);
  const openSheet = (s: Sheet) => {
    setSheet(s);
    track("house_sheet_opened", { which: s.kind });
  };

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


  const prop = data.city?.property ?? null;
  const lot = prop?.facts.find((f) => /lot size/i.test(f.label))?.value ?? null;
  const docs = r.rows.reduce((n, x) => n + x.docs.length, 0);
  const toContractor = (name: string, id?: string, job?: HouseJob) => {
    setSheet(null);
    setTimeout(() => jump.open(name, id, job), 200);
  };

  const certificate = (
    <BirthCertificate
      street={street}
      zip={zip}
      entries={entries}
      story={story}
      apn={prop?.apn ?? data.parcel?.apn ?? null}
      zoning={prop?.zoning ?? null}
      lot={lot}
      qr={qr}
      origin={window.location.origin}
      locked={!member}
      onEntry={(row) => openSheet({ kind: "permits", focus: row })}
      onFacts={() => openSheet({ kind: "permits" })}
      onLot={() => openSheet({ kind: "lot" })}
      onStory={() => setWrapOpen(true)}
    />
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
      {jump.element}
      {/* The free card: the answer at a glance, shareable by anyone. */}
      <aside className={`min-w-0 lg:sticky lg:top-24 lg:self-start ${member ? "order-2 lg:order-1" : ""}`}>
        <HouseCard report={r} street={street} zip={zip} message={message} />
      </aside>

      <div className={`min-w-0 space-y-6 ${member ? "order-1 lg:order-2" : ""}`}>
        {member ? (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Its Birth Certificate</p>
                <p className="mt-1 text-[14px] text-muted-foreground">Tap any line to open that chapter.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWrapOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-medium text-background transition-smooth hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" /> Play its story
                </button>
                <a
                  href={certificateUrl(street, zip)}
                  onClick={() => track("house_certificate_opened", { permits: entries.length })}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[14px] font-medium transition-smooth hover:bg-secondary"
                >
                  <Download className="h-4 w-4" /> PDF
                </a>
              </div>
            </div>
            {certificate}
            {/* The chapters behind the certificate, one tap each. */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { kind: "permits" as const, icon: FileText, label: "Every permit", sub: `${entries.length}${docs ? ` · ${docs} docs` : ""}` },
                { kind: "lot" as const, icon: Layers, label: "Lot & ground", sub: "Zoning, flood, fire, quake" },
                { kind: "around" as const, icon: Users, label: "Around you", sub: r.street?.name ?? "Your street" },
              ].map((c) => (
                <button
                  key={c.kind}
                  type="button"
                  onClick={() => openSheet({ kind: c.kind })}
                  className="flex min-h-[72px] flex-col items-start justify-center gap-0.5 rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition-smooth hover:-translate-y-0.5"
                >
                  <c.icon className="h-4 w-4 text-accent" />
                  <span className="text-[13.5px] font-medium leading-tight">{c.label}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">{c.sub}</span>
                </button>
              ))}
            </div>
          </motion.section>
        ) : (
          <section className="relative">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Its Birth Certificate</p>
            <div className="relative">
              <div className="max-h-[720px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">{certificate}</div>
              <div className="relative z-10 -mt-48 px-1 sm:-mt-56">
                <CertificateGate street={street} story={story} reason={autoWrap ? "story" : "certificate"} />
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <JobInMind zip={zip} onJob={onProject} />
        </section>

        {/* The loops: the next house, and the neighbor. */}
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

      <AnimatePresence>
        {wrapOpen && (
          <HouseWrapped
            report={r}
            street={street}
            zip={zip}
            onClose={() => setWrapOpen(false)}
            onLooseEnds={() => {
              setWrapOpen(false);
              const first = r.rows.findIndex((x) => x.state === "expired" || x.state === "open");
              setTimeout(() => openSheet({ kind: "permits", focus: first >= 0 ? first : undefined }), 250);
            }}
          />
        )}
      </AnimatePresence>

      {/* The chapters: sheets that slide up (phone) or in (computer). */}
      <DetailSheet
        open={sheet?.kind === "permits"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={
          <>
            Every permit <span className="italic">on file</span>
          </>
        }
        sub={`${entries.length} permit${entries.length === 1 ? "" : "s"}${docs ? ` and ${docs} documents` : ""} from the City of San José. Open one for what to do, who did it, and the city's own scans.`}
      >
        {sheet?.kind === "permits" && (
          <PermitList bare rows={r.rows} read={!!data.parcel?.lookup_succeeded} focus={sheet.focus ?? null} onContractor={(name, job) => toContractor(name, undefined, job)} />
        )}
      </DetailSheet>
      <DetailSheet
        open={sheet?.kind === "lot"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={
          <>
            The lot <span className="italic">and the ground</span>
          </>
        }
        sub="Zoning, soil and groundwater from the city, and the fire, flood and earthquake maps."
      >
        <LotDetail data={data} ground={r.ground} />
      </DetailSheet>
      <DetailSheet
        open={sheet?.kind === "around"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={
          <>
            Around <span className="italic">you</span>
          </>
        }
        sub={`Your street, and every contractor working in ${zip}.`}
      >
        <AroundDetail r={r} zip={zip} street={street} onContractor={toContractor} />
      </DetailSheet>
    </div>
  );
}

type Sheet = { kind: "permits"; focus?: number } | { kind: "lot" } | { kind: "around" };

function LotDetail({ data, ground }: { data: HomeData; ground: HouseReportModel["ground"] }) {
  return (
    <div className="space-y-5">
      {data.city?.property && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
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
      <div className={data.city?.property ? "border-t border-border pt-4" : ""}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">The ground</p>
        <ul className="mt-3 space-y-3.5">
          {ground.map((g) => (
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
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        From the City of San José's permit and inspection records, CAL FIRE, FEMA and the California Geological Survey. Haleo reads public records; it doesn't
        inspect homes.
      </p>
    </div>
  );
}

function AroundDetail({ r, zip, street, onContractor }: { r: HouseReportModel; zip: string; street: string; onContractor: (name: string, id?: string) => void }) {
  const s = r.street;
  return (
    <div className="-mx-1 space-y-2">
      {s && s.total > 0 && (
        <div className="px-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[19px]">
              On <span className="italic">{s.name}</span>
            </h3>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground" title="Neighbors are shown by block, never by house number">
              By block
            </span>
          </div>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-foreground/80">{streetLine(s)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.kinds.slice(0, 6).map((k) => (
              <span key={k.kind} className="rounded-full border border-border bg-background px-2.5 py-1 text-[12.5px]">
                {k.kind} <span className="text-muted-foreground">· {k.count}</span>
              </span>
            ))}
          </div>
          {s.crew.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Who your neighbors hire</p>
              <ul className="mt-1">
                {s.crew.slice(0, 4).map((c) => (
                  <li key={c.raw} className="flex items-center justify-between gap-3 text-[14px]">
                    <button type="button" onClick={() => onContractor(c.raw)} className="min-h-[40px] truncate text-left underline underline-offset-4 decoration-border hover:decoration-foreground">
                      {c.name}
                    </button>
                    <span className="shrink-0 text-[12.5px] text-muted-foreground">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="[&>div]:px-1">
        <AreaDrilldown zip={zip} street={s?.name ?? streetOf(street)} onContractor={(name, id) => onContractor(name, id)} />
      </div>
    </div>
  );
}
