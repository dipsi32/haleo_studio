import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Loader2, Ruler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import SiteHeader from "@/components/SiteHeader";
import AduDisclaimer from "@/components/adu/AduDisclaimer";
import DataConfidenceBadge from "@/components/adu/DataConfidenceBadge";
import BuildableDiagram from "@/components/adu/BuildableDiagram";
import AduContractorMatch from "@/components/adu/AduContractorMatch";
import { track } from "@/lib/analytics";
import type { Confidence } from "@/lib/aduRules";

type Step = "address" | "feasibility" | "diagram" | "contractors";

interface ParcelData {
  apn: string | null;
  lot_size_sqft: number | null;
  lot_width_ft: number | null;
  lot_depth_ft: number | null;
  zoning: string | null;
  primary_dwelling_sqft: number | null;
  existing_footprints_sqft: number | null;
  open_permits: Array<{ permit_number: string | null; type: string | null; status: string | null }>;
  violations: Array<{ type?: string | null; date?: string | null }>;
  fire_hazard_zone: boolean | null;
  zip: string | null;
}

interface FeasibilityResponse {
  result: {
    feasible: boolean;
    confidence: Confidence;
    data_gaps: string[];
    adu_types_allowed: Array<{ type: string; max_size_sqft: number | null; note: string }>;
    max_size_sqft: number | null;
    setbacks: { rear: number; sides: number; front: string };
    height_limit_ft: number;
    height_note: string;
    lot_coverage_status: "within_limit" | "approaching_limit" | "unknown";
    fire_hazard_zone: boolean | null;
    open_permits: ParcelData["open_permits"];
    violations: ParcelData["violations"];
    school_impact_fee_applies: boolean;
    cost_range: { min: number; max: number; source: "cost_guide" } | null;
    flags: string[];
  };
  explanation: string | null;
}

const SAN_JOSE_HINT = "Currently San Jose only.";

export default function ADU() {
  const [step, setStep] = useState<Step>("address");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parcel, setParcel] = useState<ParcelData | null>(null);
  const [feasibility, setFeasibility] = useState<FeasibilityResponse | null>(null);

  useEffect(() => {
    track("adu_started");
  }, []);

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!street.trim()) {
      setError("Please enter a street address.");
      return;
    }
    setLoading(true);
    track("adu_address_submitted", { has_zip: !!zip });

    try {
      const address = { street: street.trim(), city: "San Jose", state: "CA", zip: zip.trim() || undefined };

      const [parcelRes, riskRes] = await Promise.all([
        supabase.functions.invoke("lookup-parcel-history", { body: { address } }),
        supabase.functions.invoke("lookup-address-risk", { body: { address } }),
      ]);

      const historyRaw = (parcelRes.data as { history?: Record<string, unknown> } | null)?.history;
      const history = (historyRaw ?? {}) as Record<string, unknown>;
      const signalsRaw = (riskRes.data as { signals?: Record<string, unknown> } | null)?.signals;
      const signals = (signalsRaw ?? {}) as Record<string, unknown>;

      const apn = (history.apn as string | null) ?? null;
      const geocoded = signals.lat != null && signals.lng != null;

      // Hard-block only when we can't even geocode the address. If geocoding
      // succeeded (San Jose address confirmed) but no APN — proceed with low
      // confidence and surface the gap honestly via the badge.
      if (!apn && !geocoded) {
        track("adu_parcel_failed", { reason: "no_apn_no_geocode" });
        setError(
          "We couldn't find or geocode this address. Double-check the spelling, or it may be outside our current coverage area (San Jose only today).",
        );
        setLoading(false);
        return;
      }

      // FHSZ — true if cal fire returned any non-empty class.
      const fhszClass = (signals.fire_hazard_class as string | null) ?? null;
      const fhszZone = (signals.fire_hazard_zone as string | null) ?? null;
      const fhsz: boolean | null =
        fhszClass || fhszZone ? /high|very high|moderate/i.test(`${fhszClass} ${fhszZone}`) : null;

      const permitsArr = Array.isArray(history.permits) ? (history.permits as Array<Record<string, unknown>>) : [];
      const openPermits = permitsArr
        .filter((p) => p.is_open === true || p.is_expired_without_final === true)
        .slice(0, 10)
        .map((p) => ({
          permit_number: (p.permit_number as string | null) ?? null,
          type: (p.type as string | null) ?? null,
          status: (p.status as string | null) ?? null,
        }));

      const violationsArr = Array.isArray(history.violations) ? (history.violations as Array<Record<string, unknown>>) : [];
      const violations = violationsArr.map((v) => ({
        type: Array.isArray(v.violation_types) ? (v.violation_types as string[]).join(", ") : null,
        date: (v.most_recent_open_date as string | null) ?? null,
      }));

      // Lot size / zoning / dwelling sqft are not in the parcel history feed
      // today — surface as null and let the confidence system flag the gap.
      const parcelData: ParcelData = {
        apn,
        lot_size_sqft: null,
        lot_width_ft: null,
        lot_depth_ft: null,
        zoning: null,
        primary_dwelling_sqft: null,
        existing_footprints_sqft: null,
        open_permits: openPermits,
        violations,
        fire_hazard_zone: fhsz,
        zip: zip.trim() || (history.zip as string | null) || null,
      };
      setParcel(parcelData);
      track("adu_parcel_resolved", { apn });

      // Call feasibility edge function
      const { data: feas, error: feasErr } = await supabase.functions.invoke("check-adu-feasibility", {
        body: {
          apn: parcelData.apn,
          lot_size_sqft: parcelData.lot_size_sqft,
          zoning: parcelData.zoning,
          primary_dwelling_sqft: parcelData.primary_dwelling_sqft,
          existing_footprints_sqft: parcelData.existing_footprints_sqft,
          open_permits: parcelData.open_permits,
          violations: parcelData.violations,
          fire_hazard_zone: parcelData.fire_hazard_zone,
          zip: parcelData.zip,
        },
      });
      if (feasErr) throw feasErr;
      setFeasibility(feas as FeasibilityResponse);
      track("adu_feasibility_completed", {
        confidence: (feas as FeasibilityResponse)?.result?.confidence ?? "unknown",
      });
      setStep("feasibility");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-xl px-4 pb-24 pt-28">
        <header className="mb-6">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> ADU feasibility
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight">
            Can you build an ADU on your lot?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We check San Jose zoning, AB 2221 rules, your permit history, and fire-hazard zones —
            then show what's actually allowed.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {step === "address" && (
            <motion.section
              key="address"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <form onSubmit={handleAddressSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <div className="space-y-2">
                  <label htmlFor="adu-street" className="text-sm font-medium">
                    Property address
                  </label>
                  <Input
                    id="adu-street"
                    placeholder="1234 Main St"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    autoComplete="street-address"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="adu-zip" className="text-sm font-medium">
                    ZIP code <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="adu-zip"
                    placeholder="95110"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    inputMode="numeric"
                  />
                </div>
                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900">
                    {error}{" "}
                    <Link to="/waitlist" className="underline">
                      Join the waitlist
                    </Link>{" "}
                    and we'll notify you as coverage expands.
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition-smooth disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {loading ? "Checking parcel records…" : "Check feasibility"}
                </button>
                <p className="text-[12px] text-muted-foreground">{SAN_JOSE_HINT}</p>
              </form>
              {loading ? <Skeleton className="h-32 w-full rounded-2xl" /> : null}
            </motion.section>
          )}

          {step === "feasibility" && feasibility && parcel ? (
            <FeasibilityView
              key="feas"
              feasibility={feasibility}
              parcel={parcel}
              onBack={() => setStep("address")}
              onNext={() => setStep("diagram")}
            />
          ) : null}

          {step === "diagram" && feasibility && parcel ? (
            <motion.section
              key="diagram"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
              onAnimationStart={() => track("adu_diagram_viewed")}
            >
              <BuildableDiagram
                lotWidthFt={parcel.lot_width_ft}
                lotDepthFt={parcel.lot_depth_ft}
                setbacks={feasibility.result.setbacks}
                maxAduSqft={feasibility.result.max_size_sqft}
              />
              <NavRow onBack={() => setStep("feasibility")} onNext={() => setStep("contractors")} nextLabel="See ADU contractors" />
            </motion.section>
          ) : null}

          {step === "contractors" && parcel ? (
            <motion.section
              key="contractors"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <h2 className="font-display text-xl tracking-tight">ADU contractors in your zip</h2>
              <p className="text-sm text-muted-foreground">
                These contractors have pulled ADU permits near you — verified from city records, not reviews.
              </p>
              <AduContractorMatch zip={parcel.zip} />
              <NavRow onBack={() => setStep("diagram")} />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}

function FeasibilityView({
  feasibility,
  parcel,
  onBack,
  onNext,
}: {
  feasibility: FeasibilityResponse;
  parcel: ParcelData;
  onBack: () => void;
  onNext: () => void;
}) {
  const { result, explanation } = feasibility;
  const canShowDiagram = result.confidence !== "low" && parcel.lot_width_ft != null && parcel.lot_depth_ft != null;
  const fmtMoney = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    [],
  );

  return (
    <motion.section
      key="feas"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <AduDisclaimer />

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Verdict</p>
        <p className="mt-1 font-display text-2xl tracking-tight">
          {result.feasible ? "An ADU looks feasible here." : "We can't confirm feasibility for this lot yet."}
        </p>
        {explanation ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{explanation}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Plain-English summary unavailable. Raw rules below still apply.
          </p>
        )}
      </div>

      <DataConfidenceBadge confidence={result.confidence} gaps={result.data_gaps} />

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">ADU types allowed</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {result.adu_types_allowed.map((a) => (
            <li key={a.type} className="border-l-2 border-amber-400 pl-3">
              <p className="font-medium capitalize">
                {a.type.replace("_", " ")}{" "}
                {a.max_size_sqft ? (
                  <span className="text-muted-foreground">— up to {a.max_size_sqft} sqft</span>
                ) : null}
              </p>
              <p className="text-[13px] text-muted-foreground">{a.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile label="Setbacks">
          <p>Rear: {result.setbacks.rear}ft</p>
          <p>Sides: {result.setbacks.sides}ft</p>
          <p>{result.setbacks.front}</p>
        </Tile>
        <Tile label={`Height limit — ${result.height_limit_ft}ft`}>
          <p className="text-[12px] text-muted-foreground">{result.height_note}</p>
        </Tile>
      </div>

      {result.cost_range ? (
        <Tile label="Estimated cost range">
          <p className="font-display text-xl">
            {fmtMoney.format(result.cost_range.min)} – {fmtMoney.format(result.cost_range.max)}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Estimated range based on recent San Jose permit data — actual costs vary significantly by design,
            contractor, and site conditions.
          </p>
        </Tile>
      ) : (
        <Tile label="Estimated cost range">
          <p className="text-sm text-muted-foreground">Cost data unavailable for this address.</p>
        </Tile>
      )}

      {result.flags.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Things to know</p>
          <ul className="mt-2 space-y-2 text-[13px] text-amber-950">
            {result.flags.map((f, i) => (
              <li key={i} className="list-disc pl-1 marker:text-amber-600">
                {f}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <NavRow
        onBack={onBack}
        onNext={onNext}
        nextLabel={canShowDiagram ? "See where your ADU could go" : "See approximate buildable area"}
        nextIcon={<Ruler className="h-4 w-4" />}
      />
    </motion.section>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextIcon,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-smooth hover:bg-secondary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-smooth"
        >
          {nextIcon ?? <ArrowRight className="h-4 w-4" />} {nextLabel}
        </button>
      ) : null}
    </div>
  );
}
