// Inline form shown on the feasibility screen when public data sources didn't
// resolve all the inputs needed for a high-confidence verdict. Lets the
// homeowner self-serve the gaps in ~30s instead of bouncing off the page.
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface DataGapValues {
  lot_size_sqft: number | null;
  primary_dwelling_sqft: number | null;
  zoning: string | null;
  fire_hazard_zone: boolean | null;
}

export interface AduDataGapFormProps {
  gaps: string[];
  initial?: Partial<DataGapValues>;
  submitting?: boolean;
  onSubmit: (values: DataGapValues) => void;
}

function gapKey(g: string): keyof DataGapValues | null {
  const l = g.toLowerCase();
  if (l.includes("lot size")) return "lot_size_sqft";
  if (l.includes("primary dwelling")) return "primary_dwelling_sqft";
  if (l.includes("zoning")) return "zoning";
  if (l.includes("fire hazard")) return "fire_hazard_zone";
  return null;
}

export default function AduDataGapForm({ gaps, initial, submitting, onSubmit }: AduDataGapFormProps) {
  const needed = new Set(gaps.map(gapKey).filter(Boolean) as Array<keyof DataGapValues>);
  const [lot, setLot] = useState<string>(initial?.lot_size_sqft?.toString() ?? "");
  const [dwelling, setDwelling] = useState<string>(initial?.primary_dwelling_sqft?.toString() ?? "");
  const [zoning, setZoning] = useState<string>(initial?.zoning ?? "");
  const [fhsz, setFhsz] = useState<"yes" | "no" | "unsure" | null>(
    initial?.fire_hazard_zone === true ? "yes" : initial?.fire_hazard_zone === false ? "no" : null,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      lot_size_sqft: lot.trim() ? Math.round(Number(lot)) : null,
      primary_dwelling_sqft: dwelling.trim() ? Math.round(Number(dwelling)) : null,
      zoning: zoning.trim() || null,
      fire_hazard_zone: fhsz === "yes" ? true : fhsz === "no" ? false : null,
    });
  }

  if (needed.size === 0) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-amber-300/70 bg-amber-50/60 p-5"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-amber-700" />
        <div>
          <p className="text-sm font-semibold text-amber-950">Help us sharpen this estimate</p>
          <p className="mt-1 text-[13px] text-amber-900/90">
            We couldn't pull a few fields from public records. Fill what you know — even one value
            bumps confidence. You can find lot size and dwelling sqft on Zillow, Redfin, or your
            property tax bill.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {needed.has("lot_size_sqft") ? (
          <Field label="Lot size (sqft)">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 6000"
              value={lot}
              onChange={(e) => setLot(e.target.value.replace(/[^\d]/g, ""))}
            />
          </Field>
        ) : null}

        {needed.has("primary_dwelling_sqft") ? (
          <Field label="Primary dwelling size (sqft)">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 1450"
              value={dwelling}
              onChange={(e) => setDwelling(e.target.value.replace(/[^\d]/g, ""))}
            />
          </Field>
        ) : null}

        {needed.has("zoning") ? (
          <Field label="Zoning code (optional)">
            <Input
              placeholder="e.g. R-1-8"
              value={zoning}
              onChange={(e) => setZoning(e.target.value.toUpperCase())}
            />
          </Field>
        ) : null}

        {needed.has("fire_hazard_zone") ? (
          <Field label="Is the property in a Fire Hazard Severity Zone?">
            <div className="flex gap-2">
              {(["yes", "no", "unsure"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFhsz(v)}
                  className={`flex-1 rounded-full border px-3 py-2 text-[13px] capitalize transition-smooth ${
                    fhsz === v
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-amber-900/70">
              Check{" "}
              <a
                href="https://egis.fire.ca.gov/FHSZ/"
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                Cal Fire's FHSZ viewer
              </a>{" "}
              if you're not sure.
            </p>
          </Field>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-amber-700 px-5 text-sm font-medium text-white transition-smooth disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Rechecking…" : "Recheck feasibility"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-amber-950">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
