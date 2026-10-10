// Cached hazard-zone signals for an address, attached to a brief so the
// contractor sees what the homeowner saw. Best effort: never blocks a send.
import { supabase } from "@/integrations/supabase/client";
import type { Address } from "@/lib/intake";
import type { BriefSnapshot } from "@/lib/contractors";

export const addressRiskKey = (addr: Pick<Address, "street" | "city" | "state" | "zip">): string =>
  [addr.street, addr.city, addr.state, addr.zip]
    .map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");

export async function loadAddressRisk(addr?: Address | null): Promise<BriefSnapshot["address_risk"] | undefined> {
  if (!addr || addr.skipped || !addr.street || !addr.city) return undefined;
  try {
    const { data } = await supabase
      .from("address_risk_signals")
      .select("fire_hazard_class, fire_hazard_zone, flood_zone, flood_zone_description, in_special_flood_hazard_area, seismic_hazard_type, seismic_hazard_zone")
      .eq("address_key", addressRiskKey(addr))
      .maybeSingle();
    if (data && (data.fire_hazard_class || data.flood_zone || data.seismic_hazard_type)) return data;
  } catch (e) {
    console.warn("address risk lookup for snapshot failed", e);
  }
  return undefined;
}
