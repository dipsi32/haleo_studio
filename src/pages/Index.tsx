import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Sparkles, Compass, ShieldCheck, CalendarCheck2, Check } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: EASE },
} as const;

const Hero = () => (
  <section className="relative overflow-hidden bg-gradient-warm">
    <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
    <SiteHeader />
    <div className="container relative pt-40 pb-28 md:pt-48 md:pb-36">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Now serving homeowners in San Jose
        </span>
        <h1 className="mt-8 font-display text-5xl font-light leading-[1.05] text-balance md:text-7xl">
          Stop dreading <br className="hidden md:inline" />
          <em className="font-normal italic text-accent">your remodel.</em>
        </h1>
        <div className="mt-10 space-y-1.5 font-display text-xl text-foreground/80 md:text-2xl">
          <p>Know if the price is fair.</p>
          <p>Know who to hire.</p>
          <p>Know every step before it happens.</p>
        </div>
        <p className="mx-auto mt-10 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
          Hire contractors using <span className="text-foreground">real permit history</span> —
          not Yelp reviews, not guesswork, not the loudest ad.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/brief"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
          >
            Find a permit-proven contractor
            <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
          </Link>
          <Link
            to="/audit"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-7 py-4 text-sm font-medium transition-smooth hover:bg-secondary"
          >
            Got a proposal? Get a free forensic read
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Two doors, one promise: no paid placements, no marketing fluff — just proof.
        </p>
      </motion.div>

      {/* Floating brief preview */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: EASE }}
        className="relative mx-auto mt-20 max-w-3xl"
      >
        <div className="rounded-3xl border border-border bg-card p-6 shadow-lift md:p-8">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-display text-base font-medium">Your Project Brief</p>
              <p className="text-xs text-muted-foreground">Kitchen · San Jose · $40k–70k</p>
            </div>
            <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage">
              Permit likely
            </span>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">In your words</p>
              <p className="mt-2 font-display text-lg leading-snug text-foreground/90">
                "We're doing a full kitchen remodel. The layout has never worked — it's dark and cramped.
                We want to open it up and finally make it feel like ours."
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-[11px] uppercase tracking-wider text-accent">For your contractor →</p>
              <p className="mt-2 font-mono text-[13px] leading-relaxed text-foreground/80">
                Full kitchen gut renovation. Removal of non-load-bearing partition.
                New island w/ plumbing rough-in. 12–15 recessed cans, 2–3 zones.
                Full cabinet replacement. 36" range, built-in refrigerator.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-lift md:block">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Haleo Score</p>
          <p className="font-display text-3xl font-medium text-accent">87</p>
        </div>
      </motion.div>
    </div>
  </section>
);

const steps = [
  {
    n: "01",
    icon: Sparkles,
    title: "Translate your dream into a scoped brief",
    body: "Tell us what you want. We turn it into a clear, contractor-ready scope — no jargon, no guesswork.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "See only contractors who've done it nearby",
    body: "We show you pros who've actually pulled permits for similar projects in your area. No random lists.",
  },
  {
    n: "03",
    icon: CalendarCheck2,
    title: "Invite multiple bids, pick the best one",
    body: "Send your brief to several contractors at once, compare proposals side-by-side, and choose with confidence.",
  },
];

const HowItWorks = () => (
  <section id="how" className="bg-background py-28 md:py-36">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Three quiet steps. <br />
          <em className="italic text-foreground/70">One unfair advantage.</em>
        </h2>
      </motion.div>

      <div className="mt-20 grid gap-10 md:grid-cols-3 md:gap-6">
        {steps.map((step, i) => (
          <motion.div
            key={step.n}
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: i * 0.12 }}
            className="group relative rounded-3xl border border-border bg-card p-8 shadow-soft transition-smooth hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-medium tracking-widest text-muted-foreground">
                {step.n}
              </span>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent transition-smooth group-hover:bg-accent group-hover:text-accent-foreground">
                <step.icon className="h-5 w-5" />
              </div>
            </div>
            <h3 className="mt-8 font-display text-2xl font-medium leading-tight">{step.title}</h3>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">{step.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Pricing = () => (
  <section id="pricing" className="relative overflow-hidden bg-secondary/40 py-28 md:py-36">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Pricing</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Two numbers. <em className="italic text-foreground/70">Instantly clear.</em>
        </h2>
        <p className="mt-5 text-base text-muted-foreground">
          No subscriptions, no feature matrices, no surprises.
        </p>
      </motion.div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl bg-card p-8 shadow-lift md:p-10"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-accent" />
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <Compass className="h-4 w-4" /> Homeowner
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-6xl font-medium">$149</span>
            <span className="text-sm text-muted-foreground">flat</span>
          </div>
          <p className="mt-4 font-display text-xl leading-snug">Hire with confidence.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            One payment. Brief, audit, timeline, pulse — every room covered.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Translated project brief (homeowner + contractor view)",
              "Forensic audit on every proposal you receive",
              "Shared timeline with lead-time alerts and inspections",
              "Branded PDFs to send to anyone",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-foreground/80">{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/brief"
            className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-smooth hover:bg-primary/90"
          >
            Let's get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-background p-8 md:p-10"
        >
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Contractor
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-6xl font-medium">$75</span>
            <span className="text-sm text-muted-foreground">per project</span>
          </div>
          <p className="mt-4 font-display text-xl leading-snug">Get a ready-to-sign client.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No subscription. Pay only when there's a real project on the table.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Full project brief with scope, vibe, and budget",
              "Walkthrough video, floor plan, and photos",
              "Submit proposals directly back to the homeowner",
              "Shared timeline — never chase a homeowner again",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <span className="text-foreground/80">{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/audit"
            className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-4 text-sm font-medium transition-smooth hover:bg-secondary"
          >
            Join as a contractor
          </Link>
        </motion.div>
      </div>

      <motion.p {...fadeUp} className="mt-10 text-center text-xs text-muted-foreground">
        Pilot users: full product, no payment prompt. We'll check in after your project wraps.
      </motion.p>
    </div>
  </section>
);

const Closing = () => (
  <section className="bg-background py-32 md:py-40">
    <motion.div {...fadeUp} className="container text-center">
      <h2 className="mx-auto max-w-3xl font-display text-5xl font-light leading-[1.05] text-balance md:text-7xl">
        Haleo. <br />
        <em className="italic text-accent">Your unfair advantage.</em>
      </h2>
      <Link
        to="/brief"
        className="mt-12 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
      >
        Start your brief
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  </section>
);

const Index = () => {
  const { user, loading } = useAuth();
  // Returning users land straight in their account — marketing page is for visitors.
  if (loading) return <div className="grid min-h-screen place-items-center bg-gradient-warm text-sm text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/account" replace />;
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Pricing />
      <Closing />
      <SiteFooter />
    </main>
  );
};

export default Index;
