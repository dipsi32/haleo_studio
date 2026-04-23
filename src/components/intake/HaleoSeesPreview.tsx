// "Here's what Haleo sees" — inline preview shown right under the media
// thumbnails in the intake flow. Surfaces the grounded read so the homeowner
// can confirm it's accurate before the brief reaches a contractor.
//
// Design notes:
// - Never says "AI". Calls it "Haleo's read" / "Here's what Haleo sees".
// - Shows the summary up top, then a tight bullet list of grounded items
//   (max 6 by default), with a "See more" expander for the full read.
// - Includes a "Looks right ✓ / Something's off" confirmation pair the user
//   can tap; selection is purely local UX feedback for now (no persistence
//   needed — confirmation is implicit when they continue the flow).
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Sparkles,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Loader2,
  ThumbsUp,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpaceAnalysis } from "@/lib/spaceAnalysis";
import type { IntakeData } from "@/lib/intake";

const BASIS_META = {
  grounded: { label: "Seen", icon: Check, cls: "text-sage" },
  inferred: { label: "Likely", icon: AlertCircle, cls: "text-accent" },
  question: { label: "Open", icon: HelpCircle, cls: "text-foreground/60" },
} as const;

type Confirmation = "unset" | "ok" | "off";

const HaleoSeesPreview = ({
  intake,
  onApprove,
}: {
  intake: IntakeData;
  onApprove?: (snapshot: NonNullable<IntakeData["approvedAnalysis"]>) => void;
}) => {
  const { status, analysis, error } = useSpaceAnalysis(intake);
  const [expanded, setExpanded] = useState(false);
  // Seed confirmation from persisted approval — so revisiting Step 2 reflects the saved state
  // and we don't ask the user the same question twice.
  const approvedKey = (intake.approvedAnalysis?.mediaIds ?? []).slice().sort().join(",");
  const currentKey = intake.media
    .filter((m) => m.kind === "photo" || m.kind === "floorplan" || m.kind === "video")
    .map((m) => m.id)
    .sort()
    .join(",");
  const initialConfirmed: Confirmation =
    intake.approvedAnalysis && approvedKey === currentKey ? "ok" : "unset";
  const [confirmed, setConfirmed] = useState<Confirmation>(initialConfirmed);

  // Flatten all section items into one stream so we can show the most
  // confident reads first (grounded → inferred → question).
  const items = useMemo(() => {
    if (!analysis) return [];
    const flat = analysis.sections.flatMap((s) =>
      s.items.map((it) => ({ ...it, section: s.title })),
    );
    const order = { grounded: 0, inferred: 1, question: 2 } as const;
    return flat.sort((a, b) => order[a.basis] - order[b.basis]);
  }, [analysis]);

  // Hide entirely if there's no media yet — prompt is in the upload card.
  const analyzable = intake.media.filter(
    (m) => m.kind === "photo" || m.kind === "floorplan" || m.kind === "video",
  );
  if (analyzable.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 6);
  const hiddenCount = Math.max(0, items.length - visible.length);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border bg-secondary/40 px-5 py-4 md:px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Eye className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-medium leading-tight">
            Here's what Haleo sees
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A quick read of the space. Skim it — does it match reality?
          </p>
        </div>
        {status === "ready" && (
          <span className="hidden items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sage sm:inline-flex">
            <Sparkles className="h-3 w-3" /> Ready
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-5 md:px-6 md:py-6">
        {(status === "uploading" || status === "analyzing") && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span>
              {status === "uploading"
                ? "Uploading your photos so Haleo can take a look…"
                : "Reading the space — surfaces, light, layout, constraints…"}
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Couldn't read the space — {error ?? "try re-adding the photos."}
          </div>
        )}

        {status === "ready" && analysis && (
          <>
            {/* One-line summary, big and friendly */}
            <p className="font-display text-lg font-light leading-snug text-foreground/90 md:text-xl">
              {analysis.summary}
            </p>

            {/* Bullet read */}
            {visible.length > 0 && (
              <ul className="mt-5 grid gap-2 md:grid-cols-2">
                {visible.map((it, i) => {
                  const meta = BASIS_META[it.basis];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3"
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.cls)} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                          {it.section} · {meta.label}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-foreground/85">
                          {it.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Expand / collapse */}
            {(hiddenCount > 0 || expanded) && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-smooth hover:text-foreground"
              >
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                />
                {expanded ? "Show less" : `See ${hiddenCount} more detail${hiddenCount === 1 ? "" : "s"}`}
              </button>
            )}

            {/* Confirmation chips */}
            <AnimatePresence mode="wait">
              <motion.div
                key={confirmed}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-6 flex flex-col items-start gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"
              >
                {confirmed === "unset" && (
                  <>
                    <p className="text-sm text-foreground/80">
                      Does this look right to send to your contractor?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setConfirmed("ok")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-sage-soft px-4 py-2 text-sm font-medium text-sage transition-smooth hover:bg-sage hover:text-background"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Looks right
                      </button>
                      <button
                        onClick={() => setConfirmed("off")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground/80 transition-smooth hover:border-accent/50 hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Something's off
                      </button>
                    </div>
                  </>
                )}
                {confirmed === "ok" && (
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-sage">
                    <Check className="h-4 w-4" /> Locked in. Continue when you're ready.
                  </p>
                )}
                {confirmed === "off" && (
                  <p className="text-sm text-foreground/80">
                    Add a closer photo or a note below — Haleo will refresh the read with the new context.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.section>
  );
};

export default HaleoSeesPreview;
