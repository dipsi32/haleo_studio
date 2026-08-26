import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Image as ImageIcon,
  Upload,
  FileText,
  MapPinCheck,
  
} from "lucide-react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";
import shotBrief from "@/assets/screens/shot-brief.png";
import shotMatches from "@/assets/screens/shot-matches.png";
import shotAudit from "@/assets/screens/shot-audit.png";

const EASE = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/*  Single phone — the painkiller flow. Audit first, then everything else.    */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { key: "brief",   label: "Say it in one sentence",       payoff: "We turn it into a contractor-ready brief." },
  { key: "matches", label: "Meet contractors with permits", payoff: "Ranked on jobs like yours, pulled near you." },
  { key: "audit",   label: "See if the price is fair",     payoff: "Your quote against real local costs." },
] as const;


const PhoneShell = ({ children }: { children: React.ReactNode }) => (
  <div
    className="relative mx-auto rounded-[2.5rem] border border-foreground/10 bg-foreground/95 p-[8px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
    style={{ width: 280 }}
  >
    <div className="relative h-[560px] overflow-hidden rounded-[2.1rem] bg-background">
      <div className="absolute inset-x-0 top-0 z-20 h-8 bg-background" />
      <div className="absolute left-1/2 top-2 z-30 h-4 w-24 -translate-x-1/2 rounded-full bg-foreground/95" />
      <div className="absolute inset-x-0 bottom-0 top-8 overflow-hidden">{children}</div>
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

/* Pain options match PAIN_BY_ROOM.kitchen from /brief exactly */
const BUG_OPTIONS = [
  "Too dark",                  // 0 ✓
  "Cramped",                   // 1 ✓
  "Layout doesn't work",       // 2 ✓
  "Not enough counter space",  // 3
  "No room to cook together",  // 4
  "Dated cabinets",            // 5
  "No storage",                // 6 ✓
  "Appliances need upgrading", // 7
  "No island",                 // 8 ✓
];

const SELECTION_ORDER = [1, 0, 2, 6, 8];

/* Each picked pain → what Haleo sees + what becomes the brief line */
const BUG_MAP: Record<number, { sees: string; brief: string }> = {
  1: { sees: "Tight galley, ~3'6\" aisle", brief: "Open galley, widen aisle to 4'+" },
  0: { sees: "Single small window — low daylight", brief: "Enlarge window, add recessed + pendants" },
  2: { sees: "Wall blocks flow to living room", brief: "Remove wall to living, half-height bar" },
  6: { sees: "Uppers on one wall only", brief: "Full-height pantry wall + drawer bases" },
  8: { sees: "No island, prep on counter edge", brief: "New 7' island, 3-stool seating" },
};

const ROOMS = ["Kitchen", "Bathroom", "Living", "Addition"] as const;

const ScreenSpace = () => {
  const [picked, setPicked] = useState<number[]>([]);
  const [photos, setPhotos] = useState(0);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    setPicked([]);
    setPhotos(0);
    setUploading(null);
    const timers: ReturnType<typeof setTimeout>[] = [];

    /* Upload sequence: show uploading indicator, then fill each slot */
    [0, 1, 2].forEach((i) => {
      timers.push(
        setTimeout(() => setUploading(i), 300 + i * 420),
      );
      timers.push(
        setTimeout(() => {
          setUploading(null);
          setPhotos(i + 1);
        }, 750 + i * 420),
      );
    });

    SELECTION_ORDER.forEach((idx, i) => {
      timers.push(
        setTimeout(() => {
          setPicked((p) => (p.includes(idx) ? p : [...p, idx]));
        }, 2000 + i * 340),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const labels = picked.map((i) => BUG_OPTIONS[i].toLowerCase());
  const sentence =
    labels.length === 0
      ? "Tap what's bugging you…"
      : labels.length === 1
      ? `It feels ${labels[0]}.`
      : `It feels ${labels.slice(0, -1).join(", ")} and ${labels.slice(-1)}.`;

  return (
    <div className="flex h-full flex-col">
      <p className="font-display text-[14px] leading-tight">
        Where's the dream taking shape?
      </p>
      <p className="mt-0.5 text-[9.5px] text-muted-foreground">
        Tap one. You can swap rooms anytime.
      </p>

      {/* Room picker — Kitchen selected */}
      <div className="mt-2 grid grid-cols-4 gap-1">
        {ROOMS.map((r) => {
          const active = r === SPACE.room;
          return (
            <div
              key={r}
              className={`rounded-md border px-1 py-1.5 text-center text-[9px] transition-all ${
                active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {r}
            </div>
          );
        })}
      </div>


      {/* Upload row — 3 photo slots that fill in */}
      <p className="mt-2.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        Photos
      </p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => {
          const filled = photos > i;
          const isUploading = uploading === i;
          return (
            <div
              key={i}
              className={`relative aspect-[4/3] overflow-hidden rounded-md border transition-all duration-300 ${
                filled ? "border-border" : "border-dashed border-foreground/20 bg-secondary/40"
              }`}
            >
              {isUploading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-full flex-col items-center justify-center gap-1"
                >
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9 }}
                  >
                    <ImageIcon className="h-4 w-4 text-accent" />
                  </motion.div>
                  <span className="text-[8px] text-muted-foreground">Uploading…</span>
                  <div className="mx-3 h-1 w-16 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full bg-accent"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                    />
                  </div>
                </motion.div>
              ) : filled ? (
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

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    className="absolute inset-0 h-full w-full max-w-none object-cover object-top"
  />
);

const ScreenBrief = () => <Shot src={shotBrief} alt="Haleo brief builder: describe your project in one sentence" />;

const ScreenMatches = () => <Shot src={shotMatches} alt="Haleo contractor match with San Jose permit history" />;


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

const ScreenAudit = () => <Shot src={shotAudit} alt="Haleo quote audit: verdict, where your quote lands against the local fair range" />;


const SCREENS = [ScreenBrief, ScreenMatches, ScreenAudit];

/* One live tease instead of paragraphs: a zip already filled in, counting up. */
const Counter = ({ to, suffix }: { to: number; suffix: string }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <span className="whitespace-nowrap">
      <span className="font-display text-foreground">{n}</span> {suffix}
    </span>
  );
};

const LiveTease = () => (
  <Link
    to="/brief"
    onClick={() => track("cta_match_clicked", { location: "hero_tease" })}
    className="group mt-8 flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-smooth hover:border-accent/40 hover:shadow-soft"
  >
    <MapPinCheck className="h-4 w-4 shrink-0 text-accent" />
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">95128</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
        <Counter to={47} suffix="permitted kitchens" />
        <span className="text-border">·</span>
        <Counter to={3} suffix="clean records" />
      </p>
    </div>
    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
  </Link>
);

const Hero = () => {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SCREENS.length), 5200);
    return () => clearInterval(t);
  }, [paused]);

  const Screen = SCREENS[i];

  return (
    <section className="relative overflow-hidden bg-background">
      <SiteHeader />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.08),transparent_55%)]" />

      <div className="container mx-auto max-w-5xl px-6 pb-24 pt-28 md:pb-32 md:pt-36">
        <div className="grid items-center gap-16 md:grid-cols-[1.05fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className="eyebrow text-accent">Built on city permit records</p>
            <h1 className="mt-6 text-balance text-foreground">
              Who actually built the kitchen down your street?
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Find them, and know what your quote should cost. 60 seconds, no signup.
            </p>

            <LiveTease />

            <div className="mt-6 grid gap-3 sm:max-w-md sm:grid-cols-2">
              <Link
                to="/brief"
                onClick={() => track("cta_match_clicked", { location: "hero" })}
                className="group flex items-center justify-between gap-3 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-smooth hover:bg-foreground/90"
              >
                Find my contractor
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/roast"
                onClick={() => track("cta_roast_clicked", { location: "hero" })}
                className="group flex items-center justify-between gap-3 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-smooth hover:border-accent/40"
              >
                Check my quote
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <PhoneShell>
              <AnimatePresence mode="wait">
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="h-full"
                >
                  <Screen />
                </motion.div>
              </AnimatePresence>
            </PhoneShell>

            <div className="mx-auto mt-6 max-w-[300px] space-y-1">
              {STEPS.map((s, idx) => {
                const active = idx === i;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => { setI(idx); setPaused(true); }}
                    aria-current={active}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-smooth ${
                      active ? "bg-secondary/70" : "hover:bg-secondary/40"
                    }`}
                  >
                    <span
                      className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-medium tabular-nums ${
                        active ? "bg-foreground text-background" : "bg-foreground/10 text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {s.label}
                      </span>
                      {active && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{s.payoff}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  One quiet line after the demo — no screen-by-screen explaining.           */
/* -------------------------------------------------------------------------- */

const Value = () => (
  <section className="border-t border-border bg-background py-20 md:py-24">
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="container mx-auto max-w-2xl px-6 text-center"
    >
      <h2 className="text-balance text-foreground">
        Your neighbors already hired the good ones.
      </h2>
      <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground">
        We read the city's permit records so you don't have to — who built what, where, and
        whether it passed inspection.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/brief"
          onClick={() => track("cta_match_clicked", { location: "value" })}
          className="group flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-smooth hover:bg-foreground/90"
        >
          Find my contractor
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/roast"
          onClick={() => track("cta_roast_clicked", { location: "value" })}
          className="rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-smooth hover:border-accent/40"
        >
          Check my quote
        </Link>
      </div>
    </motion.div>
  </section>
);



/* -------------------------------------------------------------------------- */
/*  The difference — reviews vs. records.                                      */
/* -------------------------------------------------------------------------- */

const CONTRASTS = [
  { them: "Star ratings from strangers", us: "Permits pulled, inspections passed" },
  { them: "Matched by zip code", us: "Matched by what you're building" },
  { them: "Five calls in five minutes", us: "A brief they read before they bid" },
  { them: "Apples-to-oranges quotes", us: "Every line item, side by side" },
];

const NotLike = () => (
  <section className="bg-foreground py-24 text-background md:py-32">
    <div className="container mx-auto max-w-3xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <p className="eyebrow text-accent">The difference</p>
        <h2 className="mt-5 text-balance">
          Reviews tell you how someone felt. Permits tell you what got built.
        </h2>
      </motion.div>

      <div className="mt-14 divide-y divide-background/10 border-y border-background/10">
        {CONTRASTS.map((row, idx) => (
          <motion.div
            key={row.them}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: EASE, delay: idx * 0.06 }}
            className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-2 sm:gap-8"
          >
            <p className="text-base text-background/40 line-through decoration-background/25">
              {row.them}
            </p>
            <p className="text-base text-background">{row.us}</p>
          </motion.div>
        ))}
      </div>

      <p className="mt-10 text-base text-background/50">Live in San Jose.</p>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Closing — one line, one CTA.                                               */
/* -------------------------------------------------------------------------- */

const Closing = () => (
  <section className="border-t border-border bg-background py-28 md:py-36">
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: EASE }}
      className="container mx-auto max-w-2xl px-6 text-center"
    >
      <h2 className="text-balance">Ready when you are.</h2>
      <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground">
        Start without an account. We'll only ask you to sign up once your matches are ready.
      </p>
      <Link
        to="/brief"
        className="group mt-9 inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-smooth hover:bg-foreground/90"
      >
        Start my brief — free
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-5 text-sm text-muted-foreground">
        Already have a quote?{" "}
        <Link to="/roast" className="font-medium text-foreground underline underline-offset-4">
          Check it here
        </Link>
      </p>
    </motion.div>
  </section>
);

const Index = () => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  if (user) return <Navigate to="/account" replace />;
  return (
    <main>
      <Hero />
      <Value />
      <NotLike />
      <Closing />
      <SiteFooter />
    </main>
  );
};

export default Index;

