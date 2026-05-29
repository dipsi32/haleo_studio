import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { Confidence } from "@/lib/aduRules";

export default function DataConfidenceBadge({
  confidence,
  gaps,
}: {
  confidence: Confidence;
  gaps?: string[];
}) {
  const map = {
    high: {
      bg: "bg-emerald-50 border-emerald-300/60 text-emerald-900",
      Icon: CheckCircle2,
      label: "Full parcel data available",
      iconColor: "text-emerald-600",
    },
    medium: {
      bg: "bg-amber-50 border-amber-300/60 text-amber-950",
      Icon: AlertCircle,
      label: "Partial data — some fields missing",
      iconColor: "text-amber-600",
    },
    low: {
      bg: "bg-rose-50 border-rose-300/60 text-rose-900",
      Icon: XCircle,
      label: "Insufficient data — cannot produce reliable feasibility",
      iconColor: "text-rose-600",
    },
  } as const;
  const { bg, Icon, label, iconColor } = map[confidence];

  return (
    <div className={`rounded-2xl border ${bg} p-4`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden />
        {label}
      </div>
      {gaps && gaps.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-6 text-[12px] leading-snug opacity-90">
          {gaps.map((g) => (
            <li key={g} className="list-disc">
              {g}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
