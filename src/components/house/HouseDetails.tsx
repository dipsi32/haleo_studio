// The drill-downs under a home's card, from the house outward:
//   PermitList     every permit on the house; tap one for its full detail and
//                  the city's own file (documents, plans, inspections)
//   CrewOnHouse    each contractor who worked on this house, with their wider
//                  San José record
//   AreaDrilldown  everyone working in the ZIP: what they do and the streets
//                  they've worked on (never house numbers)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, FileText, Loader2, MapPin, Users } from "lucide-react";
import { track } from "@/lib/analytics";
import { CITY_PERMIT_SEARCH, type RecordRow, type RecordState } from "@/lib/homeRecord";
import { tidyName } from "@/lib/houseReport";
import { onStreet } from "@/lib/areaContractors";
import { useAreaContractors } from "@/lib/useAreaData";
import { primaryDoc } from "@/lib/cityRecord";
import { copyText } from "@/lib/copyText";
import type { ProjectGoal, Room } from "@/lib/intake";
import type { HouseJob } from "./ContractorJump";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : null);
const month = (iso: string | null) => (iso && /^\d{4}-\d{2}/.test(iso) ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : null);

const DOT: Record<RecordState, string> = {
  finaled: "bg-sage",
  in_progress: "bg-amber-500",
  open: "bg-destructive",
  expired: "bg-destructive",
  cancelled: "bg-muted-foreground/30",
  unknown: "bg-muted-foreground/40",
};
const CHIP: Record<RecordState, string> = {
  finaled: "border-sage/30 bg-sage/10 text-sage",
  in_progress: "border-amber-400/40 bg-amber-50 text-amber-700",
  open: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-secondary text-muted-foreground",
  unknown: "border-border bg-secondary text-muted-foreground",
};

const sectionTitle = "font-display text-[19px] leading-tight";
const kicker = "text-[11px] uppercase tracking-wide text-muted-foreground";

/** What to do about this one permit, in a sentence. */
const actionFor = (row: RecordRow): { text: string; tone: "act" | "watch" | "done" | "quiet" } => {
  const by = row.contractor ? tidyName(row.contractor) : null;
  switch (row.state) {
    case "expired":
    case "open":
      return {
        text: `Before you buy or remodel, get this one finaled: call the city's permit center to reopen it for a final inspection${by ? `, or ask ${by} to` : ""}. Unfinished permits follow the house.`,
        tone: "act",
      };
    case "in_progress":
      return { text: `Open with the city. Make sure ${by ? `${by} books` : "someone books"} the final inspection when the work is done.`, tone: "watch" };
    case "finaled":
      return { text: "Signed off by the city. Keep the final record with your papers: it's what a buyer's inspector asks for.", tone: "done" };
    case "cancelled":
      return { text: "No work was authorized under this one.", tone: "quiet" };
    default:
      return { text: "The city's record doesn't show a final. Worth asking the city before you buy or build.", tone: "watch" };
  }
};

const ACTION_TONE = {
  act: "border-destructive/25 bg-destructive/5",
  watch: "border-amber-400/40 bg-amber-50/60",
  done: "border-sage/30 bg-sage/5",
  quiet: "border-border bg-secondary/40",
} as const;

/**
 * Every permit on the house, newest first. Each one carries who did it, what
 * to do about it, and the city's own documents, one tap away.
 */
export function PermitList({
  rows,
  read,
  onContractor,
  focus,
  bare,
}: {
  rows: RecordRow[];
  read: boolean;
  onContractor: (name: string, job?: HouseJob) => void;
  /** Open this permit (its index in `rows`), e.g. tapped on the Birth Certificate. */
  focus?: number | null;
  /** Inside a sheet: no card frame or heading of its own. */
  bare?: boolean;
}) {
  const real = rows.filter((r) => r.state !== "cancelled");
  const cancelled = rows.length - real.length;
  const focusRow = focus != null ? rows[focus] : undefined;
  // A permit asked for that isn't in the first eight (or was cancelled): show them all.
  const [showAll, setShowAll] = useState(() => !!focusRow && (focusRow.state === "cancelled" || real.indexOf(focusRow) >= 8));
  const shown = showAll ? rows : real.slice(0, 8);
  const [open, setOpen] = useState<number | null>(() => {
    // The permit they tapped; otherwise the one that needs action, so the answer is already on screen.
    const i = focusRow ? shown.indexOf(focusRow) : shown.findIndex((r) => r.state === "expired" || r.state === "open");
    return i >= 0 ? i : null;
  });
  const [copied, setCopied] = useState<string | null>(null);
  const docs = rows.reduce((n, r) => n + r.docs.length, 0);

  const copy = (permit: string) => {
    copyText(permit);
    setCopied(permit);
    track("house_permit_copied", {});
    setTimeout(() => setCopied((c) => (c === permit ? null : c)), 3000);
  };

  return (
    <section className={bare ? "" : "rounded-3xl border border-border bg-card shadow-soft"}>
      <div className={bare ? "" : "p-5 md:p-7"}>
        <div className={`flex items-baseline justify-between gap-3 ${bare ? "hidden" : ""}`}>
          <h3 className="font-display text-[22px] leading-tight">
            Every permit <span className="italic">on file</span>
          </h3>
          <span className={kicker}>
            {rows.length ? `${real.length} permit${real.length === 1 ? "" : "s"}${docs ? ` · ${docs} documents` : ""}` : "City records"}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {read ? "No permits on file with the city for this address." : "The city's permit records didn't answer just now. Try again in a minute."}{" "}
            <a href={CITY_PERMIT_SEARCH} target="_blank" rel="noreferrer" className="whitespace-nowrap font-medium text-foreground underline underline-offset-4">
              Search the city's records <ExternalLink className="inline h-3 w-3" />
            </a>
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {shown.map((row, i) => {
              const isOpen = open === i;
              const action = actionFor(row);
              const first = primaryDoc(row.docs);
              return (
                <li key={`${row.permit}-${i}`}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpen(isOpen ? null : i);
                      if (!isOpen) track("house_permit_opened", { state: row.state, docs: row.docs.length });
                    }}
                    className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[row.state]}`} />
                    <span className="w-10 shrink-0 font-display text-[14px] text-muted-foreground">{row.year ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] ${row.state === "cancelled" ? "text-muted-foreground" : ""}`}>{row.what}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {row.stateLabel}
                        {row.contractor ? ` · ${tidyName(row.contractor)}` : ""}
                        {row.docs.length ? ` · ${row.docs.length} doc${row.docs.length === 1 ? "" : "s"}` : ""}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mb-4 space-y-3">
                          {/* What to do about it */}
                          <p className={`rounded-2xl border px-4 py-3 text-[14px] leading-relaxed ${ACTION_TONE[action.tone]}`}>{action.text}</p>

                          {/* The documents: the city's own scans, one tap each */}
                          {row.docs.length > 0 ? (
                            <div className="rounded-2xl bg-secondary/50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                {first && (
                                  <a
                                    href={first.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => track("house_permit_file", { kind: first.kind })}
                                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-medium text-background transition-smooth hover:opacity-90"
                                  >
                                    <FileText className="h-4 w-4" /> Open the {/plans/i.test(first.kind) ? "plans" : /inspection/i.test(first.kind) ? "inspection notice" : "permit"}
                                  </a>
                                )}
                                {row.permit && (
                                  <button
                                    type="button"
                                    onClick={() => copy(row.permit!)}
                                    aria-label={`Copy permit number ${row.permit}`}
                                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13.5px] transition-smooth hover:bg-secondary"
                                  >
                                    {copied === row.permit ? <Check className="h-4 w-4 text-sage" /> : <Copy className="h-4 w-4" />}
                                    {copied === row.permit ? "Copied" : row.permit}
                                  </button>
                                )}
                              </div>
                              <ul className="mt-3 divide-y divide-border/70">
                                {row.docs.slice(0, 8).map((d) => (
                                  <li key={d.id}>
                                    <a
                                      href={d.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={() => track("house_permit_file", { kind: d.kind })}
                                      className="flex min-h-[44px] items-center justify-between gap-3 text-[13.5px] hover:underline"
                                    >
                                      <span className="min-w-0 truncate">{d.kind}</span>
                                      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                                        {day(d.date)} <ExternalLink className="h-3.5 w-3.5" />
                                      </span>
                                    </a>
                                  </li>
                                ))}
                              </ul>
                              {row.docs.length > 8 && <p className="mt-1 text-[12px] text-muted-foreground">+ {row.docs.length - 8} more in the city's file</p>}
                            </div>
                          ) : (
                            row.permit && (
                              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                                No scanned documents for this one.
                                <button
                                  type="button"
                                  onClick={() => copy(row.permit!)}
                                  aria-label={`Copy permit number ${row.permit}`}
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border px-3 text-[13px] text-foreground hover:bg-secondary"
                                >
                                  {copied === row.permit ? <Check className="h-3.5 w-3.5 text-sage" /> : <Copy className="h-3.5 w-3.5" />}
                                  {copied === row.permit ? "Copied" : row.permit}
                                </button>
                              </div>
                            )
                          )}

                          {/* Who did it */}
                          {row.contractors.length > 0 && (
                            <div className="space-y-2">
                              {row.contractors.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => onContractor(c, { what: row.what, year: row.year, state: row.stateLabel })}
                                  className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-3.5 text-left transition-smooth hover:border-foreground/30"
                                >
                                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                                    <Users className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[12px] text-muted-foreground">Done by</span>
                                    <span className="block truncate text-[15px] font-medium">{tidyName(c)}</span>
                                  </span>
                                  <span className="shrink-0 text-[13px] font-medium text-accent">
                                    Their record <ArrowRight className="inline h-3.5 w-3.5 transition-smooth group-hover:translate-x-0.5" />
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* The permit's own words and dates */}
                          {row.detail.description && <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted-foreground">{row.detail.description}</p>}
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
                            {row.detail.applied && (
                              <div>
                                <dt className="text-muted-foreground">Applied</dt>
                                <dd>{day(row.detail.applied)}</dd>
                              </div>
                            )}
                            {row.detail.issued && (
                              <div>
                                <dt className="text-muted-foreground">Issued</dt>
                                <dd>{day(row.detail.issued)}</dd>
                              </div>
                            )}
                            {row.state !== "cancelled" && (
                              <div>
                                <dt className="text-muted-foreground">Final inspection</dt>
                                <dd className={row.detail.finaled ? "" : row.state === "in_progress" ? "text-amber-700" : "text-destructive"}>
                                  {row.detail.finaled ? day(row.detail.finaled) : row.state === "in_progress" ? "Not yet" : "Never"}
                                </dd>
                              </div>
                            )}
                            {row.detail.type && (
                              <div className="col-span-2">
                                <dt className="text-muted-foreground">Type</dt>
                                <dd>{row.detail.type}</dd>
                              </div>
                            )}
                          </dl>
                          {row.detail.inspections.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5">
                              {row.detail.inspections.map((x) => (
                                <li
                                  key={x.label}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] ${
                                    x.status === "complete" ? "border-sage/30 bg-sage/10 text-sage" : "border-border bg-card text-muted-foreground"
                                  }`}
                                >
                                  {x.status === "complete" && <Check className="h-3 w-3" strokeWidth={2.5} />} {x.label}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
        )}
        {(real.length > 8 || cancelled > 0) && (
          <button type="button" onClick={() => setShowAll((x) => !x)} className="mt-2 min-h-[40px] text-[13.5px] font-medium underline-offset-4 hover:underline">
            {showAll ? "Show fewer" : `Show all ${rows.length}${cancelled ? `, with ${cancelled} cancelled or never issued` : ""}`}
          </button>
        )}
      </div>
    </section>
  );
}

/** Everyone working in the ZIP, loaded when they ask: what they do and the streets they've worked on. */
export function AreaDrilldown({ zip, street, onContractor }: { zip: string; street: string | null; onContractor: (name: string, id?: string) => void }) {
  const [asked, setAsked] = useState(false);
  const [all, setAll] = useState(false);
  const area = useAreaContractors(zip, asked);
  // Whoever has worked on their own street comes first: the most relevant to them.
  const ranked = [...area.crews].sort((a, b) => Number(onStreet(b, street)) - Number(onStreet(a, street)));
  const crews = all ? ranked : ranked.slice(0, 8);

  return (
    <div className="border-t border-border p-5 md:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={sectionTitle}>
          Working in <span className="italic">{zip}</span>
        </h3>
        <span className={kicker} title="Where they've worked, by street, never by house number">By street</span>
      </div>
      {!asked ? (
        <button
          type="button"
          onClick={() => {
            setAsked(true);
            track("house_area_opened", { zip });
          }}
          className="mt-3 flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left transition-smooth hover:border-foreground/30"
        >
          <span>
            <span className="block text-[15px] font-medium">See every contractor working near you</span>
            <span className="block text-[12.5px] text-muted-foreground">What they do, and the streets they've worked on</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      ) : area.status === "loading" || area.status === "idle" ? (
        <p className="mt-3 flex items-start gap-2 text-[14px] text-muted-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" />
          <span>Reading every permit in {zip} from the city. The first look at a ZIP can take a couple of minutes; after that it's instant.</span>
        </p>
      ) : area.status === "failed" || !area.crews.length ? (
        <p className="mt-3 text-[14px] text-muted-foreground">We couldn't read {zip}'s permits just now. Try again in a minute.</p>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            {area.crews.length} contractors across {area.permits} permits in {zip}, most active first.
          </p>
          {area.status === "growing" && (
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Reading the rest of {zip} from the city. This list fills in when it lands.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {crews.map((c) => {
              const mine = onStreet(c, street);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      track("house_area_crew_opened", { on_street: mine });
                      onContractor(c.name, c.id);
                    }}
                    className="group w-full rounded-2xl border border-border bg-background p-3.5 text-left transition-smooth hover:border-foreground/30"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[15px] font-medium">{c.name}</span>
                      <span className="shrink-0 text-[12.5px] text-muted-foreground">
                        {c.count} permit{c.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    {c.kinds.length > 0 && <span className="mt-0.5 block text-[13px]">{c.kinds.slice(0, 3).join(" · ")}</span>}
                    <span className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {mine && <span className="mr-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-soft-foreground">Your street</span>}
                        {c.streets
                          .slice(0, 3)
                          .map((s) => s.name)
                          .join(", ")}
                        {c.streets.length > 3 ? ` +${c.streets.length - 3} more` : ""}
                        {c.latest ? ` · latest ${month(c.latest)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {area.crews.length > 8 && (
            <button type="button" onClick={() => setAll((x) => !x)} className="mt-2 min-h-[40px] text-[13.5px] font-medium underline-offset-4 hover:underline">
              {all ? "Show fewer" : `Show all ${area.crews.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** The jobs people come in with, as one-tap starts. Each opens the brief with the job already picked. */
export type JobStart = { label: string; rooms?: Room[]; goals?: ProjectGoal[] };
const JOB_STARTS: JobStart[] = [
  { label: "Kitchen", rooms: ["kitchen"] },
  { label: "Bathroom", rooms: ["bathroom"] },
  { label: "ADU or addition", goals: ["adu-addition"] },
  { label: "Garage conversion", goals: ["garage-conversion"] },
  { label: "Roof", goals: ["roof"] },
  { label: "Something else" },
];

/** "Have a job in mind?": from the contractors around them to the ones who've done their kind of job. */
export function JobInMind({ zip, onJob }: { zip: string; onJob: (job: JobStart) => void }) {
  return (
    <div className="border-t border-border p-5 md:p-7">
      <h3 className={sectionTitle}>
        Have a job <span className="italic">in mind?</span>
      </h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
        Pick it and we'll show you who's done that kind of work near {zip}, from the city's records. Your address is already in, and when you ask contractors, this house's history goes with it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {JOB_STARTS.map((j) => (
          <button
            key={j.label}
            type="button"
            onClick={() => {
              track("house_job_started", { job: j.label });
              onJob(j);
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-background px-4 text-[14px] transition-smooth hover:border-foreground/40"
          >
            {j.label}
            {j.label === "Something else" && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        ))}
      </div>
    </div>
  );
}
