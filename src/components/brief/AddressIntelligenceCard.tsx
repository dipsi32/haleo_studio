// Phase 1 City Intelligence — a calm, contextual card surfaced at the top of
// the brief once we know the home's address. Surfaces:
//   - Real risk signals (fire / flood / seismic) from address_risk_signals
//   - Parcel permit history (every permit on this APN, open/expired flags,
//     contractors who worked it) from parcel_permit_history
// Only renders when there's real signal. One fact + one consequence per item.
import { useState } from "react";
import { Flame, Waves, Mountain, Sparkles, FileText, AlertCircle, History, Check, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useHomeData } from "@/lib/useHomeData";
import { floodMinimal, type RiskSignal } from "@/lib/homeData";
import type { Address } from "@/lib/intake";
import { CITY_PERMIT_ARCHIVE, HAZARD_MAPS, homeRecord, isLongOpen, type InspectionIn } from "@/lib/homeRecord";

type Signal = RiskSignal;

type Props = {
  address?: Address;
  /** Shown while the lookups run (the standalone /house page). Default: nothing. */
  loadingFallback?: React.ReactNode;
  /** Shown when both lookups finished with nothing to say. Default: nothing. */
  emptyFallback?: React.ReactNode;
};

export default function AddressIntelligenceCard({ address, loadingFallback = null, emptyFallback = null }: Props) {
  const { signal, parcel, inspections, settled: homeSettled } = useHomeData(address);
  const [showAllPermits, setShowAllPermits] = useState(false);

  const items: Array<{
    icon: typeof Flame;
    title: string;
    body: string;
    chip: string;
    tone?: "warn" | "neutral";
  }> = [];

  // Fire
  if (signal?.fire_hazard_class === "High" || signal?.fire_hazard_class === "Very High") {
    items.push({
      icon: Flame,
      title: `${signal.fire_hazard_class} Fire Hazard Severity Zone`,
      body:
        "This changes what exterior materials are permitted, your insurance options, and the contractor requirements you should expect. Worth knowing before the first bid.",
      chip: "CAL FIRE",
      tone: "warn",
    });
  } else if (signal?.fire_hazard_class === "Moderate") {
    items.push({
      icon: Flame,
      title: "Moderate Fire Hazard Severity Zone",
      body:
        "Not a WUI zone, but still on the CAL FIRE map. Ember-resistant vents and Class A roofing are smart calls on any reroof or exterior work.",
      chip: "CAL FIRE",
    });
  }

  // Flood
  if (signal?.in_special_flood_hazard_area && signal.flood_zone) {
    items.push({
      icon: Waves,
      title: `FEMA flood zone ${signal.flood_zone}`,
      body:
        signal.flood_zone_description ??
        "You're in a Special Flood Hazard Area. Certain scopes trigger elevation, venting, or materials requirements. Mention it to any contractor before they bid.",
      chip: "FEMA NFHL",
      tone: "warn",
    });
  } else if (signal?.raw_response?.checked?.flood && signal.flood_zone && !floodMinimal(signal.flood_zone)) {
    // Zone D and friends: FEMA hasn't rated it. Not a hazard, and not "clear" either.
    items.push({
      icon: Waves,
      title: signal.flood_zone === "D" ? "FEMA hasn't rated flood risk here" : `FEMA flood zone ${signal.flood_zone}`,
      body:
        signal.flood_zone === "D"
          ? "Your lot is in FEMA zone D: possible flood risk that FEMA hasn't studied. It isn't a flood zone, but it isn't cleared either. Worth asking about drainage for any grading or foundation work."
          : signal.flood_zone_description ?? "Ask your contractor how this flood zone affects the work.",
      chip: "FEMA NFHL",
      tone: "neutral",
    });
  }

  // Seismic
  if (signal?.seismic_hazard_type) {
    items.push({
      icon: Mountain,
      title: `Mapped seismic hazard: ${signal.seismic_hazard_type}`,
      body: [
        /liquefaction/i.test(signal.seismic_hazard_type) &&
          "Your parcel sits in a state-mapped liquefaction zone. Structural additions and foundation work usually need a soils report — get this on the table early.",
        /landslide/i.test(signal.seismic_hazard_type) &&
          "Your parcel sits in a state-mapped landslide hazard zone. Structural and grading work usually need a geotechnical review. Worth raising up front.",
      ]
        .filter(Boolean)
        .join(" ") || "Your parcel sits in a state-mapped seismic hazard zone. Ask about a soils or geotechnical review early.",
      chip: "CA Geological Survey",
      tone: "warn",
    });
  }

  // Parcel-derived items
  if (parcel?.lookup_succeeded) {
    // Open for years is a warning; open for months is just work in progress.
    const longOpen = parcel.permits.filter((p) => p.is_open && p.issued_date && isLongOpen(p.issued_date));
    if (longOpen.length > 0) {
      const oldest = longOpen.sort((a, b) => (a.issued_date! < b.issued_date! ? -1 : 1))[0];
      items.push({
        icon: AlertCircle,
        title: `${longOpen.length} permit${longOpen.length > 1 ? "s" : ""} open for over two years`,
        body: `The oldest is from ${oldest.issued_date!.slice(0, 4)} and the city still hasn't signed it off. Long-open permits pass to the next job and show up at sale: raise it before anyone bids.`,
        chip: "San José permits",
        tone: "warn",
      });
    }
    if (parcel.expired_without_final_count > 0) {
      items.push({
        icon: AlertCircle,
        title: `${parcel.expired_without_final_count} expired permit${parcel.expired_without_final_count > 1 ? "s" : ""} without a final inspection`,
        body:
          "Work was started under permit but the city never signed off. Either the work was abandoned or completed without inspection — both surface on title and matter at resale.",
        chip: "San José permits",
        tone: "warn",
      });
    }
  }

  const hasRiskSignal = !!signal;
  const hasParcel = !!parcel?.lookup_succeeded && parcel.permit_count > 0;

  const settled = homeSettled;
  if (!signal && !parcel) return <>{settled ? emptyFallback : loadingFallback}</>;
  if (signal && !signal.lookup_succeeded && items.length === 0 && !hasParcel) return <>{settled ? emptyFallback : loadingFallback}</>;

  const warnCount = items.filter((i) => i.tone === "warn").length;
  // We only call a hazard "clear" when its check ran on this exact address.
  // A ZIP-centroid fallback or a failed map lookup is never shown as clear.
  const ran = signal?.raw_response?.checked;
  const exact = !!signal?.lookup_succeeded && signal?.raw_response?.geocodeLevel !== "zip";
  const approximate = !!signal?.lookup_succeeded && signal?.raw_response?.geocodeLevel === "zip";
  // Rows saved before checks were tracked don't say which ran: treat all as unconfirmed.
  const notChecked = exact
    ? ran
      ? ([!ran.fire && "fire hazard zones", !ran.flood && "flood maps", !ran.seismic && "earthquake hazard zones"].filter(Boolean) as string[])
      : ["fire hazard zones, flood maps", "earthquake hazard zones"]
    : [];
  const clearChecks = exact && ran
    ? [
        ran.fire && !signal?.fire_hazard_class && {
          icon: Flame,
          label: "Not in a CAL FIRE hazard zone",
          means: "The state's fire-rated rules for siding, roofing and vents shouldn't apply to your exterior work.",
        },
        ran.flood && !signal?.in_special_flood_hazard_area && floodMinimal(signal?.flood_zone) && {
          icon: Waves,
          label: "Outside FEMA flood zones",
          means: "No flood elevation or venting rules, and federally backed lenders don't require flood insurance here.",
        },
        ran.seismic && !signal?.seismic_hazard_type && {
          icon: Mountain,
          label: "No mapped liquefaction or landslide zone",
          means: "Additions and foundation work usually don't need a state-required soils report, one less study before you can build.",
        },
      ].filter(Boolean) as { icon: typeof Flame; label: string; means: string }[]
    : [];
  const record = homeRecord(parcel?.permits ?? [], inspections);
  const anyHazardRan = !!ran && (ran.fire || ran.flood || ran.seismic);
  const headline =
    warnCount > 0
      ? `${warnCount} thing${warnCount === 1 ? "" : "s"} on your lot that can change every bid.`
      : clearChecks.length === 3 && hasParcel
        ? "No hazard zones, and the permit record is clean."
        : clearChecks.length === 3
          ? "No hazard zones on your lot. Fewer surprises in your bids."
          : hasParcel
            ? record.headline
            : "Worth knowing before you talk to anyone.";
  const subline =
    warnCount > 0
      ? "Hazard zones and unfinished permits change materials, insurance and cost. Raise them before anyone prices the job, not after."
      : anyHazardRan
        ? `Hazard zones are where change orders hide: different materials, extra reports, higher insurance.${clearChecks.length ? " Here's what we checked." : ""}`
        : hasParcel
          ? "The permits the city has on file for your home, and what it signed off. Your contractor gets this too, so nobody is surprised by old work."
          : "What the public record says about your home, so nothing surprises you or your contractor.";
  const recentPermits = parcel?.permits
    ?.slice()
    .sort((a, b) => (a.issued_date && b.issued_date ? (a.issued_date < b.issued_date ? 1 : -1) : 0))
    ?? [];
  const visiblePermits = showAllPermits ? recentPermits : recentPermits.slice(0, 5);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 shadow-lift"
      aria-label="What your address tells us"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Your home's record
              </p>
              <p className="mt-0.5 font-display text-xl font-light leading-tight text-foreground md:text-2xl">{headline}</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{subline}</p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:inline-block">
            From public records
          </span>
        </div>

        {/* What came back clear, and what that saves them. */}
        {clearChecks.length > 0 && (
          <ul className="mt-5 grid gap-2.5 rounded-2xl border border-sage/20 bg-sage/5 p-4 md:p-5">
            {clearChecks.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage/15 text-sage">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{c.label}</p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{c.means}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(approximate || notChecked.length > 0) && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {approximate ? (
                <>
                  <span className="font-medium text-foreground">We couldn't place your exact address,</span> so we
                  only looked around your ZIP code. Treat this as a rough read and ask your contractor to confirm
                  hazard zones for the lot itself.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">We couldn't check {notChecked.join(" or ")} just now.</span>{" "}
                  That's not a clean result. You can look your address up on the official maps in a minute:
                  <span className="mt-2 flex flex-wrap gap-2">
                    {HAZARD_MAPS.filter((m) => !ran || !ran[m.id]).map((m) => (
                      <a
                        key={m.id}
                        href={m.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-foreground transition-smooth hover:bg-secondary"
                      >
                        {m.label} ↗
                      </a>
                    ))}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Say what we couldn't check, so "clear" never implies more than it means. */}
        {!hasParcel && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {parcel?.lookup_succeeded ? (
                <>
                  <span className="font-medium text-foreground">No current permits on file for this address.</span> San
                  Jose's open records show no active, in-progress or expired permits here, so nothing unfinished turns
                  up there. Permits the city finished in past years sit in its archive:{" "}
                  <a href={CITY_PERMIT_ARCHIVE} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
                    see the full history on sjpermits.org
                  </a>
                  .
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">The city's permit records didn't answer just now.</span>{" "}
                  Try again in a minute, or{" "}
                  <a href={CITY_PERMIT_ARCHIVE} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
                    look the address up on sjpermits.org
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        )}

        {/* Risk + open-permit warnings */}
        {items.length > 0 && (
          <div className="mt-5 grid gap-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-secondary/30 p-5 transition-smooth hover:border-amber-500/30 hover:bg-secondary/50 hover:shadow-soft"
                >
                  <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-amber-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="flex items-start gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-display text-[15px] font-medium leading-snug">{item.title}</p>
                        <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {item.chip}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Parcel history — full permit record on this APN */}
        {hasParcel && (
          <div className="mt-6 rounded-2xl border border-border bg-background/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground/5 text-foreground ring-1 ring-border">
                  <History className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-[15px] font-medium leading-snug">
                    {parcel!.permit_count} permit{parcel!.permit_count === 1 ? "" : "s"} on file for this parcel
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {parcel!.oldest_permit_date ? `Earliest ${parcel!.oldest_permit_date}` : "Earliest unknown"}
                    {" · "}
                    {parcel!.most_recent_permit_date ? `latest ${parcel!.most_recent_permit_date}` : "latest unknown"}
                    {parcel!.apn ? ` · APN ${parcel!.apn}` : ""}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                San José
              </span>
            </div>

            {parcel!.contractors.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Contractors who've worked here
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parcel!.contractors.slice(0, 8).map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs text-foreground/80"
                    >
                      {c}
                    </span>
                  ))}
                  {parcel!.contractors.length > 8 && (
                    <span className="rounded-full bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground">
                      +{parcel!.contractors.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {visiblePermits.length > 0 && (
              <ul className="mt-4 divide-y divide-border/60">
                {visiblePermits.map((p, i) => {
                  const row = record.rows.find((r) => r.permit && r.permit === p.permit_number);
                  const state = row?.state ?? (p.is_expired_without_final ? "expired" : p.is_open ? "in_progress" : "unknown");
                  return (
                    <li key={(p.permit_number ?? "") + i} className="flex items-start gap-3 py-3">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium text-foreground">{row?.what ?? p.type ?? "Building permit"}</span>
                          <span className="text-xs text-muted-foreground">{p.issued_date ? p.issued_date.slice(0, 4) : "date unknown"}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              state === "finaled"
                                ? "bg-sage/15 text-sage"
                                : state === "unknown" || state === "in_progress"
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {row?.stateLabel ?? (state === "in_progress" ? "Work in progress" : state === "expired" ? "Expired, never signed off" : "Status not on record")}
                          </span>
                        </div>
                        {row && row.signoffs.length > 0 && (
                          <p className="mt-1 text-xs text-foreground/80">
                            <Check className="mr-1 inline h-3 w-3 text-sage" />
                            City signed off: {row.signoffs.join(", ")}
                          </p>
                        )}
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {p.contractor ? `By ${p.contractor}` : "Contractor not on the permit"}
                          {p.permit_number ? ` · Permit ${p.permit_number}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {recentPermits.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllPermits((s) => !s)}
                className="mt-3 text-xs font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
              >
                {showAllPermits ? "Show fewer" : `Show all ${recentPermits.length} permits`}
              </button>
            )}
          </div>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Pulled from public records. Worth confirming with the city before you sign.
        </p>
      </div>
    </motion.section>
  );
}
