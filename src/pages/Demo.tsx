// The contractor demo, in two tabs.
//
// The homeowner's side:
//   /demo/:slug          A lead (Priya) texts the contractor; the contractor
//                        replies with one friendly link.
//   /demo/:slug/welcome  Tapping it opens the real welcome, then the real brief
//                        flow (/brief, /brief/result, /i/demo-…/send).
// The contractor's side:
//   /demo/:slug/matt     A text lands on the contractor's phone: who, what,
//                        and when they can meet. One tap opens the brief, with
//                        a small note on what kind of lead it looks like.
// /demo/:slug/site still shows their website with one new button, for anyone
// with that link. Nothing is sent or saved to anyone's account. Logic:
// src/lib/demo.ts.
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Hammer,
  Hand,
  Home,
  PlusSquare,
  RotateCcw,
} from "lucide-react";
import Logo from "@/components/Logo";
import HomeownerContact from "@/components/pro/HomeownerContact";
import LeadToast from "@/components/pro/LeadToast";
import ProjectSummaryCard from "@/components/ProjectSummaryCard";
import { computeLeadReadiness } from "@/lib/leadReadiness";
import { jobGlance } from "@/lib/jobGlance";
import InviteWelcome, { type HomeownerStart } from "@/components/InviteWelcome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { brandThemeVars, frontDoorKey, frontDoorPath } from "@/lib/frontDoor";
import { findPermitRecord } from "@/lib/useShortlistCheck";
import { clearActiveInvite, demoToken, inviteMessage, setActiveInvite, type InviteContractor } from "@/lib/invites";
import { saveIntakeStart } from "@/lib/intake";
import { cleanVisitTimes, formatVisitTime } from "@/lib/visitTimes";
import { DEMO_BUY_BOX, DEMO_LEAD, leadText, loadDemoBrief, resolveDemo, type DemoConfig } from "@/lib/demo";

type View = "doors" | "text" | "site" | "welcome" | "matt";
const VIEWS: View[] = ["doors", "text", "site", "welcome", "matt"];

export default function Demo() {
  const { slug, view } = useParams<{ slug: string; view: string }>();
  const [search] = useSearchParams();
  const demo = useMemo(() => resolveDemo(slug, search), [slug, search]);
  const v: View = VIEWS.includes(view as View) ? (view as View) : "doors";

  useEffect(() => {
    if (demo && v === "doors") track("demo_opened", { demo: demo.slug });
  }, [demo, v]);
  // A block body, never an expression: whatever scrollTo returns must not
  // become React's cleanup (a library on the page makes it return a value).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [v]);

  if (!demo) return <NoDemo />;
  if (v === "text") return <TextDoor demo={demo} />;
  if (v === "site") return <SiteDoor demo={demo} />;
  if (v === "welcome") return <Welcome demo={demo} />;
  if (v === "matt") return <MattView demo={demo} />;
  return <TextDoor demo={demo} />;
}

// ───── Shared ─────

/** Their record, found by the name on their permits, and the contractor as their client sees them. */
const useDemoContractor = (demo: DemoConfig) => {
  const [c, setC] = useState<InviteContractor | null>(null);
  useEffect(() => {
    let cancelled = false;
    const base = {
      name: demo.brand,
      company: demo.brand,
      city: "San Jose",
      brandColor: demo.brandColor ?? null,
      personName: demo.person,
      licenseNumber: demo.licenseNumber ?? null,
    };
    findPermitRecord(demo.recordName)
      .then((r) => !cancelled && setC({ ...base, id: r?.contractor.id ?? "", slug: (r?.contractor as { slug?: string } | undefined)?.slug ?? null }))
      .catch(() => !cancelled && setC({ ...base, id: "", slug: null }));
    return () => {
      cancelled = true;
    };
  }, [demo]);
  return c;
};

const themeOf = (demo: DemoConfig) => (brandThemeVars(demo.brandColor) ?? undefined) as CSSProperties | undefined;
const who = (demo: DemoConfig) => demo.person ?? demo.brand;

type Side = "homeowner" | "contractor";

/** Two tabs: the homeowner's side, then the contractor's. That's the whole demo. */
const Tabs = ({ demo, side }: { demo: DemoConfig; side: Side }) => (
  <nav className="mb-8 inline-flex rounded-full border border-border bg-card/80 p-1 text-sm shadow-soft" aria-label="Demo sides">
    {(
      [
        ["homeowner", "The homeowner's side", `/demo/${demo.slug}`],
        ["contractor", `${who(demo)}'s side`, `/demo/${demo.slug}/matt`],
      ] as const
    ).map(([key, label, href], i) => (
      <Link
        key={key}
        to={href}
        aria-current={side === key ? "page" : undefined}
        className={cn(
          "rounded-full px-4 py-1.5 transition-colors",
          side === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="mr-1.5 opacity-60">{i + 1}</span>
        {label}
      </Link>
    ))}
  </nav>
);

const Page = ({ demo, children, side }: { demo: DemoConfig; children: ReactNode; side?: Side }) => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
      <Logo />
      <span className="truncate rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">A demo for {demo.brand}</span>
    </header>
    <main className="mx-auto max-w-4xl px-5 pb-20">
      {side && <Tabs demo={demo} side={side} />}
      {children}
    </main>
  </div>
);

const NoDemo = () => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto max-w-3xl px-6 py-6">
      <Logo />
    </header>
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <h1 className="font-display text-3xl font-light">This demo link is missing a name</h1>
      <p className="mt-3 max-w-md text-muted-foreground">Ask for a fresh link, or see how Haleo works for contractors.</p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/pro">Haleo for contractors</Link>
      </Button>
    </main>
  </div>
);

// ───── 1. The homeowner's side starts with a text ─────

/** The friendly link a contractor texts back: haleo.pages.dev/us-creative-builders. */
const friendlyLink = (demo: DemoConfig, slug?: string | null) =>
  `haleo.pages.dev${frontDoorPath(frontDoorKey(demo.brand) || slug || demo.slug)}`;

const TextDoor = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const contractor = useDemoContractor(demo);
  const color = demo.brandColor ?? "#111827";
  const link = friendlyLink(demo, contractor?.slug);
  const from = demo.person ? `${demo.person} from ${demo.brand}` : demo.brand;
  const reply = inviteMessage({ contractor: from, firstName: DEMO_LEAD.name, url: "" }).replace(/:\s*$/, ":");
  const tap = () => {
    track("demo_link_tapped", { demo: demo.slug, door: "text" });
    navigate(`/demo/${demo.slug}/welcome?door=text`);
  };
  return (
    <Page demo={demo} side="homeowner">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,360px)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            For {demo.brand}
          </p>
          <h1 className="mt-3 font-display text-4xl font-light leading-[1.08] text-balance md:text-6xl">
            Know the job <span className="italic">before you make the trip.</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Photos, scope, budget and timing in one brief, before the first visit. Spot the fit, raise the right questions, make the visit count.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">See it with {DEMO_LEAD.name}, a homeowner. Tap the link.</span> Nothing is sent.
          </p>
        </motion.div>

        {/* The homeowner's phone */}
        <div className="mx-auto w-full max-w-[360px] rounded-[2.4rem] border-[10px] border-foreground/90 bg-background shadow-lift">
          <div className="rounded-[1.7rem] bg-background">
            <div className="flex flex-col items-center border-b border-border px-4 pb-3 pt-4">
              <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: color }}>
                {(demo.person ?? demo.brand).slice(0, 1)}
              </span>
              <span className="mt-1 text-xs font-medium">{demo.person ? `${demo.person} · ${demo.brand}` : demo.brand}</span>
            </div>
            <div className="space-y-3 px-3 py-4">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[#0A84FF] px-3.5 py-2 text-[14px] leading-snug text-white"
              >
                {leadText(demo.person)}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="w-fit max-w-[88%]">
                <p className="rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2 text-[14px] leading-snug text-foreground/90">
                  {reply} <span className="font-medium text-[#0A84FF] underline">{link}</span>
                </p>
                <button
                  type="button"
                  onClick={tap}
                  className="relative mt-1.5 block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft transition-smooth hover:-translate-y-0.5"
                  aria-label={`Open ${link}`}
                >
                  <span className="absolute -inset-1 animate-pulse rounded-2xl ring-2 ring-offset-2" style={{ ["--tw-ring-color" as string]: color }} aria-hidden />
                  <span className="relative block px-4 py-5 text-white" style={{ background: `linear-gradient(135deg, ${color}, #1f1f1f)` }}>
                    <span className="block text-[11px] uppercase tracking-[0.16em] opacity-80">{demo.brand}</span>
                    <span className="mt-1 block font-display text-lg leading-snug">Tell {who(demo)} about your project</span>
                  </span>
                  <span className="relative block px-4 py-2.5">
                    <span className="block truncate text-[12px] font-medium">{link}</span>
                  </span>
                </button>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hand className="h-3.5 w-3.5" /> Tap the link
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};

// ───── 2b. Their website, one new button ─────

const SiteDoor = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const color = demo.brandColor ?? "#111827";
  const tap = () => {
    track("demo_link_tapped", { demo: demo.slug, door: "site" });
    navigate(`/demo/${demo.slug}/welcome?door=site`);
  };
  const services = demo.services?.length ? demo.services : ["Remodels", "Additions & ADUs", "Repairs"];
  const icons = [Hammer, PlusSquare, Home];
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* What this is, in one line */}
      <div className="flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-center text-xs text-background">
        <span>Demo: your website{demo.website ? ` (${demo.website})` : ""} with one new button. Tap it like a visitor would.</span>
        <Link to={`/demo/${demo.slug}`} className="shrink-0 rounded-full border border-background/30 px-2.5 py-0.5 hover:bg-background/10">
          Back
        </Link>
      </div>

      {/* Their nav */}
      <nav className="bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <span className="text-lg font-extrabold uppercase tracking-tight" style={{ color }}>
            {demo.brand}
          </span>
          <span className="hidden items-center gap-7 text-[13px] font-medium uppercase tracking-wide text-white/85 lg:flex">
            <span>Home</span>
            <span>Gallery</span>
            <span>Services</span>
            <span>About us</span>
            <span>Contact us</span>
            {demo.licenseNumber && (
              <span className="rounded-md border border-dashed px-3 py-1.5 normal-case tracking-normal" style={{ borderColor: color }}>
                License Number: {demo.licenseNumber}
              </span>
            )}
          </span>
        </div>
      </nav>

      {/* Their hero, with the one new thing front and center */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, #141414 0%, #262626 45%, ${color} 140%)` }}>
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          <div className="max-w-2xl rounded-md border border-dashed border-white/40 bg-white/5 p-6 backdrop-blur-sm md:p-10">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
              {demo.headline ?? "Build the home you've been picturing"}
            </h1>
            <span className="mt-5 block h-1 w-24 rounded-full" style={{ background: color }} />
            <p className="mt-5 text-lg leading-relaxed text-white/85">
              Planning a remodel, an addition or a new home? Tell us about it in five minutes, with a few photos if
              you have them. {demo.person ?? "We"} will come to your first visit with a plan, not a clipboard.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <button
                type="button"
                onClick={tap}
                className="relative inline-flex items-center gap-3 rounded-md px-8 py-4 text-lg font-bold uppercase tracking-wide text-white shadow-2xl transition-transform hover:-translate-y-0.5"
                style={{ background: color }}
              >
                <span className="absolute inset-0 animate-ping rounded-md opacity-25" style={{ background: color }} aria-hidden />
                <span className="relative">Start your project</span>
                <ArrowRight className="relative h-5 w-5" />
              </button>
              <span className="text-sm text-white/70">Free · about 5 minutes · goes straight to {who(demo)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Their services */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 md:grid-cols-3">
        {services.map((s, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div key={s} className="border border-neutral-200 p-6">
              <Icon className="h-9 w-9" style={{ color }} />
              <p className="mt-4 text-xl font-bold">{s}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
};

// ───── 3. The real welcome, then the real brief flow ─────

const Welcome = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // From a text, it's a personal invitation; from the website, it's their front door.
  const door = params.get("door") === "text" ? "personal" : "front";
  const contractor = useDemoContractor(demo);

  if (!contractor) {
    return (
      <div className="min-h-screen bg-gradient-warm p-10" style={themeOf(demo)}>
        <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-3xl border border-border bg-card/60" aria-label="Loading" />
      </div>
    );
  }

  const start = ({ name: homeownerName, phone: homeownerPhone }: HomeownerStart) => {
    setActiveInvite(demoToken(demo.slug), contractor);
    // A fresh brief every run, so each demo starts from the lead's first tap.
    saveIntakeStart({ homeownerName, homeownerPhone }, true);
    navigate("/brief");
  };

  return (
    <>
      <div className="flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-center text-xs text-background">
        <span>{DEMO_LEAD.name}'s view · nothing is sent</span>
      </div>
      <InviteWelcome
        contractor={contractor}
        brand={{ name: demo.brand, logoUrl: null, href: `/demo/${demo.slug}` }}
        door={door}
        hasBrief={false}
        defaultName={DEMO_LEAD.name}
        onStart={start}
        style={themeOf(demo)}
      />
    </>
  );
};

// ───── 2. The contractor's side: a text, then the brief ─────

const Phone = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[2.4rem] border-[10px] border-foreground/90 bg-background shadow-lift">
    <div className="h-[680px] max-h-[80vh] overflow-y-auto rounded-[1.7rem]">{children}</div>
  </div>
);

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-2xl border border-border bg-card p-4">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
    <div className="mt-2">{children}</div>
  </section>
);

const MattView = ({ demo }: { demo: DemoConfig }) => {
  const saved = useMemo(() => loadDemoBrief(demo.slug), [demo.slug]);
  const contractor = useDemoContractor(demo);
  const [opened, setOpened] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    // The demo run is over: their pages go back to normal.
    clearActiveInvite();
    track("demo_matt_viewed", { demo: demo.slug, has_brief: !!saved });
  }, [demo.slug, saved]);

  if (!saved) {
    return (
      <Page demo={demo} side="contractor">
        <h1 className="font-display text-3xl font-light">Nothing has landed yet</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Send {DEMO_LEAD.name}'s brief from the homeowner's side first.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to={`/demo/${demo.slug}`}>Start on the homeowner's side</Link>
        </Button>
      </Page>
    );
  }

  const snap = saved.snapshot;
  const name = snap.homeowner_name || DEMO_LEAD.name;
  // "Kitchen remodel", not the first line of what they typed.
  const project = jobGlance(snap).title;
  const ready = computeLeadReadiness(snap, DEMO_BUY_BOX);
  const times = cleanVisitTimes(snap.context?.visit_times);
  const claimHref = contractor?.slug ? `/pro/${contractor.slug}/claim` : "/pro/login?next=%2Fpro%2Flinks%23front-door";
  const facts = [snap.neighborhood, snap.budget, snap.timeline].filter(Boolean) as string[];
  const open = () => {
    setOpened(true);
    track("demo_brief_opened", { demo: demo.slug });
  };

  return (
    <Page demo={demo} side="contractor">
      <div className="text-center">
        <h1 className="font-display text-3xl font-light leading-tight text-balance md:text-4xl">
          {opened ? (
            <>
              {name}'s brief, <span className="italic">before the first call.</span>
            </>
          ) : (
            <>
              {who(demo)} gets a text. <span className="italic">Tap it.</span>
            </>
          )}
        </h1>
      </div>

      <div className="mt-8">
        <Phone>
          <AnimatePresence mode="wait" initial={false}>
            {!opened ? (
              <motion.div key="text" exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="min-h-full bg-background">
                <div className="flex flex-col items-center border-b border-border px-4 pb-3 pt-4">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent font-display text-base font-semibold text-accent-foreground">h</span>
                  <span className="mt-1 text-xs font-medium">Haleo · for {demo.brand}</span>
                </div>
                <div className="px-3 py-4">
                  <p className="mb-2 text-center text-[11px] text-muted-foreground">Today {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-[14px] leading-snug text-foreground/90"
                  >
                    <p>
                      <span className="font-semibold">{name}</span> shared a project brief with you through Haleo.
                    </p>
                    <p className="mt-1.5">
                      {project} · {facts.join(" · ")}
                    </p>
                    <p className="mt-1.5">{times.length ? `${name} can meet:` : `${name} hasn't picked times yet. Reply in the brief to set one up.`}</p>
                    {times.length > 0 && (
                      <ul className="mt-0.5">
                        {times.slice(0, 3).map((t) => (
                          <li key={t}>• {formatVisitTime(t)}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                  <motion.button
                    type="button"
                    onClick={open}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="relative mt-1.5 block w-[90%] overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft transition-smooth hover:-translate-y-0.5"
                    aria-label={`Open ${name}'s brief`}
                  >
                    <span className="absolute -inset-1 animate-pulse rounded-2xl ring-2 ring-accent ring-offset-2" aria-hidden />
                    <span className="relative flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft font-display text-lg text-accent-soft-foreground">{name[0]}</span>
                      <span className="min-w-0">
                        <span className="block font-display text-[16px] leading-snug">{name}'s project brief</span>
                        <span className="block truncate text-[11px] text-muted-foreground">haleo.pages.dev/b/{name.toLowerCase()}-{(project.split(" ")[0] ?? "project").toLowerCase()}</span>
                      </span>
                    </span>
                  </motion.button>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hand className="h-3.5 w-3.5" /> Tap to open
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="brief" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="min-h-full bg-gradient-warm">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
                  <button type="button" onClick={() => setOpened(false)} className="text-xs font-medium text-accent">
                    ‹ Messages
                  </button>
                  <span className="text-[13px] font-semibold">{name}'s brief</span>
                  <span className="w-14" />
                </div>
                <div className="space-y-3 px-3 pb-6 pt-3">
                  {/* The job, in one card: what Matt assesses from */}
                  <ProjectSummaryCard snapshot={snap} audience="contractor" homeownerName={name} compact />

                  <LeadToast readiness={ready} />

                  {/* Who */}
                  <section className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent-soft-foreground">{name[0]}</span>
                      <span className="min-w-0">
                        <span className="block font-display text-lg leading-tight">{name}</span>
                        <span className="block text-[12px] text-muted-foreground">Homeowner · {snap.neighborhood}</span>
                      </span>
                    </div>
                    <div className="mt-3">
                      <HomeownerContact name={name} phone={snap.homeowner_phone} compact />
                    </div>
                  </section>

                  {times.length > 0 && (
                    <Card title="When they can meet">
                      <div className="flex flex-wrap gap-2">
                        {times.map((t) => {
                          const on = confirmed === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setConfirmed(t)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                                on ? "border-sage bg-sage text-white" : "border-border bg-background hover:border-accent/50",
                              )}
                            >
                              {on ? "✓ " : ""}
                              {formatVisitTime(t)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        {confirmed ? `Confirmed. ${name} gets a text with the time.` : "Tap one to confirm the visit."}
                      </p>
                    </Card>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Phone>
      </div>

      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 text-center">
        <Button asChild size="lg" className="rounded-full" onClick={() => track("demo_cta_clicked", { demo: demo.slug })}>
          <Link to={claimHref}>
            Use this for my real leads <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">Free while we're small.</p>
        <Button asChild variant="ghost" className="rounded-full text-muted-foreground">
          <Link to={`/demo/${demo.slug}`}>
            <RotateCcw className="h-4 w-4" /> Replay the homeowner's side
          </Link>
        </Button>
      </div>
    </Page>
  );
};
