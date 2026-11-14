// The project summary, one card, the same for both sides: the contractor
// assesses the job from it, and the homeowner sees exactly what the
// contractor gets before sending. Logic: src/lib/projectSummary.ts.
import { useEffect } from "react";
import { CalendarClock, CircleHelp, Hammer, ImageIcon, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { DealSnapshot } from "@/lib/dealRead";
import { projectSummary } from "@/lib/projectSummary";
import BasisPill from "@/components/intake/BasisPill";

type Props = {
  snapshot: DealSnapshot;
  /** "contractor": their brief. "homeowner": the preview of what the contractor gets. */
  audience: "contractor" | "homeowner";
  /** "Matt" or "your contractor", for the homeowner's preview. */
  contractorName?: string;
  /** The homeowner's name, for the contractor's view. */
  homeownerName?: string | null;
  className?: string;
  compact?: boolean;
};

const Section = ({ icon: Icon, title, children }: { icon: typeof Hammer; title: string; children: React.ReactNode }) => (
  <section className="border-t border-border px-5 py-4 md:px-6">
    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-accent" /> {title}
    </p>
    <div className="mt-2">{children}</div>
  </section>
);

export default function ProjectSummaryCard({ snapshot, audience, contractorName, homeownerName, className, compact = false }: Props) {
  const p = projectSummary(snapshot);
  const forHomeowner = audience === "homeowner";

  useEffect(() => {
    track("project_summary_viewed", { audience, facts_open: p.facts.filter((f) => f.open).length, has_work: p.work.length > 0 });
    // once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <article className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-soft", className)}>
      <header className="px-5 pb-4 pt-5 md:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          {forHomeowner ? `What ${contractorName ?? "your contractor"} gets` : `The job${homeownerName ? ` · ${homeownerName}` : ""}`}
        </p>
        <h2 className={cn("mt-1 font-display font-light leading-tight", compact ? "text-[24px]" : "text-2xl md:text-3xl")}>
          {p.title}
          {p.where && <span className="text-muted-foreground"> · {p.where}</span>}
        </h2>
        {p.goal && (
          <p className="mt-1.5 text-[15px] leading-snug text-foreground/85">{p.goalIsTheirs ? `“${p.goal}”` : p.goal}</p>
        )}
      </header>

      {/* The numbers they price from */}
      <dl className={cn("grid gap-px border-t border-border bg-border", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
        {p.facts.map((f, i) => (
          // An odd last tile spans the row, so no empty cell shows on phones.
          <div key={f.label} className={cn("bg-card px-4 py-3", p.facts.length % 2 === 1 && i === p.facts.length - 1 && "col-span-2 sm:col-span-1")}>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</dt>
            <dd className={cn("mt-0.5 text-sm leading-snug", f.open ? "italic text-muted-foreground" : "font-medium text-foreground")}>{f.value}</dd>
          </div>
        ))}
      </dl>

      {p.estimate && (
        <p className="border-t border-border px-5 py-2.5 text-[13px] text-foreground/80 md:px-6">
          <span className="text-muted-foreground">Haleo's estimate from the photos: </span>
          {p.estimate}
          <BasisPill basis="inferred" section="Job summary" />
        </p>
      )}

      {p.wants.length > 0 && (
        <Section icon={Wrench} title={forHomeowner ? "What you want fixed" : "What they want fixed"}>
          <div className="flex flex-wrap gap-1.5">
            {p.wants.map((w) => (
              <span key={w} className="rounded-full bg-secondary px-2.5 py-1 text-[13px]">{w}</span>
            ))}
          </div>
        </Section>
      )}

      {(p.today.headline || p.today.photos.length > 0 || p.today.answers.length > 0) && (
        <Section icon={ImageIcon} title="The space today">
          {p.today.photos.length > 0 && (
            <div className="mb-2 flex gap-1.5">
              {p.today.photos.map((u) => (
                <img key={u} src={u} alt="" loading="lazy" className="h-16 w-16 rounded-lg border border-border object-cover md:h-20 md:w-20" />
              ))}
            </div>
          )}
          {p.today.headline && <p className="text-sm leading-snug text-foreground/85">{p.today.headline}</p>}
          {p.today.answers.length > 0 && (
            <ul className="mt-2 space-y-1">
              {p.today.answers.map((a) => (
                <li key={a} className="text-[13px] leading-snug text-foreground/80">
                  <span className="text-muted-foreground">{forHomeowner ? "You said: " : "They said: "}</span>
                  {a}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {p.work.length > 0 && (
        <Section icon={Hammer} title="Likely work">
          <ul className="space-y-1.5">
            {p.work.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>
                  {w.trade && <span className="font-medium">{w.trade}: </span>}
                  {w.text}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.settle.length > 0 && (
        <Section icon={CircleHelp} title={forHomeowner ? "What they'll check when they visit" : "To settle on site"}>
          <ul className="space-y-1.5">
            {p.settle.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-foreground/85">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.logistics.length > 0 && (
        <Section icon={CalendarClock} title="Logistics">
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {p.logistics.map((l) => (
              <div key={l.label} className="flex gap-2 text-sm">
                <dt className="w-24 shrink-0 text-muted-foreground">{l.label}</dt>
                <dd className="min-w-0">{l.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <p className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground md:px-6">
        {forHomeowner
          ? "Anything marked “Not shared yet” is fine. It's a question for your first conversation."
          : "From the homeowner's answers and photos. Haleo gathers the context; you make the call."}
      </p>
    </article>
  );
}
