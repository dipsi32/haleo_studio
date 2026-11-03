// The contractor demo: /demo/:slug (or /demo?record=…&brand=…&person=…)
//
// Three screens and a close, one idea each:
//   1. Their real public record: what a homeowner can already find.
//   2. Their link on a client's phone: they tap the answers, and their own
//      record speaks to each one, in place.
//   3. What lands on their phone: the brief with visit prep on top.
//   4. Set up their real link.
// Step 1 is real. Steps 2 and 3 use a made-up client and say so. Nothing is
// sent or saved. Logic lives in src/lib/demo.ts.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Eye, Hammer, Lock, MapPin, Smartphone, Sparkles, Timer } from "lucide-react";
import Logo from "@/components/Logo";
import CobrandLogo from "@/components/CobrandLogo";
import ProofPanel from "@/components/contractors/ProofPanel";
import RecordTidbit from "@/components/brief/RecordTidbit";
import VisitPrepCard from "@/components/pro/VisitPrepCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { findPermitRecord } from "@/lib/useShortlistCheck";
import { recordHighlights, type Highlight } from "@/lib/recordHighlights";
import { formatVisitTime } from "@/lib/visitTimes";
import { findingsSection } from "@/lib/spaceFindings";
import type { Contractor, Permit } from "@/lib/contractors";
import {
  DEMO_BUY_BOX,
  DEMO_CLIENT,
  DEMO_PROJECTS,
  demoIntake,
  demoSample,
  demoSnapshot,
  demoVisitOptions,
  recordFacts,
  resolveDemo,
  topZips,
  type DemoAnswers,
  type DemoConfig,
} from "@/lib/demo";

type PermitRecord = { contractor: Contractor; permits: Permit[] } | null;
type Load = { kind: "loading" } | { kind: "ready"; record: PermitRecord };

const STEPS = ["record", "client", "prep", "start"] as const;
type Step = (typeof STEPS)[number];

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{children}</p>
);

const SampleNote = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 inline-flex items-start gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs text-foreground/70">
    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
    <span>{children}</span>
  </p>
);

export default function Demo() {
  const { slug } = useParams<{ slug: string }>();
  const [search] = useSearchParams();
  const demo = useMemo(() => resolveDemo(slug, search), [slug, search]);

  if (!demo) return <NoDemo />;
  return <DemoFlow demo={demo} />;
}

const NoDemo = () => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto max-w-3xl px-6 py-6">
      <Logo />
    </header>
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <h1 className="font-display text-3xl font-light">This demo link is missing a name</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Ask for a fresh link, or see how Haleo works for contractors.
      </p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/pro">Haleo for contractors</Link>
      </Button>
    </main>
  </div>
);

const DemoFlow = ({ demo }: { demo: DemoConfig }) => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [step, setStep] = useState<Step>("record");
  const [answers, setAnswers] = useState<DemoAnswers>({ project: null, zip: "", visitTimes: [] });
  const short = demo.person ?? demo.brand;

  useEffect(() => {
    track("demo_opened", { demo: demo.slug });
    let cancelled = false;
    (async () => {
      let record: PermitRecord = null;
      try {
        record = await findPermitRecord(demo.recordName);
      } catch {
        record = null;
      }
      if (cancelled) return;
      setLoad({ kind: "ready", record });
      track("demo_record_loaded", { demo: demo.slug, found: !!record, permits: record?.permits.length ?? 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [demo.slug, demo.recordName]);

  useEffect(() => {
    track("demo_step_viewed", { demo: demo.slug, step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, demo.slug]);

  const i = STEPS.indexOf(step);
  const go = (to: Step) => setStep(to);
  const record = load.kind === "ready" ? load.record : null;

  const nextLabel: { [K in Step]: string } = {
    record: "See your link on a client's phone",
    client: "See what lands on your phone",
    prep: "Set up your real link",
    start: "",
  };
  const canNext = step !== "client" || !!answers.project;

  return (
    <div className="min-h-screen bg-gradient-warm pb-28">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-6">
        <Logo />
        <span className="truncate rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
          A demo for {demo.brand}
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pt-2">
        {/* Progress */}
        <div className="mb-8 flex gap-1.5" aria-hidden>
          {STEPS.map((s, idx) => (
            <span key={s} className={cn("h-1 flex-1 rounded-full", idx <= i ? "bg-accent" : "bg-border")} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === "record" && <RecordStep demo={demo} short={short} load={load} />}
            {step === "client" && (
              <ClientStep demo={demo} short={short} record={record} answers={answers} setAnswers={setAnswers} />
            )}
            {step === "prep" && <PrepStep demo={demo} short={short} answers={answers} />}
            {step === "start" && <StartStep demo={demo} record={record} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky bottom action */}
      {step !== "start" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
            {i > 0 ? (
              <Button variant="ghost" className="rounded-full" onClick={() => go(STEPS[i - 1])}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">About 3 minutes</span>
            )}
            <Button
              className="rounded-full px-6"
              disabled={!canNext}
              onClick={() => go(STEPS[i + 1])}
            >
              {canNext ? nextLabel[step] : "Tap a project to continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ───── 1. Their record ─────

const RecordStep = ({ demo, short, load }: { demo: DemoConfig; short: string; load: Load }) => (
  <section>
    <Eyebrow>Step 1 of 3 · What homeowners can find</Eyebrow>
    <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
      {demo.person ? `${demo.person}, this` : "This"} is what a homeowner sees{" "}
      <span className="italic">before they call you.</span>
    </h1>
    <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
      Haleo reads San Jose permit records and the state license board. Nothing here is a rating or a review.
      It's the record of work you've already done.
    </p>

    <div className="mt-8">
      {load.kind === "loading" && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft" role="status">
          <p className="font-display text-lg">Pulling the San Jose permit record for {demo.brand}…</p>
          <p className="mt-1 text-sm text-muted-foreground">Usually a few seconds.</p>
          <div className="mt-5 space-y-2">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-4 animate-pulse rounded-full bg-secondary" style={{ width: `${90 - k * 20}%` }} />
            ))}
          </div>
        </div>
      )}
      {load.kind === "ready" && load.record && <RecordFacts permits={load.record.permits} />}
      {load.kind === "ready" && load.record && (
        <>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            The public record for {demo.brand}
          </p>
          <ProofPanel contractorId={load.record.contractor.id} city="San Jose" variant="full" />
        </>
      )}
      {load.kind === "ready" && !load.record && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <p className="font-display text-lg">We couldn't pull {short}'s permit record just now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The city's records can be slow. The rest of the demo still shows how your link works.
          </p>
        </div>
      )}
    </div>
  </section>
);

const RecordFacts = ({ permits }: { permits: Permit[] }) => {
  const f = recordFacts(permits);
  const rows = [
    f.zips.length > 0 && { icon: MapPin, label: "Where you work", text: `${f.zips.length} San Jose ZIP code${f.zips.length === 1 ? "" : "s"}: ${f.zips.join(", ")}` },
    f.kinds.length > 0 && { icon: Hammer, label: "Kinds of work", text: f.kinds.join(" · ") },
    f.active > 0 && { icon: Timer, label: "Right now", text: `${f.active} permit${f.active === 1 ? "" : "s"} active with the city` },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; text: string }[];
  if (rows.length === 0) return null;
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <r.icon className="h-3.5 w-3.5 text-accent" /> {r.label}
          </p>
          <p className="mt-2 text-sm leading-snug text-foreground/90">{r.text}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-sage">Public record</p>
        </div>
      ))}
    </div>
  );
};

// ───── 2. Their link, on a client's phone ─────

const Pill = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn(
      "rounded-full border px-3.5 py-1.5 text-sm transition-smooth",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
    )}
  >
    {children}
  </button>
);

const ClientStep = ({
  demo,
  short,
  record,
  answers,
  setAnswers,
}: {
  demo: DemoConfig;
  short: string;
  record: PermitRecord;
  answers: DemoAnswers;
  setAnswers: (a: DemoAnswers) => void;
}) => {
  const facts = useMemo(() => {
    if (!record) return {} as Partial<{ [K in Highlight["id"]]: Highlight }>;
    const hs = recordHighlights(record.permits, demoIntake(answers), demo.brand);
    return Object.fromEntries(hs.map((h) => [h.id, h])) as Partial<{ [K in Highlight["id"]]: Highlight }>;
  }, [record, answers, demo.brand]);
  const zips = useMemo(() => (record ? topZips(record.permits) : []), [record]);
  const times = useMemo(() => demoVisitOptions(), []);
  const set = (patch: Partial<DemoAnswers>, what: string) => {
    setAnswers({ ...answers, ...patch });
    track("demo_answer_tapped", { demo: demo.slug, what });
  };
  const brand = { name: demo.brand, href: "#" };

  return (
    <section>
      <Eyebrow>Step 2 of 3 · Your link, on your client's phone</Eyebrow>
      <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
        You text one link. <span className="italic">Your client sees you first.</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
        Tap the answers the way a client would. Your record speaks to each one as they go.
      </p>
      <SampleNote>The client is made up. The facts in green are from your real record.</SampleNote>

      {/* The phone */}
      <div className="mx-auto mt-8 max-w-sm rounded-[2.2rem] border-[10px] border-foreground/90 bg-background shadow-lift">
        <div className="rounded-[1.5rem] bg-gradient-warm px-5 pb-6 pt-5">
          <div className="pointer-events-none">
            <CobrandLogo brand={brand} />
          </div>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">A personal invitation</p>
          <p className="mt-1 font-display text-2xl font-light leading-snug">
            {short} would love to hear <span className="italic">about your project.</span>
          </p>

          <div className="mt-5 space-y-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div>
              <p className="text-sm font-medium">What are you planning?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEMO_PROJECTS.map((p) => (
                  <Pill key={p.id} on={answers.project === p.id} onClick={() => set({ project: p.id }, "project")}>
                    {p.label}
                  </Pill>
                ))}
              </div>
              {answers.project && (
                <RecordTidbit demo className="mt-3" h={facts.work ?? facts.track} />
              )}
            </div>

            {answers.project && (
              <div>
                <p className="text-sm font-medium">Your ZIP code</p>
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  value={answers.zip}
                  onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) }, "zip_typed")}
                  placeholder="95125"
                  className="mt-2 h-10 rounded-xl bg-background"
                />
                {zips.length > 0 && !answers.zip && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {zips.map((z) => (
                      <Pill key={z} on={false} onClick={() => set({ zip: z }, "zip_tapped")}>
                        {z}
                      </Pill>
                    ))}
                  </div>
                )}
                <RecordTidbit demo className="mt-3" h={facts.nearby ?? facts.structural} />
              </div>
            )}

            {answers.project && (
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-accent" /> Times that work for a visit
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {times.map((t) => {
                    const on = answers.visitTimes.includes(t);
                    return (
                      <Pill
                        key={t}
                        on={on}
                        onClick={() =>
                          set(
                            { visitTimes: on ? answers.visitTimes.filter((x) => x !== t) : [...answers.visitTimes, t] },
                            "visit_time",
                          )
                        }
                      >
                        {formatVisitTime(t)}
                      </Pill>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{short} confirms one.</p>
              </div>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Only {demo.brand} sees it.
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        The real link also takes photos, budget and timing, about five minutes in all, and every question is optional.
      </p>
    </section>
  );
};

// ───── 3. What lands on their phone ─────

const PrepStep = ({ demo, short, answers }: { demo: DemoConfig; short: string; answers: DemoAnswers }) => {
  const snapshot = useMemo(() => demoSnapshot(answers), [answers]);
  const sample = demoSample(answers.project ?? "kitchen");
  const onSite = findingsSection(sample.findings);

  return (
    <section>
      <Eyebrow>Step 3 of 3 · Before you drive out</Eyebrow>
      <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
        {DEMO_CLIENT}'s brief arrives <span className="italic">with the visit already prepped.</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
        On your phone, before you get in the truck: whether it's worth the drive, what your client may not know about
        their own house, and what to ask at the door.
      </p>
      <SampleNote>
        {DEMO_CLIENT} and the home are made up for this demo. With a real client, every line comes from their answers
        and the city's records for their address.
      </SampleNote>

      {/* The brief, as the inbox shows it */}
      <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">New brief · {snapshot.neighborhood}</p>
        <p className="mt-2 font-display text-xl">
          {DEMO_CLIENT} · {sample.label} · {sample.budget}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">{sample.scope}</p>
        <p className="mt-2 text-sm italic text-muted-foreground">“{sample.vision}”</p>
      </div>

      <div className="mt-4">
        <VisitPrepCard demo snapshot={snapshot} buyBox={DEMO_BUY_BOX} homeownerName={DEMO_CLIENT} />
      </div>

      {onSite && (
        <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
          <p className="flex items-center gap-2 font-display text-lg">
            <Eye className="h-4 w-4 text-accent" /> {onSite.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">From {DEMO_CLIENT}'s photos, read by Haleo.</p>
          <ul className="mt-3 space-y-2">
            {onSite.items.map((it) => (
              <li key={it.text} className="flex gap-2 text-sm leading-snug text-foreground/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <span>
                  {it.text}
                  <span className="ml-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    · {it.basis === "grounded" ? "In the photo" : it.basis === "inferred" ? "Our inference" : "Worth asking"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {short}, which of these would have changed your last site visit?
      </p>
    </section>
  );
};

// ───── 4. Their real link ─────

const StartStep = ({ demo, record }: { demo: DemoConfig; record: PermitRecord }) => {
  // The select is "*", so the row carries claim state even though the shared type doesn't.
  const row = record?.contractor as (Contractor & { slug?: string | null; claimed?: boolean | null }) | undefined;
  const claimable = !!row?.slug && !row.claimed;
  const href = claimable ? `/pro/${row!.slug}/claim` : "/pro/login?next=/pro/links";
  return (
    <section className="text-center">
      <Eyebrow>Ready when you are</Eyebrow>
      <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-light leading-tight text-balance md:text-5xl">
        Your next inquiry could arrive <span className="italic">this prepared.</span>
      </h1>
      <ul className="mx-auto mt-8 max-w-md space-y-3 text-left">
        {[
          "Your link carries your name: “" + demo.brand + ", powered by Haleo.”",
          "Your client's brief goes to you and no one else.",
          "Free while we're small. No card.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> <span>{t}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild size="lg" className="rounded-full px-8" onClick={() => track("demo_cta_clicked", { demo: demo.slug, claimable: !!claimable })}>
          <Link to={href}>
            <Smartphone className="h-4 w-4" /> Set up your link
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">About two minutes. Then text it to your next inquiry.</p>
      </div>
    </section>
  );
};
