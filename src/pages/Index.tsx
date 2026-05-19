import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileSearch,
  Hammer,
  MessageSquareQuote,
  ScrollText,
  Scale,
  Eye,
  HelpCircle,
} from "lucide-react";
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

/* -------------------------------------------------------------------------- */
/*  HERO — name the pain in one breath, then say what we do plainly.          */
/* -------------------------------------------------------------------------- */
const Hero = () => (
  <section className="relative overflow-hidden bg-gradient-warm">
    <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
    <SiteHeader />
    <div className="container relative pt-40 pb-24 md:pt-48 md:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          For first-time remodelers
        </span>

        <h1 className="mt-8 font-display text-5xl font-light leading-[1.05] text-balance md:text-7xl">
          Why does finding a contractor <br className="hidden md:inline" />
          take <em className="font-normal italic text-accent">months?</em>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Because you shouldn't have to chase dozens of builders just to get mismatched bids.
        </p>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground md:text-xl">
          <span className="font-medium">Haleo fixes this.</span>
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/brief"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
          >
            <Hammer className="h-4 w-4" />
            I need a contractor
            <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
          </Link>
          <Link
            to="/proposal"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
          >
            <FileSearch className="h-4 w-4" />
            I have a proposal to review
            <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Free to start. We only charge when you actually save time or money.
        </p>
      </motion.div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  THE REALITY — make the pain undeniable. All numbers from real interviews. */
/* -------------------------------------------------------------------------- */
const stats = [
  {
    n: "60",
    label: "contractors interviewed",
    sub: "for one kitchen + addition. Not unusual.",
  },
  {
    n: "2.3×",
    label: "spread between low and high bids",
    sub: "$560k vs $1.3M — same scope, different stories.",
  },
  {
    n: "~2 yrs",
    label: "from first sketch to signed contract",
    sub: "Open houses, magazines, referrals, plan checks, repeat.",
  },
];

const Reality = () => (
  <section className="bg-background py-24 md:py-32">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          The part nobody warns you about
        </p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          The search itself <em className="italic text-foreground/70">is</em> the project.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Before a single wall comes down, first-time remodelers spend months explaining the same
          project to strangers, decoding wildly different bids, and trying to figure out who's serious.
          Here's what that actually looks like, from homeowners we've sat with.
        </p>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: i * 0.08 }}
            className="rounded-2xl border border-border bg-card p-7 text-center"
          >
            <p className="font-display text-5xl font-light text-accent md:text-6xl">{s.n}</p>
            <p className="mt-3 text-sm font-medium text-foreground">{s.label}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.blockquote
        {...fadeUp}
        className="mx-auto mt-14 max-w-2xl rounded-2xl border border-border bg-secondary/40 p-7 text-center"
      >
        <p className="font-display text-xl font-light italic leading-snug text-foreground/90 md:text-2xl">
          "Contractor search is a nightmare. Even getting a realistic quote we could trust within 80%
          felt worth $100."
        </p>
        <footer className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          — Homeowner, San Jose, mid-remodel
        </footer>
      </motion.blockquote>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  WHAT HALEO DOES — three concrete capabilities in plain language.          */
/* -------------------------------------------------------------------------- */
const capabilities = [
  {
    icon: ScrollText,
    label: "One Unified Brief",
    body:
      "Skip the endless repetitive meetings. We build one master plan for your project — the same scope, photos, and dimensions go to every contractor.",
  },
  {
    icon: Eye,
    label: "Permit-Proven Builders",
    body:
      "Get a shortlist of contractors who have successfully passed local inspections for projects just like yours. Reviews can be bought. Permit history can't.",
  },
  {
    icon: Scale,
    label: "Smart Trade Analysis",
    body:
      "We invite multiple competitive bids and automatically break down every quote by price and trade — so you can see exactly where one builder is high, low, or hiding something.",
  },
];

const WhatWeDo = () => (
  <section className="bg-secondary/40 py-24 md:py-32">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">What Haleo does</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Cut the search from <em className="italic text-foreground/70">months to days.</em>
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Three quiet pieces, working together. Nothing magical — just the homework you'd do
          yourself, if you had three months and a permit-data subscription.
        </p>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
        {capabilities.map((c, i) => (
          <motion.div
            key={c.label}
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: i * 0.1 }}
            className="rounded-2xl border border-border bg-card p-7"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <c.icon className="h-4 w-4" />
            </div>
            <p className="mt-5 font-display text-lg font-normal leading-snug text-foreground">
              {c.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  HOW IT WORKS — three steps, restated in homeowner language.               */
/* -------------------------------------------------------------------------- */
const steps = [
  {
    n: "01",
    title: "Tell us about it.",
    body: "A few photos of the room, a sentence about what you want. We'll fill in dimensions, likely permits, and scope from there.",
  },
  {
    n: "02",
    title: "Pick who to talk to.",
    body: "We show contractors ranked by what they've actually built in your city — and why each one matched. You choose who to invite.",
  },
  {
    n: "03",
    title: "Compare bids honestly.",
    body: "When proposals come in, we line them up line by line, flag outliers, and translate the contractor's language into plain English.",
  },
];

const HowItWorks = () => (
  <section id="how" className="bg-background py-24 md:py-32">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Three quiet steps.
        </h2>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
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

/* -------------------------------------------------------------------------- */
/*  HONEST LIMITS — directly addresses Hari/Chitra & Jay/Koushik feedback.    */
/*  This builds trust the salesy version destroys.                            */
/* -------------------------------------------------------------------------- */
const Honest = () => (
  <section className="bg-secondary/30 py-24 md:py-28">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <HelpCircle className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            What Haleo isn't
          </p>
        </div>
        <h2 className="mt-5 font-display text-3xl font-light leading-tight text-balance md:text-4xl">
          We'd rather tell you upfront.
        </h2>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground">Permit history shows what was built, not how well.</span>{" "}
            A clean permit record means a contractor is licensed, active, and known to your city —
            it doesn't replace a site visit, references, or your own gut.
          </p>
          <p>
            <span className="text-foreground">We don't replace the walkthrough.</span>{" "}
            Hidden conditions — beams, drainage, what's behind a wall — only show up in person. We
            get you to a much better walkthrough, faster.
          </p>
          <p>
            <span className="text-foreground">We don't share your budget with contractors.</span>{" "}
            Ever, unless you explicitly opt in. We'll give <em>you</em> a realistic range for your
            project and zip code, and let the bids speak for themselves.
          </p>
        </div>
      </motion.div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  PRICING — soften and honest. No anchoring on $149 first thing they see.  */
/* -------------------------------------------------------------------------- */
const Pricing = () => (
  <section id="pricing" className="bg-background py-24 md:py-32">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Pricing</p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Free to start.{" "}
          <em className="italic text-foreground/70">Pay when it's worth it.</em>
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          Building the brief and seeing matched contractors is free. We only charge when you ask us
          to actually send invitations or audit a proposal you're holding. No subscriptions.
        </p>
      </motion.div>

      <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
        <motion.div {...fadeUp} className="rounded-2xl border border-border bg-card p-7">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Audit a proposal</p>
          <p className="mt-4 font-display text-3xl font-light">From $49</p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">
            Upload the bid you're nervous about. We translate it, check the line items against local
            permit data, and flag what's high, vague, or missing.
          </p>
          <Link
            to="/proposal"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-smooth hover:bg-secondary"
          >
            Review my proposal
          </Link>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.08 }}
          className="rounded-2xl border border-accent/30 bg-card p-7 shadow-soft"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent">Find a contractor</p>
          <p className="mt-4 font-display text-3xl font-light">From $79</p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">
            We send your brief to 2–5 permit-proven contractors near you. You stay in control of who
            sees what — and the bids come back ready to compare.
          </p>
          <Link
            to="/brief"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-smooth hover:bg-primary/90"
          >
            Start my brief <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>

      <p className="mx-auto mt-8 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        Contractors pay a small fee only when they choose to bid — so you're never the product, and
        nobody's paying us to be ranked higher.
      </p>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  CLOSING — quiet, human, honest.                                           */
/* -------------------------------------------------------------------------- */
const Closing = () => (
  <section className="bg-background py-28 md:py-36">
    <motion.div {...fadeUp} className="container text-center">
      <p className="mx-auto max-w-md text-xs font-medium uppercase tracking-[0.2em] text-accent">
        <MessageSquareQuote className="mr-2 inline h-3.5 w-3.5" />
        Our promise
      </p>
      <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-light leading-[1.1] text-balance md:text-6xl">
        You shouldn't have to become a contractor <br className="hidden md:inline" />
        <em className="italic text-accent">to hire one.</em>
      </h2>
      <p className="mx-auto mt-6 max-w-lg text-base text-muted-foreground">
        Haleo is the friend who's been through it before — quietly doing the homework so the
        biggest decision in your home doesn't have to be the loneliest.
      </p>
      <Link
        to="/brief"
        className="mt-12 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
      >
        Start with a brief
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-4 text-xs text-muted-foreground">Takes about 5 minutes. Free.</p>
    </motion.div>
  </section>
);

const Index = () => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-warm text-sm text-muted-foreground">
        Loading…
      </div>
    );
  if (user) return <Navigate to="/account" replace />;
  return (
    <main>
      <Hero />
      <Reality />
      <WhatWeDo />
      <HowItWorks />
      <Honest />
      <Pricing />
      <Closing />
      <SiteFooter />
    </main>
  );
};

export default Index;
