// Phase 1 City Intelligence — a calm, contextual card surfaced at the top of
// the brief once we know the home's address. Surfaces:
//   - Real risk signals (fire / flood / seismic) from address_risk_signals
//   - Parcel permit history (every permit on this APN, open/expired flags,
//     contractors who worked it) from parcel_permit_history
// Only renders when there's real signal. One fact + one consequence per item.
import { useEffect, useState } from "react";
import { Flame, Waves, Mountain, Sparkles, FileText, AlertCircle, History } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Address } from "@/lib/intake";

type Signal = {
  address_key: string;
  fire_hazard_class: string | null;
  fire_hazard_zone: string | null;
  flood_zone: string | null;
  flood_zone_description: string | null;
  in_special_flood_hazard_area: boolean | null;
  seismic_hazard_zone: string | null;
  seismic_hazard_type: string | null;
  lookup_succeeded: boolean | null;
  last_checked_at: string | null;
  raw_response?: { geocodeLevel?: string; fire?: { approximate?: boolean } } | null;
};

type ParcelPermit = {
  permit_number: string | null;
  type: string | null;
  subtype: string | null;
  description: string | null;
  contractor: string | null;
  valuation: number | null;
  issued_date: string | null;
  final_date: string | null;
  status: string | null;
  is_open: boolean;
  is_expired_without_final: boolean;
};

type ParcelHistory = {
  address_key: string;
  apn: string | null;
  permits: ParcelPermit[];
  contractors: string[];
  permit_count: number;
  open_permit_count: number;
  expired_without_final_count: number;
  most_recent_permit_date: string | null;
  oldest_permit_date: string | null;
  lookup_succeeded: boolean;
};

function normalizeKey(a: Address): string {
  return [a.street, a.city, a.state, a.zip]
    .map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

type Props = { address?: Address };

export default function AddressIntelligenceCard({ address }: Props) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [parcel, setParcel] = useState<ParcelHistory | null>(null);
  const [showAllPermits, setShowAllPermits] = useState(false);

  useEffect(() => {
    if (!address?.street || !address?.city || address?.skipped) {
      setSignal(null);
      setParcel(null);
      return;
    }
    const key = normalizeKey(address);
    let active = true;

    // Risk signals
    (async () => {
      const { data: cached } = await supabase
        .from("address_risk_signals")
        .select("*")
        .eq("address_key", key)
        .maybeSingle();
      if (cached && active) {
        setSignal(cached as Signal);
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("lookup-address-risk", {
          body: { address },
        });
        if (active && data?.signals) setSignal(data.signals as Signal);
      } catch (e) {
        console.warn("address risk lookup failed", e);
      }
    })();

    // Parcel permit history
    (async () => {
      const { data: cached } = await supabase
        .from("parcel_permit_history")
        .select("*")
        .eq("address_key", key)
        .maybeSingle();
      if (cached && active) {
        setParcel(cached as ParcelHistory);
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("lookup-parcel-history", {
          body: { address },
        });
        if (active && data?.history) setParcel(data.history as ParcelHistory);
      } catch (e) {
        console.warn("parcel history lookup failed", e);
      }
    })();

    return () => {
      active = false;
    };
  }, [address?.street, address?.city, address?.state, address?.zip, address?.skipped]);

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
  }

  // Seismic
  if (signal?.seismic_hazard_type) {
    items.push({
      icon: Mountain,
      title: `Mapped seismic hazard: ${signal.seismic_hazard_type}`,
      body:
        signal.seismic_hazard_type === "Liquefaction"
          ? "Your parcel sits in a state-mapped liquefaction zone. Structural additions and foundation work usually need a soils report — get this on the table early."
          : "Your parcel sits in a state-mapped landslide hazard zone. Structural and grading work usually need a geotechnical review. Worth raising up front.",
      chip: "CA Geological Survey",
      tone: "warn",
    });
  }

  // Parcel-derived items
  if (parcel?.lookup_succeeded) {
    if (parcel.open_permit_count > 0) {
      const oldest = parcel.permits
        .filter((p) => p.is_open && p.issued_date)
        .sort((a, b) => (a.issued_date! < b.issued_date! ? -1 : 1))[0];
      items.push({
        icon: AlertCircle,
        title: `${parcel.open_permit_count} open permit${parcel.open_permit_count > 1 ? "s" : ""} on this parcel`,
        body: oldest
          ? `The oldest is ${oldest.permit_number ?? "an unnumbered permit"} (${oldest.type ?? "building"}) from ${oldest.issued_date}, still not finaled with the city. Your next contractor will run into this — raise it before they bid.`
          : "These were pulled but never finaled. Get them on the table before signing anything new — open permits block resale and stack up against new scope.",
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

  if (!signal && !parcel) return null;
  if (signal && !signal.lookup_succeeded && items.length === 0 && !hasParcel) return null;

  const allClear = items.length === 0 && hasRiskSignal;
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
                What your address tells us
              </p>
              <p className="mt-0.5 font-display text-xl font-light leading-tight text-foreground md:text-2xl">
                {allClear && !hasParcel
                  ? "Clean parcel — no red flags."
                  : items.length === 0 && hasParcel
                    ? "Clean record — here's the parcel's history."
                    : "A few things worth knowing before you talk to anyone."}
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:inline-block">
            Public records
          </span>
        </div>

        {allClear && !hasParcel ? (
          <div className="mt-5 rounded-2xl border border-sage/20 bg-sage/5 px-5 py-4">
            <p className="text-sm leading-relaxed text-foreground/80">
              We checked CAL FIRE fire hazard zones, FEMA flood maps, and California
              Geological Survey seismic overlays. None flagged your address — so no
              special permitting or insurance gotchas to plan around upfront.
            </p>
          </div>
        ) : null}

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
                {visiblePermits.map((p, i) => (
                  <li key={(p.permit_number ?? "") + i} className="flex items-start gap-3 py-3">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {p.type ?? p.subtype ?? "Building permit"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.issued_date ?? "date unknown"}
                        </span>
                        {p.is_open && (
                          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                            Open
                          </span>
                        )}
                        {p.is_expired_without_final && !p.is_open && (
                          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                            Expired, no final
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.description ?? p.subtype ?? "—"}
                        {p.contractor ? ` · ${p.contractor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
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
