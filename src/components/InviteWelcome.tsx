// The welcome a homeowner sees in a contractor's experience: who is coming
// (their profile, then the public record), then a polite ask for the
// project. Shared by a contractor's personal link (/i/:token) and their
// permanent front door (/c/:slug). Nothing here points to other contractors.
import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, FileCheck2, Lock, Map } from "lucide-react";
import CobrandLogo, { type Cobrand } from "@/components/CobrandLogo";
import ProofPanel from "@/components/contractors/ProofPanel";
import { Button } from "@/components/ui/button";
import { contractorDisplayName, personFirstName, type InviteContractor } from "@/lib/invites";

export const Shell = ({ children, brand, style }: { children: ReactNode; brand?: Cobrand | null; style?: CSSProperties }) => (
  <div className="min-h-screen bg-gradient-warm" style={style}>
    <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
      <CobrandLogo brand={brand} />
    </header>
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">{children}</main>
  </div>
);

type Props = {
  contractor: InviteContractor;
  brand: Cobrand;
  /** "personal": a link made for this homeowner. "front": the contractor's website door. */
  door: "personal" | "front";
  hasBrief: boolean;
  busy?: boolean;
  onStart: () => void;
  onResume?: () => void;
  /** Brand theme variables, for pages where the global theme isn't on yet. */
  style?: CSSProperties;
};

export default function InviteWelcome({ contractor: c, brand, door, hasBrief, busy = false, onStart, onResume, style }: Props) {
  const name = contractorDisplayName(c);
  const person = personFirstName(c);
  // "Matt" when we know the person, otherwise the company.
  const short = person ?? name;
  const front = door === "front";

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const steps = [
    { icon: FileCheck2, title: "Share your project", body: "Photos of the space, what you'd like done, a rough budget and timing. About five minutes, and you can skip anything." },
    { icon: CalendarDays, title: "Pick a few times", body: `Tap the days and times that work for a visit. ${short} confirms one with you.` },
    { icon: Map, title: `${short} arrives prepared`, body: "With a prep sheet on your home and project, so the first visit starts with your ideas, not the basics." },
  ];

  return (
    <Shell brand={brand} style={style}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Who is coming: the person first, then their record. */}
        <div className="flex items-center gap-4">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent-soft-foreground">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{front ? "Start your project" : "A personal invitation"}</p>
            <p className="truncate font-display text-lg">{person ? `${person} at ${name}` : name}</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-3xl font-light leading-tight md:text-[2.6rem]">
          {short} would love to hear <span className="italic">about your project.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {front
            ? `Tell ${short} about your project here instead of a contact form. Share a few details and pick a time, and your first conversation starts with your plans instead of the basics.`
            : `Thanks for reaching out. Before you meet, ${short} invited you to share a few details, so your first conversation starts with your plans instead of the basics.`}
        </p>

        {(c.tagline || c.yearsInBusiness || c.specialties || (c.gallery?.length ?? 0) > 0) && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            {c.tagline && <p className="font-display text-xl italic leading-snug">“{c.tagline}”</p>}
            {(c.yearsInBusiness || c.specialties) && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {c.yearsInBusiness ? (
                  <span className="rounded-full bg-secondary px-3 py-1">{c.yearsInBusiness} years in business</span>
                ) : null}
                {c.specialties
                  ?.split(/[,;]/)
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((x) => (
                    <span key={x} className="rounded-full bg-secondary px-3 py-1">{x}</span>
                  ))}
              </div>
            )}
            {(c.gallery?.length ?? 0) > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {c.gallery!.map((u) => (
                  <img key={u} src={u} alt={`Recent work by ${name}`} loading="lazy" className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">What the public record shows</p>
          <ProofPanel contractorId={c.id} city={c.city} variant="full" />
        </div>

        {/* The ask: polite, and clear about what they get. */}
        <section className="mt-10 rounded-3xl border border-accent/25 bg-card p-6 shadow-soft md:p-8">
          <h2 className="font-display text-2xl font-light">Help {short} come prepared</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Would you share a little about your project? It's the easiest way to make your first visit count.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((st, i) => (
              <li key={st.title} className="rounded-2xl bg-secondary/40 p-4">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] text-background">{i + 1}</span>
                  {st.title}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{st.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full" onClick={onStart} disabled={busy}>
              {busy ? "One moment…" : "Share my project"} <ArrowRight className="h-4 w-4" />
            </Button>
            {hasBrief && onResume && (
              <Button size="lg" variant="outline" className="rounded-full" onClick={onResume} disabled={busy}>
                Use the brief I already started
              </Button>
            )}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> Only {name} sees it, and it's yours to keep.
          </p>
        </section>
      </motion.div>
    </Shell>
  );
}
