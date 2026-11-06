// Haleo's read of the homeowner's photos, the short way:
//   1. One headline.
//   2. At most three things it noticed, one line each, tied to the photo.
//   3. Two or three questions only they can answer, one tap each. Their
//      answers go to the contractor, so the first visit skips the basics.
// The contractor's site brief (likely work, watch-outs, what to check) is
// built from the same read but never shown here: it isn't for them.
import { motion } from "framer-motion";
import { Camera, Check, CircleHelp, Eye, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { Noticed, SpaceRead } from "@/lib/spaceFindings";

const KIND: Record<Noticed["kind"], { icon: typeof Check; cls: string; label: string }> = {
  good: { icon: Check, cls: "bg-sage-soft text-sage", label: "Looks good" },
  watch: { icon: Eye, cls: "bg-accent-soft text-accent", label: "Worth a look" },
  unknown: { icon: CircleHelp, cls: "bg-secondary text-foreground/60", label: "Can't tell yet" },
};

type Props = {
  read: SpaceRead;
  answers: Record<string, string>;
  onAnswer: (id: string, answer: string) => void;
  /** Who gets the answers: "Matt", or "your contractor". */
  who: string;
  /** Go back to add a photo, when the read asks for one. */
  onAddPhoto?: () => void;
  notes?: string[];
};

export default function QuickRead({ read, answers, onAnswer, who, onAddPhoto, notes }: Props) {
  const answered = read.questions.filter((q) => answers[q.id]).length;
  return (
    <div>
      <p className="font-display text-xl font-light leading-snug text-foreground md:text-2xl">{read.headline}</p>

      {notes?.length ? (
        <p className="mt-3 rounded-xl border border-border bg-secondary/50 px-3.5 py-2 text-xs text-foreground/75">{notes.join(" ")}</p>
      ) : null}

      {read.noticed.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {read.noticed.map((n, i) => {
            const k = KIND[n.kind];
            const Icon = k.icon;
            return (
              <li key={i} className="flex items-start gap-3">
                <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", k.cls)} aria-label={k.label}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-snug">
                  <span className="font-medium text-foreground">{n.title}.</span>{" "}
                  <span className="text-foreground/70">{n.note}</span>
                </span>
                {n.photo_url && <img src={n.photo_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />}
              </li>
            );
          })}
        </ul>
      )}

      {read.questions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-accent/25 bg-accent-soft/30 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <MessageCircleQuestion className="h-4 w-4 text-accent" />
            {read.questions.length === 1 ? "One quick question" : `${read.questions.length} quick questions`} from your photo
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {answered}/{read.questions.length}
            </span>
          </p>
          <ul className="mt-3 space-y-4">
            {read.questions.map((q) => (
              <li key={q.id}>
                <p className="text-[15px] leading-snug text-foreground">{q.question}</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={q.question}>
                  {q.options.map((o) => {
                    const on = answers[q.id] === o;
                    return (
                      <motion.button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          onAnswer(q.id, o);
                          track("space_read_question_answered", { question: q.id, unsure: /not sure/i.test(o) });
                        }}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm transition-smooth",
                          on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background hover:border-accent/50",
                        )}
                      >
                        {o}
                      </motion.button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Optional. Your answers go to {who}, so the first visit skips the basics.</p>
        </div>
      )}

      {read.photo_request && onAddPhoto && (
        <button
          type="button"
          onClick={() => {
            track("space_read_photo_requested");
            onAddPhoto();
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-background/50 px-4 py-3 text-left text-sm transition-smooth hover:border-accent/50"
        >
          <Camera className="h-4 w-4 shrink-0 text-accent" />
          <span>
            A photo of <span className="font-medium">{read.photo_request.replace(/^a photo of\s+/i, "")}</span> would help.{" "}
            <span className="text-muted-foreground">Add one</span>
          </span>
        </button>
      )}
    </div>
  );
}
