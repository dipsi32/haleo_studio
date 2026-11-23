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
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, Loader2, MapPin, Users } from "lucide-react";
import { track } from "@/lib/analytics";
import { CITY_PERMIT_SEARCH, type RecordRow, type RecordState } from "@/lib/homeRecord";
import { tidyName } from "@/lib/houseReport";
import { onStreet } from "@/lib/areaContractors";
import { useAreaContractors, useCrewRecords } from "@/lib/useAreaData";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : null);
const month = (iso: string | null) => (iso && /^\d{4}-\d{2}/.test(iso) ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : null);

const DOT: Record<RecordState, string> = {
  finaled: "bg-sage",
  in_progress: "bg-amber-500",
  open: "bg-destructive",
  expired: "bg-destructive",
  unknown: "bg-muted-foreground/40",
};
const CHIP: Record<RecordState, string> = {
  finaled: "border-sage/30 bg-sage/10 text-sage",
  in_progress: "border-amber-400/40 bg-amber-50 text-amber-700",
  open: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  unknown: "border-border bg-secondary text-muted-foreground",
};

const sectionTitle = "font-display text-[19px] leading-tight";
const kicker = "text-[11px] uppercase tracking-wide text-muted-foreground";

/** Every permit on the house. One tap opens its detail; one more opens the city's file. */
export function PermitList({ rows, read, onCheck }: { rows: RecordRow[]; read: boolean; onCheck: (name: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, 6);

  // The city's search opens records from a permit number, not a link: hand it over, then open the search.
  const openFile = async (permit: string) => {
    track("house_permit_file", { permit });
    try {
      await navigator.clipboard.writeText(permit);
      setCopied(permit);
      setTimeout(() => setCopied((c) => (c === permit ? null : c)), 6000);
    } catch {
      /* clipboard blocked: the number is on screen to copy */
    }
    window.open(CITY_PERMIT_SEARCH, "_blank", "noopener");
  };

  return (
    <div className="p-5 md:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={sectionTitle}>Permit history</h3>
        <span className={kicker}>{rows.length ? `${rows.length} on file` : "City records"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {read
            ? "No active, in-progress or expired permits on file. Permits finished in the last few weeks may not show yet; the city's own search has every one."
            : "The city's permit records didn't answer just now. Try again in a minute."}{" "}
          <a href={CITY_PERMIT_SEARCH} target="_blank" rel="noreferrer" className="whitespace-nowrap font-medium text-foreground underline underline-offset-4">
            Search the city's records <ExternalLink className="inline h-3 w-3" />
          </a>
        </p>
      ) : (
        <>
          <ol className="mt-3 divide-y divide-border">
            {shown.map((row, i) => {
              const isOpen = open === i;
              return (
                <li key={`${row.permit}-${i}`}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpen(isOpen ? null : i);
                      if (!isOpen) track("house_permit_opened", { state: row.state });
                    }}
                    className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[row.state]}`} />
                    <span className="w-10 shrink-0 font-display text-[14px] text-muted-foreground">{row.year ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{row.what}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{row.contractor ? tidyName(row.contractor) : "No contractor named"}</span>
                    </span>
                    <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide sm:inline ${CHIP[row.state]}`}>
                      {row.stateLabel}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mb-4 rounded-2xl bg-secondary/50 p-4 text-[14px]">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide sm:hidden ${CHIP[row.state]}`}>{row.stateLabel}</span>
                          {row.detail.description && <p className="mt-2 leading-relaxed sm:mt-0">{row.detail.description}</p>}
                          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                            {row.detail.issued && (
                              <div>
                                <dt className="text-muted-foreground">Issued</dt>
                                <dd>{day(row.detail.issued)}</dd>
                              </div>
                            )}
                            <div>
                              <dt className="text-muted-foreground">Final inspection</dt>
                              <dd className={row.detail.finaled ? "" : row.state === "in_progress" ? "text-amber-700" : "text-destructive"}>
                                {row.detail.finaled ? day(row.detail.finaled) : row.state === "in_progress" ? "Not yet" : "Never"}
                              </dd>
                            </div>
                            {row.detail.valuation && (
                              <div>
                                <dt className="text-muted-foreground">Declared value</dt>
                                <dd>${Math.round(row.detail.valuation).toLocaleString()}</dd>
                              </div>
                            )}
                            {row.detail.type && (
                              <div className="col-span-2">
                                <dt className="text-muted-foreground">Type</dt>
                                <dd>{row.detail.type}</dd>
                              </div>
                            )}
                            {row.contractor && (
                              <div className="col-span-2">
                                <dt className="text-muted-foreground">Contractor</dt>
                                <dd>
                                  <button type="button" onClick={() => onCheck(row.contractor!)} className="-my-2 inline-block py-2 text-left underline underline-offset-4 decoration-border hover:decoration-foreground">
                                    {tidyName(row.contractor)}
                                  </button>
                                </dd>
                              </div>
                            )}
                          </dl>
                          {row.detail.inspections.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[13px] text-muted-foreground">Inspections</p>
                              <ul className="mt-1 flex flex-wrap gap-1.5">
                                {row.detail.inspections.map((x) => (
                                  <li
                                    key={x.label}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] ${
                                      x.status === "complete" ? "border-sage/30 bg-sage/10 text-sage" : "border-border bg-card text-muted-foreground"
                                    }`}
                                  >
                                    {x.status === "complete" && <Check className="h-3 w-3" strokeWidth={2.5} />} {x.label}
                                    {x.status !== "complete" && <span className="opacity-70"> · {x.status === "in_progress" ? "in progress" : "pending"}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {row.permit && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openFile(row.permit!)}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-medium text-background transition-smooth hover:opacity-90"
                              >
                                Open the city's file <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                                {copied === row.permit ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-sage" /> Permit {row.permit} copied. Paste it in the city's search.
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" /> Permit {row.permit}
                                  </>
                                )}
                              </span>
                            </div>
                          )}
                          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                            The city's file holds the imaged permit, plans and inspection records.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
          {rows.length > 6 && (
            <button type="button" onClick={() => setShowAll((x) => !x)} className="mt-2 min-h-[40px] text-[13.5px] font-medium underline-offset-4 hover:underline">
              {showAll ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Each contractor who worked on this house, with their wider San José record. */
export function CrewOnHouse({ rows, onCheck }: { rows: RecordRow[]; onCheck: (name: string) => void }) {
  const navigate = useNavigate();
  const crew = [...new Set(rows.map((r) => r.contractor).filter((c): c is string => !!c))];
  const records = useCrewRecords(crew);
  if (!crew.length) return null;
  return (
    <div className="border-t border-border p-5 md:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={sectionTitle}>Who worked on this house</h3>
        <span className={kicker}>{crew.length} on file</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {crew.map((raw) => {
          const here = rows.filter((r) => r.contractor === raw);
          const years = [...new Set(here.map((r) => r.year).filter(Boolean))].sort();
          const rec = records[raw];
          return (
            <li key={raw}>
              <button
                type="button"
                onClick={() => {
                  track("house_crew_opened", { has_record: !!rec?.id });
                  if (rec?.id) navigate(`/contractors/${rec.id}`);
                  else onCheck(raw);
                }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-3.5 text-left transition-smooth hover:border-foreground/30"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                  <Users className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{tidyName(raw)}</span>
                  <span className="block text-[12.5px] leading-snug text-muted-foreground">
                    {here.length} permit{here.length === 1 ? "" : "s"} on this house{years.length ? ` (${years.join(", ")})` : ""}
                    {rec?.permitCount ? ` · ${rec.permitCount} in San José` : ""}
                    {rec?.lastPermit ? `, latest ${month(rec.lastPermit)}` : ""}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-smooth group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Everyone working in the ZIP, loaded when they ask: what they do and the streets they've worked on. */
export function AreaDrilldown({ zip, street }: { zip: string; street: string | null }) {
  const navigate = useNavigate();
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
                      navigate(`/contractors/${c.id}`);
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
