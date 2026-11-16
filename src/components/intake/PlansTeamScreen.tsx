// Bigger jobs only: who's on the team, and the floor plans. A contractor
// can't size an addition or a layout change without them, so plans are the
// one thing we ask for firmly, with an honest way out ("I'd rather not share").
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { filesToAssets, type IntakeData, type MediaAsset } from "@/lib/intake";
import type { TeamAnswer } from "@/lib/bigJob";

const ANSWERS: { value: TeamAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "looking", label: "Not yet, looking" },
  { value: "no", label: "No" },
];

const Ask = ({ q, hint, value, onPick }: { q: string; hint: string; value?: TeamAnswer; onPick: (v: TeamAnswer) => void }) => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
    <p className="text-[16px] font-medium">{q}</p>
    <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {ANSWERS.map((a) => (
        <button
          key={a.value}
          type="button"
          aria-pressed={value === a.value}
          onClick={() => onPick(a.value)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm transition-smooth",
            value === a.value ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary",
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  </div>
);

type Props = {
  data: IntakeData;
  onUpdate: (p: Partial<IntakeData>) => void;
  onAddMedia: (m: MediaAsset[]) => void;
  onContinue: () => void;
  stepDots: React.ReactNode;
};

export default function PlansTeamScreen({ data, onUpdate, onAddMedia, onContinue, stepDots }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const plans = data.media.filter((m) => m.kind === "floorplan");
  const ready = plans.length > 0 || !!data.plansSkipped;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-28">
      {stepDots}
      <div className="text-center">
        <h1 className="mt-3 font-display text-2xl font-light leading-tight text-balance md:text-3xl">Plans and your team</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Bigger jobs go faster when contractors can see what's planned. This is what lets them give you a real number.
        </p>
      </div>

      <Ask
        q="Are you working with an architect?"
        hint="They draw the plans the city approves."
        value={data.architect}
        onPick={(architect) => onUpdate({ architect })}
      />
      <Ask
        q="And a designer?"
        hint="For layout, finishes and how it all comes together."
        value={data.designer}
        onPick={(designer) => onUpdate({ designer })}
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-[16px] font-medium">Your floor plans</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Architect's drawings, an old permit set, or a phone photo of a sketch. Whatever you have is a big help.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            setBusy(true);
            try {
              onAddMedia(await filesToAssets(files, "floorplan"));
              onUpdate({ plansSkipped: false });
              track("plans_added", { count: files.length });
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
        {plans.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[14px]">
                <FileText className="h-4 w-4 text-accent" /> <span className="truncate">{p.name}</span>
                <Check className="ml-auto h-4 w-4 text-sage" />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/25 px-4 py-5 text-[15px] font-medium transition-smooth hover:border-foreground/50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {plans.length ? "Add more plans" : "Add floor plans"}
        </button>
        {plans.length === 0 && (
          <button
            type="button"
            onClick={() => {
              onUpdate({ plansSkipped: !data.plansSkipped });
              if (!data.plansSkipped) track("plans_skipped", {});
            }}
            className={cn("mt-3 text-[13px] underline-offset-4 hover:underline", data.plansSkipped ? "text-foreground" : "text-muted-foreground")}
          >
            {data.plansSkipped ? "✓ I'd rather not share plans right now" : "I'd rather not share plans right now"}
          </button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{ready ? "That's everything. Your brief is next." : "Add your plans, or tell us you'd rather not."}</p>
          <Button onClick={onContinue} disabled={!ready} className="rounded-full px-6">
            See my brief <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
