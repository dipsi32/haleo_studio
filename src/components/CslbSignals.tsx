// CSLB signal display — license badge, bond/WC pills, disciplinary flag,
// and tenure + name-match. Every signal has a plain-language tooltip.
import { Link2, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LicenseStatus } from "@/lib/contractors";
import {
  evaluateLicense,
  evaluateBond,
  evaluateWorkersComp,
  evaluateDiscipline,
  evaluateNameMatch,
  EXPLAIN,
  type CoverageStatus,
  type LicenseTone,
} from "@/lib/cslbSignals";

const licenseToneClasses = (tone: LicenseTone) => {
  switch (tone) {
    case "active":
      return "bg-sage/15 text-sage border-sage/30";
    case "expiring":
      return "bg-accent/15 text-accent border-accent/30";
    case "expired":
    case "suspended":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const InfoTip = ({ children }: { children: React.ReactNode }) => (
  <Tooltip delayDuration={120}>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex h-3.5 w-3.5 items-center justify-center text-current/60 hover:text-current"
        aria-label="What does this mean?"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
      {children}
    </TooltipContent>
  </Tooltip>
);

const CoveragePill = ({
  status,
  verifiedLabel,
  missingLabel,
  unknownLabel,
  explanation,
}: {
  status: CoverageStatus;
  verifiedLabel: string;
  missingLabel: string;
  unknownLabel: string;
  explanation: string;
}) => {
  const classes =
    status === "verified"
      ? "bg-sage/15 text-sage border-sage/30"
      : status === "missing"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : "bg-muted text-muted-foreground border-border";
  const label = status === "verified" ? verifiedLabel : status === "missing" ? missingLabel : unknownLabel;
  const Icon = status === "verified" ? CheckCircle2 : status === "missing" ? XCircle : ShieldCheck;
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${classes}`}
        >
          <Icon className="h-3 w-3" /> {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
};

export type CslbSignalsProps = {
  license: LicenseStatus | null;
  licenseNumber: string;
  permitDisplayName: string | null;
  variant?: "card" | "profile";
  /** True while a Firecrawl verification is in flight — shows a loading state. */
  verifying?: boolean;
  onDisciplineClick?: () => void;
};

const CslbSignals = ({
  license,
  licenseNumber,
  permitDisplayName,
  variant = "card",
  verifying = false,
  onDisciplineClick,
}: CslbSignalsProps) => {
  // Loading state — shown when we have no license data yet AND a verify call is in flight.
  if (verifying && !license) {
    return (
      <div className={variant === "card" ? "space-y-2.5" : "space-y-4"}>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verifying license with CSLB…
        </span>
      </div>
    );
  }

  const lic = evaluateLicense(license);
  const bond = evaluateBond(license);
  const wc = evaluateWorkersComp(license);
  const discipline = evaluateDiscipline(license);
  const nameMatch = evaluateNameMatch(license, permitDisplayName);

  const isUnverified = lic.tone === "unknown";
  const licenseExplain =
    lic.tone === "active" ? EXPLAIN.active
    : lic.tone === "expiring" ? EXPLAIN.expiring
    : lic.tone === "expired" ? EXPLAIN.expired
    : lic.tone === "suspended" ? EXPLAIN.suspended
    : EXPLAIN.unverified;

  return (
    <TooltipProvider>
      <div className={variant === "card" ? "space-y-2.5" : "space-y-4"}>
        {/* 1. License badge — only when verified (active/expiring/expired/suspended) */}
        {!isUnverified && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip delayDuration={120}>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${licenseToneClasses(lic.tone)}`}
                  >
                    {lic.tone === "active" ? <ShieldCheck className="h-3.5 w-3.5" />
                      : lic.tone === "expiring" ? <AlertTriangle className="h-3.5 w-3.5" />
                      : <ShieldAlert className="h-3.5 w-3.5" />}
                    {lic.badgeLabel}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {licenseExplain}
                </TooltipContent>
              </Tooltip>
            </div>
            {lic.classifications.length > 0 && (
              <p className="mt-1.5 text-xs text-foreground/75">
                {lic.classifications.slice(0, 4).join(" · ")}
                {lic.classifications.length > 4 && ` +${lic.classifications.length - 4} more`}
              </p>
            )}
            {lic.expirationLabel && (
              <p
                className={`mt-1 text-[11px] ${
                  lic.tone === "expiring" ? "text-accent font-medium"
                  : lic.tone === "expired" || lic.tone === "suspended" ? "text-destructive font-medium"
                  : "text-muted-foreground"
                }`}
              >
                {lic.expirationLabel}
              </p>
            )}
          </div>
        )}

        {/* 2. Bond + Workers' Comp — only when verified or explicitly missing (hide "unknown") */}
        {(bond !== "unknown" || wc !== "unknown") && (
          <div className="flex flex-wrap items-center gap-1.5">
            {bond !== "unknown" && (
              <CoveragePill
                status={bond}
                verifiedLabel="Bonded ✓"
                missingLabel="Not bonded"
                unknownLabel="Bond not verified"
                explanation={EXPLAIN.bond}
              />
            )}
            {wc !== "unknown" && (
              <CoveragePill
                status={wc}
                verifiedLabel="Workers' Comp ✓"
                missingLabel="No Workers' Comp on file"
                unknownLabel="Workers' Comp not verified"
                explanation={EXPLAIN.workersComp}
              />
            )}
          </div>
        )}

        {/* 3. Disciplinary history */}
        {discipline.known && discipline.hasRecord ? (
          <button
            type="button"
            onClick={onDisciplineClick}
            className="flex w-full items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive transition hover:bg-destructive/15"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong className="font-semibold">CSLB has complaints on record</strong> — tap to review before contacting.
              {discipline.notes && variant === "profile" && (
                <span className="mt-1 block font-normal text-destructive/85">{discipline.notes}</span>
              )}
            </span>
          </button>
        ) : discipline.known ? (
          <Tooltip delayDuration={120}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-sage/30 bg-sage/15 px-2.5 py-0.5 text-[11px] font-medium text-sage">
                <CheckCircle2 className="h-3 w-3" /> No complaints on record ✓
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {EXPLAIN.discipline}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {/* 4. Tenure + business name match */}
        {(lic.yearsLicensed !== null || nameMatch.status !== "unknown") && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {lic.yearsLicensed !== null && (
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Licensed for {lic.yearsLicensed} year{lic.yearsLicensed === 1 ? "" : "s"}
              </span>
            )}
            {nameMatch.status === "match" && (
              <Tooltip delayDuration={120}>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1 text-sage">
                    <CheckCircle2 className="h-3 w-3" /> Business name verified ✓
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {EXPLAIN.nameMatch}
                </TooltipContent>
              </Tooltip>
            )}
            {nameMatch.status === "mismatch" && (
              <Tooltip delayDuration={120}>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1 text-accent font-medium">
                    <AlertTriangle className="h-3 w-3" /> Business name mismatch — verify before hiring
                    <InfoTip>{EXPLAIN.nameMatch}</InfoTip>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  CSLB record: <strong>{nameMatch.cslbName}</strong>
                  <br />
                  Permits filed under: <strong>{nameMatch.permitName}</strong>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default CslbSignals;
