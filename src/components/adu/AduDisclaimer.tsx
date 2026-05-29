import { AlertTriangle } from "lucide-react";

/** Non-dismissible disclaimer — must appear above the fold on every result screen. */
export default function AduDisclaimer({ variant = "default" }: { variant?: "default" | "diagram" }) {
  const copy =
    variant === "diagram"
      ? "This diagram is a simplified estimate based on parcel records. Actual buildable area may differ due to easements, utilities, protected trees, or site conditions not captured in public data. Consult a licensed architect or the San Jose Planning Department for precise site analysis."
      : "This analysis is based on public parcel and permit data and is intended as an informed starting point only. Zoning rules, easements, HOA restrictions, and site conditions may affect what's actually buildable. Always verify with San Jose's Planning Department before making any decisions.";

  return (
    <div
      role="note"
      className="flex gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-950"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p className="m-0">{copy}</p>
    </div>
  );
}
