// Phase 1 City Intelligence — a calm, contextual card surfaced at the top of
// the brief once we know the home's address. Only renders when there is real
// signal (fire hazard above moderate, in a flood SFHA, or in a mapped seismic
// zone). Each signal is one fact + one consequence, in the friend-who-knows-SJ
// voice. No emoji. No alarm.
import { useEffect, useState } from "react";
import { Flame, Waves, Mountain, Sparkles } from "lucide-react";
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

function normalizeKey(a: Address): string {
  return [a.street, a.city, a.state, a.zip]
    .map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

type Props = { address?: Address };

export default function AddressIntelligenceCard({ address }: Props) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address?.street || !address?.city || address?.skipped) {
      setSignal(null);
      return;
    }
    const key = normalizeKey(address);
    let active = true;

    (async () => {
      setLoading(true);

      // 1. Try cache first.
      const { data: cached } = await supabase
        .from("address_risk_signals")
        .select("*")
        .eq("address_key", key)
        .maybeSingle();

      if (cached && active) {
        setSignal(cached as Signal);
        setLoading(false);
        return;
      }

      // 2. Trigger the lookup. Edge function writes to cache and returns the row.
      try {
        const { data, error } = await supabase.functions.invoke("lookup-address-risk", {
          body: { address },
        });
        if (!active) return;
        if (error) {
          console.warn("address risk lookup failed", error);
        } else if (data?.signals) {
          setSignal(data.signals as Signal);
        }
      } catch (e) {
        console.warn("address risk lookup threw", e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [address?.street, address?.city, address?.state, address?.zip, address?.skipped]);

  if (!signal) return null;

  const items: Array<{
    icon: typeof Flame;
    title: string;
    body: string;
    chip: string;
  }> = [];

  // Fire — High/Very High shown prominently; Moderate as a soft note.
  if (signal.fire_hazard_class === "High" || signal.fire_hazard_class === "Very High") {
    items.push({
      icon: Flame,
      title: `${signal.fire_hazard_class} Fire Hazard Severity Zone`,
      body:
        "This changes what exterior materials are permitted, your insurance options, and the contractor requirements you should expect. Worth knowing before the first bid.",
      chip: "CAL FIRE",
    });
  } else if (signal.fire_hazard_class === "Moderate") {
    items.push({
      icon: Flame,
      title: "Moderate Fire Hazard Severity Zone",
      body:
        "Not a WUI zone, but still on the CAL FIRE map. Ember-resistant vents and Class A roofing are smart calls on any reroof or exterior work.",
      chip: "CAL FIRE",
    });
  }

  // Flood — surface only when in an SFHA (zones A*, V*).
  if (signal.in_special_flood_hazard_area && signal.flood_zone) {
    items.push({
      icon: Waves,
      title: `FEMA flood zone ${signal.flood_zone}`,
      body:
        signal.flood_zone_description ??
        "You're in a Special Flood Hazard Area. Certain scopes trigger elevation, venting, or materials requirements. Mention it to any contractor before they bid.",
      chip: "FEMA NFHL",
    });
  }

  // Seismic — only when mapped (liquefaction / landslide).
  if (signal.seismic_hazard_type) {
    items.push({
      icon: Mountain,
      title: `Mapped seismic hazard: ${signal.seismic_hazard_type}`,
      body:
        signal.seismic_hazard_type === "Liquefaction"
          ? "Your parcel sits in a state-mapped liquefaction zone. Structural additions and foundation work usually need a soils report — get this on the table early."
          : "Your parcel sits in a state-mapped landslide hazard zone. Structural and grading work usually need a geotechnical review. Worth raising up front.",
      chip: "CA Geological Survey",
    });
  }

  // Hide entirely if the lookup didn't even succeed (e.g. geocode failed).
  if (items.length === 0 && !signal.lookup_succeeded) return null;
  const allClear = items.length === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 shadow-lift"
      aria-label="What your address tells us"
    >
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

      <div className="p-6 md:p-8">
        {/* Header */}
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
                {allClear
                  ? "Clean parcel — no red flags."
                  : "A few things worth knowing before you talk to anyone."}
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:inline-block">
            Public records
          </span>
        </div>

        {allClear ? (
          <div className="mt-5 rounded-2xl border border-sage/20 bg-sage/5 px-5 py-4">
            <p className="text-sm leading-relaxed text-foreground/80">
              We checked CAL FIRE fire hazard zones, FEMA flood maps, and California
              Geological Survey seismic overlays. None flagged your address — so no
              special permitting or insurance gotchas to plan around upfront.
            </p>
          </div>
        ) : null}

        {/* Signal items as insight cards */}
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
                  {/* Subtle left accent */}
                  <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-amber-600 opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="flex items-start gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-display text-[15px] font-medium leading-snug">
                          {item.title}
                        </p>
                        <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {item.chip}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Pulled from public records. Worth confirming with the city before you sign.
        </p>
      </div>
    </motion.section>
  );
}
