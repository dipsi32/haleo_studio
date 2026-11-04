// The record of the contractor whose link the homeowner came through, loaded
// once for the brief flow. Null without a contractor link, or until loaded.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveInvite } from "@/lib/invites";
import { verifyLicense } from "@/lib/useShortlistCheck";
import type { LicenseStatus } from "@/lib/contractors";
import type { RecordPermit } from "@/lib/recordHighlights";

/** A contractor's San Jose permits, newest first. Null until loaded. */
export const usePermits = (contractorId: string | null | undefined): RecordPermit[] | null => {
  const [permits, setPermits] = useState<RecordPermit[] | null>(null);
  useEffect(() => {
    if (!contractorId) return;
    let cancelled = false;
    supabase
      .from("contractor_permits")
      .select("city, zip, issued_date, work_type, description, status")
      .eq("contractor_id", contractorId)
      .order("issued_date", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!cancelled) setPermits((data ?? []) as RecordPermit[]);
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
  permits: RecordPermit[];
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
