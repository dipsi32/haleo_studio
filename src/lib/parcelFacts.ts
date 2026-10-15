// Public-record facts about a parcel, attached to a brief when it is sent so
// the contractor can prepare. Best effort: a slow or failed lookup returns
// nothing and never blocks a send.
import { supabase } from "@/integrations/supabase/client";
import type { Address } from "@/lib/intake";
import { addressRiskKey } from "@/lib/addressRisk";
import type { ParcelFacts, ParcelPermitLite } from "@/lib/prepTypes";

const MAX_PERMITS = 8;
const LOOKUP_TIMEOUT_MS = 6000;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const toPermit = (raw: unknown): ParcelPermitLite | null => {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    permit_number: str(p.permit_number),
    description: str(p.description),
    type: str(p.type),
    valuation: num(p.valuation),
    issued_date: str(p.issued_date),
    status: str(p.status),
    is_open: p.is_open === true,
    is_expired_without_final: p.is_expired_without_final === true,
  };
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

export async function loadParcelFacts(addr?: Address | null): Promise<ParcelFacts | undefined> {
  if (!addr || addr.skipped || !addr.street || !addr.city) return undefined;
  const facts: ParcelFacts = {};

  const history = (async () => {
    try {
      const { data } = await supabase
        .from("parcel_permit_history")
        .select("apn, permit_count, open_permit_count, expired_without_final_count, oldest_permit_date, permits, lookup_succeeded")
        .eq("address_key", addressRiskKey(addr))
        .maybeSingle();
      if (!data || data.lookup_succeeded === false) return;
      facts.apn = data.apn;
      facts.permit_count = data.permit_count;
      facts.open_permit_count = data.open_permit_count;
      facts.expired_without_final_count = data.expired_without_final_count;
      facts.oldest_permit_date = data.oldest_permit_date;
      const permits = Array.isArray(data.permits) ? data.permits : [];
      facts.permits = permits.map(toPermit).filter((p): p is ParcelPermitLite => p !== null).slice(0, MAX_PERMITS);
    } catch (e) {
      console.warn("parcel history for snapshot failed", e);
    }
  })();

  const enrichment = (async () => {
    try {
      const { data } = await supabase.functions.invoke("enrich-sj-parcel", {
        body: { address: { street: addr.street, city: addr.city, state: addr.state ?? "CA", zip: addr.zip || undefined } },
      });
      if (!data || typeof data !== "object") return;
      const e = data as Record<string, unknown>;
      facts.apn = facts.apn ?? str(e.apn);
      facts.lot_size_sqft = num(e.lot_size_sqft);
      facts.zoning = str(e.zoning);
      facts.primary_dwelling_sqft = num(e.primary_dwelling_sqft);
      facts.existing_footprints_sqft = num(e.existing_footprints_sqft);
    } catch (e) {
      console.warn("parcel enrichment for snapshot failed", e);
    }
  })();

  await withTimeout(Promise.all([history, enrichment]), LOOKUP_TIMEOUT_MS);
  // Only attach what we actually found.
  const found = Object.values(facts).some((v) => v != null && !(Array.isArray(v) && v.length === 0));
  return found ? { ...facts } : undefined;
}
