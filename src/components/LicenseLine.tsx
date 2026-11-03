// A contractor's California license, checked live with the state board.
// Shown only when we have a real number; if the board doesn't answer, it
// says so instead of implying the license is fine.
import { useEffect, useState } from "react";
import CslbSignals from "@/components/CslbSignals";
import { verifyLicense } from "@/lib/useShortlistCheck";
import type { LicenseStatus } from "@/lib/contractors";

export default function LicenseLine({ licenseNumber }: { licenseNumber: string }) {
  // undefined while checking, null when the board didn't answer.
  const [license, setLicense] = useState<LicenseStatus | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    verifyLicense(licenseNumber)
      .then((l) => !cancelled && setLicense(l))
      .catch(() => !cancelled && setLicense(null));
    return () => {
      cancelled = true;
    };
  }, [licenseNumber]);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        California license {licenseNumber}
      </p>
      {license === null ? (
        <p className="mt-2 text-sm text-foreground/80">
          We couldn't reach the state license board just now, so this isn't checked yet.
        </p>
      ) : (
        <div className="mt-3">
          {/* No name cross-check: trade names and license names often differ, and this is the number they publish. */}
          <CslbSignals license={license ?? null} licenseNumber={licenseNumber} permitDisplayName={null} verifying={license === undefined} variant="card" />
          {license?.business_name && (
            <p className="mt-2 text-xs text-muted-foreground">
              On file with the state as {license.business_name.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase())}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
