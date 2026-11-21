// Loads a home's record: hazard signals, the parcel's permit history and the
// city's inspection sign-offs on its recent permits. A saved copy is used
// only when it can be trusted (homeData.ts); otherwise the lookup runs again.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Address } from "@/lib/intake";
import type { InspectionIn } from "@/lib/homeRecord";
import { addressKey, parcelIsFresh, riskIsFresh, type ParcelHistory, type RiskSignal } from "@/lib/homeData";

export type HomeData = {
  signal: RiskSignal | null;
  parcel: ParcelHistory | null;
  inspections: InspectionIn[];
  /** Both lookups have finished (with or without an answer). */
  settled: boolean;
};

export const useHomeData = (address?: Address): HomeData => {
  const [done, setDone] = useState({ risk: false, parcel: false });
  const [signal, setSignal] = useState<RiskSignal | null>(null);
  const [parcel, setParcel] = useState<ParcelHistory | null>(null);
  const [inspections, setInspections] = useState<InspectionIn[]>([]);

  useEffect(() => {
    setSignal(null);
    setParcel(null);
    setInspections([]);
    if (!address?.street || !address?.city || address?.skipped) {
      setDone({ risk: true, parcel: true });
      return;
    }
    setDone({ risk: false, parcel: false });
    const key = addressKey(address);
    let active = true;

    (async () => {
      const { data: cached } = await supabase.from("address_risk_signals").select("*").eq("address_key", key).maybeSingle();
      if (cached && riskIsFresh(cached as RiskSignal)) {
        if (active) {
          setSignal(cached as RiskSignal);
          setDone((d) => ({ ...d, risk: true }));
        }
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("lookup-address-risk", { body: { address, force: !!cached } });
        if (active) setSignal((data?.signals as RiskSignal) ?? (cached as RiskSignal | null));
      } catch (e) {
        console.warn("address risk lookup failed", e);
        if (active && cached) setSignal(cached as RiskSignal);
      }
      if (active) setDone((d) => ({ ...d, risk: true }));
    })();

    (async () => {
      const { data: cached } = await supabase.from("parcel_permit_history").select("*").eq("address_key", key).maybeSingle();
      if (cached && parcelIsFresh(cached as unknown as ParcelHistory)) {
        if (active) {
          setParcel(cached as unknown as ParcelHistory);
          setDone((d) => ({ ...d, parcel: true }));
        }
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("lookup-parcel-history", { body: { address, force: !!cached } });
        if (active) setParcel((data?.history as ParcelHistory) ?? (cached as unknown as ParcelHistory | null));
      } catch (e) {
        console.warn("parcel history lookup failed", e);
        if (active && cached) setParcel(cached as unknown as ParcelHistory);
      }
      if (active) setDone((d) => ({ ...d, parcel: true }));
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address?.street, address?.city, address?.state, address?.zip, address?.skipped]);

  // The city's inspection sign-offs on the most recent permits.
  useEffect(() => {
    const nums = (parcel?.permits ?? [])
      .slice()
      .sort((a, b) => (b.issued_date ?? "").localeCompare(a.issued_date ?? ""))
      .map((p) => p.permit_number)
      .filter((n): n is string => !!n)
      .slice(0, 6);
    if (!nums.length) return;
    let active = true;
    supabase.functions
      .invoke("fetch-permit-inspections", { body: { permit_numbers: nums, limit: nums.length } })
      .then(({ data }) => {
        const results = (data as { results?: InspectionIn[] } | null)?.results;
        if (active && Array.isArray(results)) setInspections(results);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [parcel]);

  return { signal, parcel, inspections, settled: done.risk && done.parcel };
};
