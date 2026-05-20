import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Ruler,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";

const EASE = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/*  Single phone — five quiet steps, one focal point.                          */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { key: "space",   label: "Show the space" },
  { key: "scope",   label: "Haleo reads it" },
  { key: "brief",   label: "Your brief" },
  { key: "matches", label: "Permit-proven matches" },
  { key: "bids",    label: "Bids, side by side" },
] as const;

const PhoneShell = ({ children }: { children: React.ReactNode }) => (
  <div
    className="relative mx-auto rounded-[2.5rem] border border-foreground/10 bg-foreground/95 p-[8px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
    style={{ width: 280 }}
  >
    <div className="relative h-[560px] overflow-hidden rounded-[2.1rem] bg-background">
      <div className="absolute left-1/2 top-1.5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-foreground/95" />
      <div className="h-full overflow-hidden px-5 pb-5 pt-10">{children}</div>
    </div>
  </div>
);

/* Locked storyline so every screen stays consistent ----------------------- */
const SPACE = {
  room: "Kitchen",
  sqft: "~140 sq ft",
  layout: "galley",
  zip: "95128",
  budget: "~$140k",
  timeline: "8 wks",
};

const BUG_OPTIONS = [
  "cramped layout",        // 0 ✓
  "no island",             // 1 ✓
  "gas stove",             // 2
  "dark, no light",        // 3 ✓
  "wasted corners",        // 4
  "low storage",           // 5 ✓
  "closed off from living",// 6 ✓
  "old appliances",        // 7
  "awkward fridge spot",   // 8
  "no prep space",         // 9
];

const SELECTION_ORDER = [0, 3, 6, 5, 1];

/* Each picked bug → what Haleo sees in the photos + what lands in the brief */
const BUG_MAP: Record<number, { sees: string; brief: string }> = {
  0: { sees: "Tight galley, ~3'6\" aisle", brief: "Open galley, widen aisle to 4'+" },
  3: { sees: "Single small window — low daylight", brief: "Enlarge window, add recessed + pendants" },
  6: { sees: "Solid wall separating living room", brief: "Remove wall to living, half-height bar" },
  5: { sees: "Uppers on one wall only — limited storage", brief: "Full-height pantry wall + drawer base" },
  1: { sees: "No island, prep on counter edge", brief: "New 7' island, 3-stool seating" },
};

const ScreenSpace = () => {
  const [picked, setPicked] = useState<number[]>([]);
  const [photos, setPhotos] = useState(0);

  useEffect(() => {
    setPicked([]);
    setPhotos(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Upload photos one by one first
    [1, 2, 3].forEach((n, i) => {
      timers.push(setTimeout(() => setPhotos(n), 250 + i * 280));
    });
    // Then start picking bugs
    SELECTION_ORDER.forEach((idx, i) => {
      timers.push(
        setTimeout(() => {
          setPicked((p) => (p.includes(idx) ? p : [...p, idx]));
        }, 1300 + i * 340),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const labels = picked.map((i) => BUG_OPTIONS[i]);
  const sentence =
    labels.length === 0
      ? "Tap what's bugging you…"
      : labels.length === 1
      ? `It feels ${labels[0]}.`
      : `It feels ${labels.slice(0, -1).join(", ")} and ${labels.slice(-1)}.`;

  return (
    <div className="flex h-full flex-col">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Remodeling
      </p>
      <div className="mt-0.5 flex items-baseline gap-2">
        <p className="font-display text-[15px] leading-tight">{SPACE.room}</p>
        <span className="text-[10px] text-muted-foreground">
          {SPACE.sqft} · {SPACE.layout}
        </span>
      </div>

      {/* Upload row — 3 photo slots that fill in */}
      <p className="mt-2.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        Photos
      </p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => {
          const filled = photos > i;
          return (
            <div
              key={i}
              className={`relative aspect-[4/3] overflow-hidden rounded-md border transition-all duration-300 ${
                filled ? "border-border" : "border-dashed border-foreground/20 bg-secondary/40"
              }`}
            >
              {filled ? (
                <div
                  className={`h-full w-full ${
                    i === 0
                      ? "bg-gradient-to-br from-amber-200/50 via-amber-100/30 to-stone-300/40"
                      : i === 1
                      ? "bg-gradient-to-br from-stone-300/50 via-stone-200/30 to-zinc-300/40"
                      : "bg-gradient-to-br from-zinc-200/50 via-amber-100/20 to-stone-300/40"
                  }`}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex h-full items-end justify-start p-1"
                  >
                    <span className="rounded bg-background/80 px-1 py-px text-[8px] text-foreground backdrop-blur">
                      IMG_{String(i + 1).padStart(2, "0")}
                    </span>
                  </motion.div>
                </div>
              ) : (
                <div className="grid h-full place-items-center">
                  <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        What's bugging you?
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {BUG_OPTIONS.map((c, idx) => {
          const active = picked.includes(idx);
          return (
            <span
              key={c}
              className={`rounded-full border px-1.5 py-[3px] text-[9.5px] transition-all duration-300 ${
                active
                  ? "border-accent bg-accent text-accent-foreground scale-[1.03]"
                  : "border-foreground/15 bg-card text-foreground/65"
              }`}
            >
              {c}
            </span>
          );
        })}
      </div>

      <div className="mt-auto rounded-xl border border-border bg-secondary/60 px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">In your words</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={sentence}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="mt-0.5 text-[11px] leading-snug text-foreground"
          >
            {sentence}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};

const ScreenScope = () => (
  <div className="flex h-full flex-col">
    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Haleo sees</p>
    <p className="mt-1 font-display text-lg leading-tight">
      {SPACE.sqft} {SPACE.layout}
    </p>

    <div className="mt-4 space-y-2">
      {SELECTION_ORDER.map((idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 rounded-xl border border-border bg-card px-2.5 py-2"
        >
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
          <p className="text-[11px] leading-snug text-foreground">{BUG_MAP[idx].sees}</p>
        </div>
      ))}
    </div>

    <div className="mt-auto rounded-xl bg-secondary/60 px-3 py-2 text-[10px] text-muted-foreground">
      Looks right? <span className="text-foreground">Confirmed ✓</span>
    </div>
  </div>
);

const ScreenBrief = () => (
  <div className="flex h-full flex-col">
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Your brief</p>
      <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
    </div>
    <p className="mt-1 font-display text-lg leading-tight">Ready to send</p>

    <div className="mt-4 space-y-2">
      {SELECTION_ORDER.map((idx) => (
        <div key={idx} className="rounded-xl border border-border bg-card px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {BUG_OPTIONS[idx]}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground">{BUG_MAP[idx].brief}</p>
        </div>
      ))}
    </div>

    <div className="mt-auto flex flex-wrap gap-1.5">
      {[SPACE.zip, SPACE.budget, SPACE.timeline].map((t) => (
        <span
          key={t}
          className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </div>
  </div>
);

const ScreenMatches = () => (
  <div className="flex h-full flex-col">
    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Matched builders</p>
    <p className="mt-1 font-display text-lg leading-tight">4 permit-proven</p>

    <div className="mt-4 space-y-2">
      {[
        { name: "Mehdi Builders", meta: "11 kitchens · 95128", dist: "1.2 mi" },
        { name: "Westwood & Co.", meta: "8 kitchens · 95126", dist: "1.8 mi" },
        { name: "Casa Verde", meta: "6 kitchens · 95128", dist: "0.9 mi" },
        { name: "Lozano Group", meta: "9 kitchens · 95128", dist: "2.1 mi" },
      ].map((c) => (
        <div key={c.name} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary">
            <ShieldCheck className="h-4 w-4 text-foreground/70" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-medium text-foreground">{c.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{c.meta}</p>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{c.dist}</span>
        </div>
      ))}
    </div>
  </div>
);

const ScreenBids = () => {
  const trades = [
    { t: "Cabinets", a: 22, b: 28, c: 24 },
    { t: "Plumbing", a: 14, b: 13, c: 16 },
    { t: "Tile", a: 11, b: 19, c: 12 },
    { t: "Electrical", a: 9, b: 11, c: 10 },
  ];
  return (
    <div className="flex h-full flex-col">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">3 bids in</p>
      <p className="mt-1 font-display text-lg leading-tight">Compare line by line</p>

      <div className="mt-4 grid grid-cols-[1fr_repeat(3,22px)] gap-x-2 text-[10px] text-muted-foreground">
        <span />
        <span className="text-center font-medium text-foreground">M</span>
        <span className="text-center font-medium text-foreground">W</span>
        <span className="text-center font-medium text-foreground">C</span>
      </div>

      <div className="mt-2 space-y-2">
        {trades.map((row) => {
          const vals = [row.a, row.b, row.c];
          const lo = Math.min(...vals);
          return (
            <div key={row.t} className="rounded-xl border border-border bg-card px-2.5 py-1.5">
              <div className="grid grid-cols-[1fr_repeat(3,22px)] items-center gap-x-2">
                <span className="text-[11px] text-foreground">{row.t}</span>
                {vals.map((v, i) => (
                  <span
                    key={i}
                    className={`text-center text-[10px] tabular-nums ${
                      v === lo ? "font-medium text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {v}k
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">Total spread</span>
        <span className="text-[11px] font-medium tabular-nums text-foreground">$56k → $71k</span>
      </div>
    </div>
  );
};

const SCREENS = [ScreenSpace, ScreenScope, ScreenBrief, ScreenMatches, ScreenBids];

const Hero = () => {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SCREENS.length), 3200);
    return () => clearInterval(t);
  }, []);

  const Screen = SCREENS[i];

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[80vh] bg-gradient-warm" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent/8 blur-[140px]"
        aria-hidden
      />

      <SiteHeader />

      <div className="container relative pt-28 pb-20 md:pt-36 md:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="font-display text-[2.75rem] font-light leading-[1.04] tracking-tight text-balance md:text-[5.25rem]">
            Hire your contractor in{" "}
            <em className="font-normal italic text-accent">days,</em>
            <br className="hidden md:inline" /> not{" "}
            <em className="font-normal italic text-accent">months.</em>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            Upload what you already have. Get a clean brief and permit-proven bids — side by side.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/brief"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90"
            >
              Start my brief
              <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
            </Link>
            <Link
              to="/proposal"
              className="text-sm font-medium text-muted-foreground transition-smooth hover:text-foreground"
            >
              I have a proposal to review
            </Link>
          </div>
        </motion.div>

        {/* Single focal phone */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
          className="relative mt-16"
        >
          <PhoneShell>
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="h-full"
              >
                <Screen />
              </motion.div>
            </AnimatePresence>
          </PhoneShell>

          {/* Step indicator — quiet rail */}
          <div className="mt-10 flex items-center justify-center gap-6">
            {STEPS.map((s, idx) => (
              <button
                key={s.key}
                onClick={() => setI(idx)}
                className="group flex flex-col items-center gap-2"
                aria-label={s.label}
              >
                <span
                  className={`h-1 rounded-full transition-all duration-500 ${
                    idx === i ? "w-8 bg-accent" : "w-4 bg-border group-hover:bg-foreground/30"
                  }`}
                />
                <span
                  className={`hidden text-[10px] uppercase tracking-[0.14em] transition-colors md:block ${
                    idx === i ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Three calm value lines — no chrome, just typography.                       */
/* -------------------------------------------------------------------------- */

const Value = () => (
  <section className="bg-background py-28 md:py-40">
    <div className="container mx-auto max-w-4xl">
      <div className="grid gap-x-12 gap-y-16 md:grid-cols-3">
        {[
          {
            n: "01",
            t: "One brief.",
            b: "We read your photos, walkthrough and plans, then write the scope once — so you never repeat yourself.",
          },
          {
            n: "02",
            t: "Permit-proven.",
            b: "Only builders who've actually passed inspections for projects like yours in your zip. Reviews can be bought; permit history can't.",
          },
          {
            n: "03",
            t: "Bids, compared.",
            b: "Every trade, every line — side by side. See exactly where each builder is high or low before you decide.",
          },
        ].map((s, idx) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE, delay: idx * 0.1 }}
          >
            <p className="font-display text-xs tracking-[0.2em] text-accent">{s.n}</p>
            <h3 className="mt-4 font-display text-2xl font-light leading-tight text-foreground">{s.t}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.b}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Closing — single confident line, one CTA.                                  */
/* -------------------------------------------------------------------------- */

const Closing = () => (
  <section className="relative overflow-hidden bg-gradient-warm py-32 md:py-44">
    <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-60" aria-hidden />
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: EASE }}
      className="container relative text-center"
    >
      <h2 className="mx-auto max-w-3xl font-display text-4xl font-light leading-[1.05] tracking-tight text-balance md:text-6xl">
        You shouldn't have to become a contractor{" "}
        <em className="italic text-accent">to hire one.</em>
      </h2>
      <Link
        to="/brief"
        className="mt-12 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90"
      >
        Start with a brief
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-5 text-xs text-muted-foreground">Free to start. About 5 minutes.</p>
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
      <Value />
      <Closing />
      <SiteFooter />
    </main>
  );
};

export default Index;
