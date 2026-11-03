// The record of the contractor whose link the homeowner came through, loaded
// once for the brief flow. Null without a contractor link, or until loaded.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveInvite } from "@/lib/invites";
import type { RecordPermit } from "@/lib/recordHighlights";

export const useContractorRecord = (): { who: string; permits: RecordPermit[] } | null => {
  const invite = useMemo(() => getActiveInvite(), []);
  const [permits, setPermits] = useState<RecordPermit[] | null>(null);

  useEffect(() => {
    if (!invite) return;
    let cancelled = false;
    supabase
      .from("contractor_permits")
      .select("city, zip, issued_date, work_type, description")
      .eq("contractor_id", invite.contractorId)
      .order("issued_date", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!cancelled) setPermits((data ?? []) as RecordPermit[]);
      });
    return () => {
      cancelled = true;
    };
  }, [invite]);

  return invite && permits && permits.length > 0 ? { who: invite.contractorName, permits } : null;
};
