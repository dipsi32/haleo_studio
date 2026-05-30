import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X, Check, ImageIcon, MapPin, Ruler, CircleHelp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import AduDisclaimer from "./AduDisclaimer";
import { track } from "@/lib/analytics";
import type { AnnotationOutput } from "./AduPlanAnnotation";

export interface BriefSection {
  heading: string;
  body: string;
}

export interface AduBriefData {
  sections: BriefSection[];
  questions: string[];
}

export default function AduBrief({
  brief,
  annotation,
  propertyAddress,
  onChange,
  onContinue,
}: {
  brief: AduBriefData;
  annotation?: AnnotationOutput | null;
  propertyAddress?: string | null;
  onChange: (next: AduBriefData) => void;
  onContinue: () => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const quickFacts = useMemo(
    () => [
      { label: "Address", value: propertyAddress ?? "Address unavailable", icon: MapPin },
      {
        label: "ADU type",
        value: annotation?.intended_scope.adu_type ? annotation.intended_scope.adu_type.replace("_", " ") : "Not set",
        icon: ImageIcon,
      },
      {
        label: "Target size",
        value: annotation?.intended_scope.size_sqft ? `${annotation.intended_scope.size_sqft} sqft` : "Not set",
        icon: Ruler,
      },
      {
        label: "Bid questions",
        value: `${brief.questions.length} ready`,
        icon: CircleHelp,
      },
    ],
    [annotation, brief.questions.length, propertyAddress],
  );

  function updateSection(i: number, patch: Partial<BriefSection>) {
    const next = [...brief.sections];
    next[i] = { ...next[i], ...patch };
    onChange({ ...brief, sections: next });
    track("adu_brief_edited", { kind: "section" });
  }

  function removeSection(i: number) {
    onChange({ ...brief, sections: brief.sections.filter((_, idx) => idx !== i) });
    track("adu_brief_edited", { kind: "section_remove" });
  }

  function addSection() {
    onChange({ ...brief, sections: [...brief.sections, { heading: "New section", body: "" }] });
    setEditingIdx(brief.sections.length);
  }

  function updateQuestion(i: number, v: string) {
    const next = [...brief.questions];
    next[i] = v;
    onChange({ ...brief, questions: next });
  }
  function removeQuestion(i: number) {
    onChange({ ...brief, questions: brief.questions.filter((_, idx) => idx !== i) });
  }
  function addQuestion() {
    onChange({ ...brief, questions: [...brief.questions, ""] });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-950">
        This brief was generated from parcel data and your annotations. Review carefully before sending to contractors —
        you know your property best.
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick read</p>
            <h3 className="mt-1 font-display text-lg tracking-tight">Contractor-ready summary</h3>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
            Saved as you edit
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {quickFacts.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-background p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {label}
              </p>
              <p className="mt-1 text-sm font-medium capitalize text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {(annotation?.base_plan_url || annotation?.annotation_image_url) ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {annotation?.base_plan_url ? (
              <figure className="overflow-hidden rounded-xl border border-border bg-background">
                <img src={annotation.base_plan_url} alt="Existing plan thumbnail" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <figcaption className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground">Existing plan</figcaption>
              </figure>
            ) : null}
            {annotation?.annotation_image_url ? (
              <figure className="overflow-hidden rounded-xl border border-border bg-background">
                <img src={annotation.annotation_image_url} alt="Annotated ADU thumbnail" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <figcaption className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground">Annotated ADU area</figcaption>
              </figure>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">At a glance</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {brief.sections.map((section, index) => (
            <div key={`${section.heading}-${index}`} className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Section {index + 1}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{section.heading}</p>
            </div>
          ))}
        </div>
      </section>

      {brief.sections.map((s, i) => (
        <article key={i} className="rounded-2xl border border-border bg-card p-5">
          {editingIdx === i ? (
            <div className="space-y-2">
              <Input value={s.heading} onChange={(e) => updateSection(i, { heading: e.target.value })} className="font-semibold" />
              <Textarea
                value={s.body}
                onChange={(e) => updateSection(i, { body: e.target.value })}
                rows={5}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-rose-700 transition-smooth hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIdx(null)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[12px] text-background"
                >
                  <Check className="h-3.5 w-3.5" /> Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base tracking-tight">{s.heading}</h3>
                <button
                  type="button"
                  onClick={() => setEditingIdx(i)}
                  className="rounded-full p-1.5 text-muted-foreground transition-smooth hover:bg-secondary"
                  aria-label="Edit section"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </header>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{s.body || <span className="italic text-muted-foreground">Empty</span>}</p>
            </>
          )}
        </article>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-[13px] text-muted-foreground transition-smooth hover:bg-secondary"
      >
        <Plus className="h-3.5 w-3.5" /> Add section
      </button>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base tracking-tight">Questions for the contractor</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          The contractor should answer these in their bid.
        </p>
        <ul className="mt-3 space-y-2">
          {brief.questions.map((q, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <Textarea
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
                rows={2}
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                className="mt-1 rounded-full p-1.5 text-muted-foreground transition-smooth hover:bg-secondary"
                aria-label="Remove question"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addQuestion}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-smooth hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Add question
        </button>
      </section>

      <AduDisclaimer />

      <button
        type="button"
        onClick={onContinue}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition-smooth"
      >
        Find ADU contractors
      </button>
    </div>
  );
}
