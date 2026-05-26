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

  // Fire — surface High or Very High only (Moderate is too noisy across most of SJ).
  if (signal.fire_hazard_class === "High" || signal.fire_hazard_class === "Very High") {
    items.push({
      icon: Flame,
      title: `${signal.fire_hazard_class} Fire Hazard Severity Zone`,
      body:
        "This changes what exterior materials are permitted, your insurance options, and the contractor requirements you should expect. Worth knowing before the first bid.",
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

  if (items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-7"
      aria-label="What your address tells us"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          What your address tells us
        </p>
      </div>

      <p className="mt-3 font-display text-lg font-light leading-snug text-foreground">
        A few things worth knowing before you talk to anyone.
      </p>

      <ul className="mt-5 space-y-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-2xl bg-secondary/50 p-4"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-display text-sm font-medium leading-tight">
                    {item.title}
                  </p>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {item.chip}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Pulled from public records. Worth confirming with the city before you sign.
      </p>
      {loading ? null : null}
    </motion.section>
  );
}
