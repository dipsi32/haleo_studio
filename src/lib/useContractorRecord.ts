// The record of the contractor whose link the homeowner came through, loaded
// once for the brief flow. Null without a contractor link, or until loaded.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveInvite } from "@/lib/invites";
import { verifyLicense } from "@/lib/useShortlistCheck";
import type { LicenseStatus } from "@/lib/contractors";
import type { RecordPermit } from "@/lib/recordHighlights";
import type { Inspection, TrackPermit } from "@/lib/trackRecord";

/** A contractor's San Jose permits, newest first. Null until loaded. */
export const usePermits = (contractorId: string | null | undefined): TrackPermit[] | null => {
  const [permits, setPermits] = useState<TrackPermit[] | null>(null);
  useEffect(() => {
    if (!contractorId) return;
    let cancelled = false;
    supabase
      .from("contractor_permits")
      .select("city, zip, issued_date, work_type, description, status, address, permit_number")
      .eq("contractor_id", contractorId)
      .order("issued_date", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!cancelled) setPermits((data ?? []) as TrackPermit[]);
      });
    return () => {
      cancelled = true;
    };
  }, [contractorId]);
  return permits;
};

/** Their license, checked live with the state. undefined while checking, null if it didn't answer. */
export const useLicense = (licenseNumber: string | null | undefined): LicenseStatus | null | undefined => {
  const [license, setLicense] = useState<LicenseStatus | null | undefined>(undefined);
  useEffect(() => {
    if (!licenseNumber) {
      setLicense(null);
      return;
    }
    let cancelled = false;
    verifyLicense(licenseNumber)
      .then((l) => !cancelled && setLicense(l))
      .catch(() => !cancelled && setLicense(null));
    return () => {
      cancelled = true;
    };
  }, [licenseNumber]);
  return license;
};

export type ContractorRecord = {
  /** The company, as their client knows it. */
  who: string;
  /** What clients call them ("Matt"), when known. */
  person: string | null;
  licenseNumber: string | null;
  contractorId: string;
  permits: TrackPermit[];
};

export const useContractorRecord = (): ContractorRecord | null => {
  const invite = useMemo(() => getActiveInvite(), []);
  const permits = usePermits(invite?.contractorId);
  return invite && permits && permits.length > 0
    ? {
        who: invite.contractorName,
        person: invite.personName ?? null,
        licenseNumber: invite.licenseNumber ?? null,
        contractorId: invite.contractorId,
        permits,
      }
    : null;
};

// ───── The rest of the track record: city inspections and the license ─────

const INSP_KEY = "haleo:inspections:";

/** The city's inspection sign-offs on their recent permits. Cached for the session; null until loaded or if the city didn't answer. */
export const useInspections = (contractorId: string | null | undefined, enabled: boolean): Inspection[] | null => {
  const [rows, setRows] = useState<Inspection[] | null>(() => {
    try {
      const raw = contractorId ? sessionStorage.getItem(INSP_KEY + contractorId) : null;
      return raw ? (JSON.parse(raw) as Inspection[]) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!contractorId || !enabled || rows) return;
    let cancelled = false;
    supabase.functions
      .invoke("fetch-permit-inspections", { body: { contractor_id: contractorId, limit: 10 } })
      .then(({ data }) => {
        const results = (data as { ok?: boolean; results?: Inspection[] } | null)?.results;
        if (cancelled || !Array.isArray(results)) return;
        setRows(results);
        try {
          sessionStorage.setItem(INSP_KEY + contractorId, JSON.stringify(results));
        } catch {
          /* fine */
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [contractorId, enabled, rows]);
  return rows;
};

/**
 * Their real CSLB number: the one on the invite when it is one, else the one
 * they gave when claiming a profile built from permit records.
 */
export const useLicenseNumber = (contractorId: string | null | undefined, fromInvite: string | null | undefined): string | null => {
  const real = (v: string | null | undefined) => (v && /^\d{5,8}$/.test(v.trim()) ? v.trim() : null);
  const [num, setNum] = useState<string | null>(real(fromInvite));
  useEffect(() => {
    if (num || !contractorId) return;
    let cancelled = false;
    supabase
      .from("contractors")
      .select("license_number, claimed_license_number")
      .eq("id", contractorId)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as { license_number?: string | null; claimed_license_number?: string | null } | null;
        if (!cancelled) setNum(real(d?.license_number) ?? real(d?.claimed_license_number));
      });
    return () => {
      cancelled = true;
    };
  }, [contractorId, num]);
  return num;
};
