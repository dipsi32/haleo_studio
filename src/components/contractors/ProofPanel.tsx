// A contractor's record, shown to a homeowner. Built only from public permit
// and license records, counted by city (not zip): familiarity with a city's
// inspection and permit process is what a homeowner is really buying.
// Haleo does not rate or endorse contractors, and this panel says so.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CheckCircle2, Hammer, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CslbSignals from "@/components/CslbSignals";
import { cslbDeepLink, type LicenseStatus } from "@/lib/contractors";
import { toLicenseStatus } from "@/lib/useContractors";
import { summarizeProof, type ProofPermit } from "@/lib/proof";

const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;

type Loaded = {
  name: string;
  slug: string | null;
  licenseNumber: string;
  permits: ProofPermit[];
  license: LicenseStatus | null;
  signals: {
    open_code_violations: number;
    addresses_with_violations: number;
    addresses_checked: number;
  } | null;
};

type Props = {
  contractorId: string;
  /** The homeowner's city. Falls back to the contractor's own city. */
  city?: string | null;
  /** Permit keywords for "similar to your project". Omit to hide that line. */
  keywords?: string[];
  variant?: "compact" | "full";
};

export default function ProofPanel({ contractorId, city, keywords, variant = "full" }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [cityUsed, setCityUsed] = useState<string | null>(city ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: c } = await supabase
          .from("contractors")
          .select("id, name, company, slug, license_number, city")
          .eq("id", contractorId)
          .maybeSingle();
        if (!c) {
          if (!cancelled) setFailed(true);
          return;
        }
        const [{ data: permits }, { data: lic }, { data: legacy }, { data: sig }] = await Promise.all([
          supabase
            .from("contractor_permits")
            .select("city, issued_date, completed_date, work_type, description")
            .eq("contractor_id", contractorId)
            .order("issued_date", { ascending: false })
            .limit(1000),
          supabase.from("cslb_licenses").select("*").eq("license_number", c.license_number).maybeSingle(),
          supabase.from("contractor_license_cache").select("*").eq("license_number", c.license_number).maybeSingle(),
          supabase
            .from("contractor_trust_signals")
            .select("open_code_violations, addresses_with_violations, addresses_checked")
            .eq("contractor_id", contractorId)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const license: LicenseStatus | null = lic
          ? toLicenseStatus(lic)
          : legacy
            ? {
                license_number: legacy.license_number,
                status: legacy.status,
                business_name: legacy.business_name,
                classifications: legacy.classifications,
                issue_date: legacy.issue_date,
                expiration_date: legacy.expiration_date,
                has_disciplinary_action: !!legacy.has_disciplinary_action,
                disciplinary_notes: legacy.disciplinary_notes,
                workers_comp_status: legacy.workers_comp_status,
                bond_status: legacy.bond_status,
                scrape_succeeded: !!legacy.scrape_succeeded,
                last_checked_at: legacy.last_checked_at,
                deep_link: cslbDeepLink(legacy.license_number),
              }
            : null;
        setCityUsed(city ?? c.city ?? null);
        setLoaded({
          name: c.company?.trim() || c.name,
          slug: c.slug,
          licenseNumber: c.license_number,
          permits: (permits ?? []) as ProofPermit[],
          license,
          signals: sig ?? null,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractorId, city]);

  if (failed) return null;
  if (!loaded) {
    return <div className="h-40 animate-pulse rounded-3xl border border-border bg-card/60" aria-label="Loading contractor record" />;
  }

  const summary = summarizeProof(loaded.permits, cityUsed, keywords ?? []);
  const where = cityUsed ?? "your area";
  const signals = loaded.signals;
  const initials = loaded.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-7" aria-label={`${loaded.name} public record`}>
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-medium text-accent-soft-foreground">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg">{loaded.name}</p>
          <p className="text-[13px] text-muted-foreground">CSLB #{loaded.licenseNumber} · Public record</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3 text-[15px]">
        {summary.inCity > 0 ? (
          <>
            <li className="flex items-start gap-3">
              <Hammer className="mt-[3px] h-[17px] w-[17px] shrink-0 text-accent" />
              <span>
                <strong className="font-medium">{summary.inCity}</strong> permit{summary.inCity === 1 ? "" : "s"} in {where}
                {summary.firstIssued && summary.lastIssued ? ` between ${monthYear(summary.firstIssued)} and ${monthYear(summary.lastIssued)}` : ""}
              </span>
            </li>
            {keywords && keywords.length > 0 && (
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-[3px] h-[17px] w-[17px] shrink-0 text-sage" />
                <span>
                  <strong className="font-medium">{summary.similar}</strong> similar to your kind of project
                </span>
              </li>
            )}
            {variant === "full" && summary.finaled > 0 && (
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-[3px] h-[17px] w-[17px] shrink-0 text-sage" />
                <span>
                  <strong className="font-medium">{summary.finaled}</strong> closed out with the city
                </span>
              </li>
            )}
            {variant === "full" && summary.lastIssued && (
              <li className="flex items-start gap-3">
                <Calendar className="mt-[3px] h-[17px] w-[17px] shrink-0 text-accent" />
                <span>Most recent permit: {monthYear(summary.lastIssued)}</span>
              </li>
            )}
          </>
        ) : (
          <li className="text-muted-foreground">
            No permits in {where} in the records we have yet. That doesn't mean the work hasn't been done, so ask for recent jobs.
          </li>
        )}
        {variant === "full" && signals && signals.addresses_checked > 0 && (
          <li className="flex items-start gap-3">
            <ShieldCheck className="mt-[3px] h-[17px] w-[17px] shrink-0 text-sage" />
            <span>
              {signals.open_code_violations === 0
                ? `No open code violations at ${signals.addresses_checked} checked job address${signals.addresses_checked === 1 ? "" : "es"}`
                : `${signals.open_code_violations} open code violation${signals.open_code_violations === 1 ? "" : "s"} across ${signals.addresses_with_violations} of ${signals.addresses_checked} checked addresses`}
            </span>
          </li>
        )}
      </ul>

      {variant === "full" && (
        <div className="mt-5 border-t border-border pt-5">
          <CslbSignals
            license={loaded.license}
            licenseNumber={loaded.licenseNumber}
            permitDisplayName={loaded.name}
            variant="card"
          />
        </div>
      )}

      <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
        From public city permit and state license records, which can lag. Haleo doesn't rate or endorse contractors.
        {loaded.slug && (
          <>
            {" "}
            <Link to={`/pro/${loaded.slug}`} className="text-foreground underline underline-offset-4 hover:text-accent">
              See the full record
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
