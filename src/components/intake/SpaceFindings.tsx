// What Haleo noticed in the homeowner's photos: the good news first, then
// what's worth a closer look. Each finding says why it matters and what to
// do, points to the photo it came from, and says where it came from.
import { useState } from "react";
import { ArrowRight, Check, CircleHelp, Eye, Lightbulb, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { groupForHomeowner, type Finding } from "@/lib/spaceFindings";

const SOURCE: Record<Finding["basis"], { label: string; cls: string }> = {
  grounded: { label: "In your photo", cls: "border-sage/30 bg-sage/10 text-sage" },
  inferred: { label: "Our inference", cls: "border-amber-400/40 bg-amber-50 text-amber-700" },
  question: { label: "Worth asking", cls: "border-border bg-secondary text-foreground/70" },
};

const GROUPS = [
  {
    key: "working" as const,
    title: "What looks good",
    icon: Check,
    iconCls: "bg-sage-soft text-sage",
  },
  {
    key: "attention" as const,
    title: "Worth a closer look",
    icon: Eye,
    iconCls: "bg-accent-soft text-accent",
  },
  {
    key: "check" as const,
    title: "Questions to ask your contractor",
    icon: CircleHelp,
    iconCls: "bg-secondary text-foreground/70",
  },
];

const FindingCard = ({ f }: { f: Finding }) => {
  const source = SOURCE[f.basis];
  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-background/60 p-3.5">
      {f.photo_url && (
        <a
          href={f.photo_url}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("space_finding_photo_opened", { kind: f.kind })}
          className="shrink-0"
          aria-label={`Open the photo for: ${f.title}`}
        >
          <img
            src={f.photo_url}
            alt=""
            loading="lazy"
            className="h-16 w-16 rounded-xl border border-border object-cover md:h-20 md:w-20"
          />
        </a>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">
          {f.title}
          <span
            className={cn(
              "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 align-middle text-[10px] font-medium",
              source.cls,
            )}
          >
            {source.label}
          </span>
        </p>
        {f.detail && <p className="mt-1 text-sm leading-relaxed text-foreground/75">{f.detail}</p>}
        {f.why && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/70">Why it matters: </span>
            {f.why}
          </p>
        )}
        {f.next_step && (
          <p className="mt-1.5 inline-flex items-start gap-1.5 text-[13px] leading-relaxed text-foreground/85">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>{f.next_step}</span>
          </p>
        )}
      </div>
    </li>
  );
};

export const SpaceFindings = ({ findings }: { findings: Finding[] }) => {
  const groups = groupForHomeowner(findings);
  const shown = GROUPS.filter((g) => groups[g.key].length > 0);
  if (shown.length === 0) return null;
  return (
    <div className="mt-6 space-y-6">
      {shown.map((g) => {
        const Icon = g.icon;
        return (
          <section key={g.key}>
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/60">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full", g.iconCls)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {g.title}
            </h3>
            <ul className="mt-3 grid gap-2.5">
              {groups[g.key].map((f, i) => (
                <FindingCard key={`${g.key}-${i}`} f={f} />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        <Lightbulb className="mr-1 inline h-3.5 w-3.5 text-accent" />
        Your contractor gets these too, with what to check on site. Haleo reads photos, not walls: anything
        hidden is a question, not a fact.
      </p>
    </div>
  );
};

/** Notes such as "1 photo was too large to read". */
export const ReadNotes = ({ notes }: { notes?: string[] }) => {
  if (!notes?.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-xs text-foreground/75">
      {notes.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
};

/** A failed read, in plain words, with a way forward. */
export const ReadError = ({ message, onRetry }: { message: string | null; onRetry: () => void }) => (
  <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
    <p className="text-foreground/85">{message ?? "Haleo couldn't read your photos this time. Try again in a moment."}</p>
    <p className="mt-1 text-xs text-muted-foreground">Your photos are saved. Nothing you entered is lost.</p>
    <Button
      onClick={() => {
        track("space_read_retried");
        onRetry();
      }}
      size="sm"
      className="mt-3 rounded-full px-5"
    >
      <RotateCcw className="h-3.5 w-3.5" /> Try again
    </Button>
  </div>
);

/** Interior design ideas: not built yet, so it says so, and counts who wants it. */
export const DesignIdeasTeaser = ({ room }: { room?: string }) => {
  const [asked, setAsked] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (!asked) track("design_ideas_interest", { room: room ?? null });
        setAsked(true);
      }}
      className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-background/40 p-3.5 text-left transition-smooth hover:border-accent/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Palette className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">Design ideas for this room</span>
        <span className="block text-xs text-muted-foreground">
          {asked
            ? "Noted. We'll show you ideas for your space when it's ready."
            : "Layout, color and finish suggestions from your photos."}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
        Coming soon
      </span>
    </button>
  );
};
