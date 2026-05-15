import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText, ShieldCheck, MapPin, FileCheck2 } from "lucide-react";
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
    <div className="container relative pt-40 pb-28 md:pt-48 md:pb-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          The trust layer for home remodeling
        </span>
        <h1 className="mt-8 font-display text-5xl font-light leading-[1.05] text-balance md:text-7xl">
          Permit history. <br className="hidden md:inline" />
          <em className="font-normal italic text-accent">Turned into proof.</em>
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          A $100K decision shouldn't run on gut feel. We surface the data
          that's already public — and make it usable.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/brief"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
          >
            Find a contractor
            <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
          </Link>
          <Link
            to="/proposal"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-7 py-4 text-sm font-medium transition-smooth hover:bg-secondary"
          >
            Audit a proposal
          </Link>
        </div>
      </motion.div>
    </div>
  </section>
);

const proofs = [
  {
    icon: FileCheck2,
    label: "Permit history",
    body: "Every job pulls a permit. Every permit is public.",
  },
  {
    icon: MapPin,
    label: "Local track record",
    body: "20 finished projects nearby beats a stranger with five stars.",
  },
  {
    icon: ShieldCheck,
    label: "Citation record",
    body: "You can buy a review. You can't buy a clean record.",
  },
];

const Insight = () => (
  <section className="bg-background py-28 md:py-36">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">The insight</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          The signals already exist. <br />
          <em className="italic text-foreground/70">They're just buried.</em>
        </h2>
      </motion.div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
        {proofs.map((p, i) => (
          <motion.div
            key={p.label}
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: i * 0.1 }}
            className="rounded-2xl border border-border bg-card p-7"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <p.icon className="h-4 w-4" />
            </div>
            <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {p.label}
            </p>
            <p className="mt-2 font-display text-lg font-light leading-snug text-foreground/90">
              {p.body}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const steps = [
  { n: "01", title: "One brief.", body: "Capture the project once. Same input goes to every contractor." },
  { n: "02", title: "Permit-proven matches.", body: "Ranked by what they've actually built nearby." },
  { n: "03", title: "Bids you can compare.", body: "Same scope in. Same scope out. Outliers flagged." },
];

const HowItWorks = () => (
  <section className="bg-secondary/40 py-28 md:py-36">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Three quiet steps.
        </h2>
      </motion.div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: i * 0.1 }}
            className="bg-card p-8 md:p-10"
          >
            <span className="font-display text-xs font-medium tracking-widest text-muted-foreground">
              {s.n}
            </span>
            <h3 className="mt-6 font-display text-2xl font-light leading-tight">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Pricing = () => (
  <section id="pricing" className="bg-background py-28 md:py-36">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Pricing</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Pay when it's <em className="italic text-foreground/70">real.</em>
        </h2>
        <p className="mt-5 text-sm text-muted-foreground">
          No subscriptions. No cold leads. No clicks.
        </p>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-3xl gap-4 md:grid-cols-2">
        <motion.div {...fadeUp} className="rounded-2xl border border-border bg-card p-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Homeowner</p>
          <p className="mt-5 font-display text-5xl font-medium">$149</p>
          <p className="mt-2 text-sm text-muted-foreground">per project</p>
          <p className="mt-5 text-sm text-foreground/80">Brief, audit, comparison, timeline.</p>
          <Link
            to="/brief"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-smooth hover:bg-primary/90"
          >
            Start <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="rounded-2xl border border-border bg-card p-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Contractor</p>
          <p className="mt-5 font-display text-5xl font-medium">$75</p>
          <p className="mt-2 text-sm text-muted-foreground">per bid</p>
          <p className="mt-5 text-sm text-foreground/80">A scoped, ready-to-hire homeowner.</p>
          <Link
            to="/pro"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-smooth hover:bg-secondary"
          >
            Join as a pro
          </Link>
        </motion.div>
      </div>
    </div>
  </section>
);

const Closing = () => (
  <section className="bg-background py-32 md:py-40">
    <motion.div {...fadeUp} className="container text-center">
      <h2 className="mx-auto max-w-3xl font-display text-5xl font-light leading-[1.05] text-balance md:text-7xl">
        The best contractors <br />
        <em className="italic text-accent">have already done the work.</em>
      </h2>
      <p className="mx-auto mt-6 max-w-md text-base text-muted-foreground">
        We just make it visible.
      </p>
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
  if (loading) return <div className="grid min-h-screen place-items-center bg-gradient-warm text-sm text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/account" replace />;
  return (
    <main>
      <Hero />
      <Insight />
      <HowItWorks />
      <Pricing />
      <Closing />
      <SiteFooter />
    </main>
  );
};

export default Index;
