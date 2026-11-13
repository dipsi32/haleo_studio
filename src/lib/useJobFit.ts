// Job fit with the city's inspection sign-offs added live. The list ranks
// without inspections (one call per contractor would be too many); a card
// that's on screen fetches them and fills in the fourth answer.
import { useMemo } from "react";
import type { IntakeData } from "@/lib/intake";
import type { LicenseStatus } from "@/lib/contractors";
import type { TrackPermit } from "@/lib/trackRecord";
import { jobFit, type JobFit } from "@/lib/jobFit";
import { useInspections } from "@/lib/useContractorRecord";

export const useJobFit = (
  contractorId: string | null | undefined,
  permits: TrackPermit[],
  data: IntakeData,
  license: LicenseStatus | null,
  withInspections = true,
  noRecord = false,
): JobFit => {
  const inspections = useInspections(contractorId, withInspections && permits.length > 0);
  return useMemo(() => jobFit(permits, data, { inspections, license, noRecord }), [permits, data, inspections, license, noRecord]);
};
