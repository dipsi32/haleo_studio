// Public-record facts about a parcel, attached to a brief when it is sent so
// the contractor can prepare. Best effort: a slow or failed lookup returns
// nothing and never blocks a send.
import { supabase } from "@/integrations/supabase/client";
import type { Address } from "@/lib/intake";
import { addressRiskKey } from "@/lib/addressRisk";
import type { ParcelFacts, ParcelPermitLite } from "@/lib/prepTypes";
import type { CityRecord } from "@/lib/cityRecord";
import { briefFromCity } from "@/lib/briefHistory";

const MAX_PERMITS = 8;
const LOOKUP_TIMEOUT_MS = 6000;
// The city's own portal takes a few seconds for a house with a long history.
const CITY_TIMEOUT_MS = 9000;

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

  // The city's own file: every permit, in plain words, with the house's systems
  // ("Electrical panel, 2015, signed off"). Replaces the feeds' summary when it answers.
  const cityFile = (async () => {
    if (!addr.zip) return null;
    try {
      const res = await withTimeout(supabase.functions.invoke("city-record", { body: { street: addr.street, zip: addr.zip } }), CITY_TIMEOUT_MS);
      const data = (res as { data?: { ok?: boolean } & CityRecord } | null)?.data;
      return data?.ok ? briefFromCity({ found: !!data.found, property: data.property ?? null, permits: data.permits ?? [] }) : null;
    } catch (e) {
      console.warn("city record for snapshot failed", e);
      return null;
    }
  })();

  const [, fromCity] = await Promise.all([withTimeout(Promise.all([history, enrichment]), LOOKUP_TIMEOUT_MS), cityFile]);
  if (fromCity) {
    Object.assign(facts, {
      ...fromCity,
      apn: fromCity.apn ?? facts.apn,
      zoning: fromCity.zoning ?? facts.zoning,
    });
  } else if (facts.permits?.length) {
    facts.permit_source = "feeds";
  }

  // The city's inspection sign-offs on the most recent permits, so the
  // contractor sees what was finished properly, not just what was pulled.
  const nums = facts.permit_source === "city" ? [] : (facts.permits ?? []).map((p) => p.permit_number).filter((n): n is string => !!n).slice(0, 6);
  if (nums.length) {
    try {
      const res = await withTimeout(supabase.functions.invoke("fetch-permit-inspections", { body: { permit_numbers: nums, limit: nums.length } }), LOOKUP_TIMEOUT_MS);
      const results = (res?.data as { results?: { folder_number: string; found: boolean; approvals?: { label: string; status: string }[] }[] } | null)?.results ?? [];
      const byFolder = new Map(results.filter((r) => r.found).map((r) => [r.folder_number, r]));
      facts.permits = (facts.permits ?? []).map((p) => {
        const r = p.permit_number ? byFolder.get(p.permit_number) : undefined;
        const signoffs = [...new Set((r?.approvals ?? []).filter((a) => a.status === "complete").map((a) => a.label))];
        return signoffs.length ? { ...p, signoffs } : p;
      });
    } catch (e) {
      console.warn("inspections for snapshot failed", e);
    }
  }
  // Only attach what we actually found.
  const found = Object.values(facts).some((v) => v != null && !(Array.isArray(v) && v.length === 0));
  return found ? { ...facts } : undefined;
}
