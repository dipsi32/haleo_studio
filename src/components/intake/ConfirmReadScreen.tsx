// Step 3 of the intake — "Confirm what Haleo sees".
//
// Why this is its own screen (not a side panel):
// During design review we found homeowners were skipping past the read
// because it sat below the upload card and only populated after analysis
// finished. By promoting it to a real step in the flow, the read becomes
// impossible to miss — confirming it is the gate to continue.
//
// During the 5–15s analysis window we show a skeleton preview AND a live
// narration ("Looking at surfaces…", "Checking light and layout…") so the
// user has something rich to look at and feels Haleo actively working.
//
// On ready: full summary, prioritized bullets (grounded → inferred → open),
// and a binary confirmation. "Looks right" auto-advances; "Something's off"
// keeps them here with guidance to add a closer photo or note.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Sparkles,
  ThumbsUp,
  Pencil,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSpaceAnalysis } from "@/lib/spaceAnalysis";
import type { IntakeData } from "@/lib/intake";

const BASIS_META = {
  grounded: { label: "Seen", icon: Check, cls: "text-sage" },
  inferred: { label: "Likely", icon: AlertCircle, cls: "text-accent" },
  question: { label: "Open", icon: HelpCircle, cls: "text-foreground/60" },
} as const;

// A single, calm message — no looping phrases. The progress bar carries
// the sense of motion so we don't have to chatter at the user.
const NARRATION_MESSAGE = "Haleo is taking a careful look at your space.";

const SkeletonRead = ({ progress }: { progress: number }) => (
  <div aria-busy="true" aria-live="polite">
    {/* Summary skeleton */}
    <div className="space-y-3">
      <div className="h-5 w-3/4 animate-pulse rounded-full bg-secondary" />
      <div className="h-5 w-1/2 animate-pulse rounded-full bg-secondary" />
    </div>

    {/* Calm status — one warm line + a quiet progress bar */}
    <div className="mt-6 rounded-2xl border border-accent/20 bg-accent-soft/40 px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="relative grid h-7 w-7 shrink-0 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <span className="relative grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
            <Eye className="h-3.5 w-3.5" />
          </span>
        </span>
        <p className="text-sm font-medium text-foreground/85">{NARRATION_MESSAGE}</p>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-accent/15">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: "8%" }}
          animate={{ width: `${Math.min(95, progress)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Usually about 10–15 seconds.</p>
    </div>

    {/* Bullets skeleton */}
    <ul className="mt-6 grid gap-2 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3"
        >
          <div className="mt-0.5 h-4 w-4 shrink-0 animate-pulse rounded-full bg-secondary" />
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="h-2.5 w-1/3 animate-pulse rounded-full bg-secondary"
              style={{ animationDelay: `${i * 80}ms` }}
            />
            <div
              className="h-3 animate-pulse rounded-full bg-secondary"
              style={{ animationDelay: `${i * 100}ms`, width: `${70 + ((i * 7) % 25)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

type Confirmation = "unset" | "ok" | "off";

const ConfirmReadScreen = ({
  intake,
  onApprove,
  onContinue,
  onBack,
  stepDots,
}: {
  intake: IntakeData;
  onApprove: (snapshot: NonNullable<IntakeData["approvedAnalysis"]>) => void;
  onContinue: () => void;
  onBack: () => void;
  stepDots: React.ReactNode;
}) => {
  const { status, analysis, error } = useSpaceAnalysis(intake);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(8);

  // Smoothly ramp progress while loading — eases toward 95% so it never
  // claims to be done before the analysis actually returns.
  useEffect(() => {
    if (status !== "uploading" && status !== "analyzing" && status !== "idle") {
      setProgress(100);
      return;
    }
    setProgress(8);
    const id = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.max(0.5, (95 - p) * 0.06)));
    }, 350);
    return () => clearInterval(id);
  }, [status]);

  // Seed confirmation from prior approval — revisiting shouldn't re-ask.
  const currentKey = intake.media
    .filter((m) => m.kind === "photo" || m.kind === "floorplan" || m.kind === "video")
    .map((m) => m.id)
    .sort()
    .join(",");
  const approvedKey = (intake.approvedAnalysis?.mediaIds ?? []).slice().sort().join(",");
  const initialConfirmed: Confirmation =
    intake.approvedAnalysis && approvedKey === currentKey ? "ok" : "unset";
  const [confirmed, setConfirmed] = useState<Confirmation>(initialConfirmed);

  // Prioritize most-confident reads first.
  const items = useMemo(() => {
    if (!analysis) return [];
    const flat = analysis.sections.flatMap((s) =>
      s.items.map((it) => ({ ...it, section: s.title })),
    );
    const order = { grounded: 0, inferred: 1, question: 2 } as const;
    return flat.sort((a, b) => order[a.basis] - order[b.basis]);
  }, [analysis]);

  const visible = expanded ? items : items.slice(0, 6);
  const hiddenCount = Math.max(0, items.length - visible.length);

  const handleLooksRight = () => {
    setConfirmed("ok");
    if (analysis) {
      onApprove({
        summary: analysis.summary,
        sections: analysis.sections,
        approvedAt: new Date().toISOString(),
        mediaIds: currentKey ? currentKey.split(",") : [],
      });
    }
    // Auto-advance — confirmation is the gate, no extra click needed.
    setTimeout(onContinue, 450);
  };

  return (
    <div className="space-y-10">
      {stepDots}
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Step 3 of 5</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Here's what Haleo sees.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">
          A grounded read of your space. Skim it — does it match reality before we send it to a contractor?
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
        aria-live="polite"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border bg-secondary/40 px-5 py-4 md:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Eye className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-medium leading-tight">Haleo's read</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {status === "ready"
                ? "Confirm or flag anything that's off."
                : "Reading the photos you shared…"}
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
          {(status === "uploading" || status === "analyzing" || status === "idle") && (
            <SkeletonRead progress={progress} />
          )}

          {status === "error" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Couldn't read the space — {error ?? "try going back and re-adding the photos."}
            </div>
          )}

          {status === "ready" && analysis && (
            <>
              <p className="font-display text-lg font-light leading-snug text-foreground/90 md:text-xl">
                {analysis.summary}
              </p>

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

              {(hiddenCount > 0 || expanded) && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-smooth hover:text-foreground"
                >
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                  />
                  {expanded
                    ? "Show less"
                    : `See ${hiddenCount} more detail${hiddenCount === 1 ? "" : "s"}`}
                </button>
              )}
            </>
          )}
        </div>
      </motion.section>

      {/* Confirmation gate — bottom of page so it reads as the next action */}
      {status === "ready" && (
        <AnimatePresence mode="wait">
          <motion.div
            key={confirmed}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-4"
          >
            {confirmed === "unset" && (
              <>
                <p className="text-center text-sm text-foreground/80">
                  Does this look right to send to your contractor?
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={handleLooksRight}
                    size="lg"
                    className="rounded-full bg-sage px-7 text-background hover:bg-sage/90"
                  >
                    <ThumbsUp className="h-4 w-4" /> Looks right — continue
                  </Button>
                  <Button
                    onClick={() => setConfirmed("off")}
                    size="lg"
                    variant="outline"
                    className="rounded-full px-6"
                  >
                    <Pencil className="h-4 w-4" /> Something's off
                  </Button>
                </div>
              </>
            )}
            {confirmed === "ok" && (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-sage">
                <Check className="h-4 w-4" /> Locked in. Taking you to the next step…
              </p>
            )}
            {confirmed === "off" && (
              <div className="max-w-lg text-center">
                <p className="text-sm text-foreground/80">
                  Got it — go back and add a closer photo or a quick note. Haleo will refresh the read with the new context.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button onClick={onBack} size="lg" variant="outline" className="rounded-full px-6">
                    <ArrowLeft className="h-4 w-4" /> Add more context
                  </Button>
                  <Button
                    onClick={onContinue}
                    size="lg"
                    variant="ghost"
                    className="rounded-full px-6 text-muted-foreground hover:text-foreground"
                  >
                    Continue anyway
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* While loading: an honest disabled CTA so the user knows to wait */}
      {(status === "uploading" || status === "analyzing" || status === "idle") && (
        <div className="flex flex-col items-center gap-3">
          <Button size="lg" disabled className="rounded-full px-8">
            Reading your space…
          </Button>
          <p className="text-xs text-muted-foreground">Usually 10–15 seconds.</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3">
          <Button onClick={onContinue} size="lg" variant="outline" className="rounded-full px-8">
            Continue without the read
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConfirmReadScreen;
