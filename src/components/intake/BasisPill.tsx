// The small tag after a line of Haleo's read: "Likely", "Verify on site" or
// "Estimate". Nothing for what's plainly in the photo or what the homeowner
// said. One vocabulary on every screen (see basisTag).
import { cn } from "@/lib/utils";
import { basisTag } from "@/lib/spaceFindings";
import type { AnalysisItem } from "@/lib/brief";

const TONE = {
  estimate: "border-border bg-secondary text-foreground/70",
  likely: "border-amber-400/40 bg-amber-50 text-amber-700",
  verify: "border-sky-400/40 bg-sky-50 text-sky-700",
} as const;

export default function BasisPill({ basis, section, className }: { basis: AnalysisItem["basis"]; section?: string; className?: string }) {
  const tag = basisTag(basis, section);
  if (!tag) return null;
  return (
    <span className={cn("ml-1.5 inline-flex whitespace-nowrap rounded-full border px-1.5 py-px align-middle text-[10px] font-medium", TONE[tag.tone], className)}>
      {tag.label}
    </span>
  );
}
