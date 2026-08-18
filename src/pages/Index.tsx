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
  Flame,
} from "lucide-react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";
import { track, type AnalyticsEvent } from "@/lib/analytics";

const EASE = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/*  Single phone — the painkiller flow. Audit first, then everything else.    */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { key: "audit",   label: "Audit the quote" },
  { key: "brief",   label: "Brief, written for you" },
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

/* Audit screen — the painkiller. Drop a quote, see where it lands. */
const ScreenAudit = () => {
  const [phase, setPhase] = useState<"drop" | "scan" | "verdict">("drop");
  useEffect(() => {
    setPhase("drop");
    const t1 = setTimeout(() => setPhase("scan"), 900);
    const t2 = setTimeout(() => setPhase("verdict"), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Audit a proposal</p>
      <p className="mt-1 font-display text-lg leading-tight">Where does it land?</p>

      {/* Upload tile */}
      <div className="mt-3 rounded-xl border border-dashed border-foreground/20 bg-secondary/40 p-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15">
            <FileText className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-foreground">kitchen-quote.pdf</p>
            <p className="text-[9px] text-muted-foreground">3 pages · 18 line items</p>
          </div>
          {phase === "drop" && <Upload className="h-3.5 w-3.5 text-muted-foreground" />}
          {phase !== "drop" && <CheckCircle2 className="h-3.5 w-3.5 text-accent" />}
        </div>
        {phase === "scan" && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
          </div>
        )}
      </div>

      {/* Verdict */}
      <AnimatePresence>
        {phase === "verdict" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-3 space-y-2"
          >
            <div className="rounded-xl border border-border bg-card p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Verdict</p>
                <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-medium text-amber-700">High</span>
              </div>
              <p className="mt-1 font-display text-base leading-tight text-foreground">$148k quote</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Local fair range $112k – $134k</p>
            </div>

            {[
              { t: "Backsplash", v: "$12k", n: "fair $3.8–5.2k", flag: true },
              { t: "Cabinets", v: "$38k", n: "in range", flag: false },
              { t: "Demo + haul", v: "$9k", n: "high for 140 sqft", flag: true },
            ].map((row) => (
              <div key={row.t} className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground">{row.t}</p>
                  <p className="text-[9px] text-muted-foreground">{row.n}</p>
                </div>
                <span className={`text-[10px] tabular-nums ${row.flag ? "font-medium text-amber-700" : "text-muted-foreground"}`}>{row.v}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto rounded-xl bg-secondary/60 px-3 py-2 text-[10px] text-muted-foreground">
        Free · 30 seconds · <span className="text-foreground">no signup</span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Hero — the pitch in one breath, two doors, no clutter.                     */
/* -------------------------------------------------------------------------- */

const Hero = () => (
  <section className="relative overflow-hidden bg-background">
    <SiteHeader />
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.10),transparent_55%)]" />

    <div className="container mx-auto max-w-3xl px-6 pb-16 pt-24 text-center md:pb-24 md:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          <MapPinCheck className="h-3.5 w-3.5" /> San Jose
        </div>

        <h1 className="font-display text-[2.5rem] font-medium leading-[0.98] tracking-tight text-balance text-foreground md:text-[4rem]">
          A six-figure decision
          <br className="hidden sm:block" /> shouldn't run on{" "}
          <span className="italic text-accent">Yelp reviews.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-[1.0625rem]">
          Describe your project once. Haleo writes the scoped brief, matches you to the
          three contractors who have verifiably done it near you, and audits any quote
          line by line — using city permit records, not star ratings.
        </p>

        <div className="mx-auto mt-9 grid gap-3 text-left sm:max-w-lg">
          <Link
            to="/brief"
            onClick={() => track("cta_match_clicked", { location: "hero" })}
            className="group flex items-center gap-4 rounded-2xl border border-foreground/15 bg-foreground px-5 py-4 text-background shadow-lift transition-smooth hover:bg-foreground/90"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">I need a contractor</p>
              <p className="mt-0.5 text-[12.5px] text-background/70">
                Describe it in a sentence — about 3 minutes, no signup.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/roast"
            onClick={() => track("cta_roast_clicked", { location: "hero" })}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-smooth hover:border-accent/40 hover:shadow-soft"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground">I already have a quote</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Paste or upload it. We check every line against local costs — free, 30 seconds.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          San Jose only for now. Nothing reaches a contractor until you say so.
        </p>
      </motion.div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  The cost of doing it alone — the pain, stated plainly.                     */
/* -------------------------------------------------------------------------- */

const FACTS = [
  { stat: "95%", line: "get three or more bids", sub: "Your vision, explained from scratch to three strangers. Three site visits. Three waits." },
  { stat: "72%", line: "would pay more to trust someone", sub: "But the only evidence on offer is a star rating and a neighbor's hunch." },
  { stat: "58%", line: "run longer than expected", sub: "Scope written loosely at the start is scope that drifts at the end." },
  { stat: "48%", line: "spend more than planned", sub: "With no benchmark, a high line item looks the same as a fair one." },
];

const Pain = () => (
  <section className="border-y border-border bg-secondary/30 py-20 md:py-28">
    <div className="container mx-auto max-w-5xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="max-w-2xl"
      >
        <p className="font-display text-xs tracking-[0.25em] text-accent">THE PART NOBODY WARNS YOU ABOUT</p>
        <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-tight text-balance md:text-4xl">
          You end up doing the work of a procurement team. Alone. On bad data.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Remodeling is a $600 billion industry, and the homeowner is the only person in it
          without a research department. Hours of private searching before you talk to
          anyone, and no way to verify a single thing you find.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2">
        {FACTS.map((f, idx) => (
          <motion.div
            key={f.stat}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE, delay: idx * 0.07 }}
            className="bg-background p-6 md:p-8"
          >
            <p className="font-display text-4xl font-light tracking-tight text-foreground md:text-5xl">{f.stat}</p>
            <p className="mt-2 text-sm font-medium text-foreground">{f.line}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.sub}</p>
          </motion.div>
        ))}
      </div>

      <p className="mt-8 max-w-xl text-sm text-muted-foreground">
        Most homeowners spend weeks finding someone they can barely trust. Below is what
        the same afternoon looks like with permit records doing the vouching.
      </p>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Guided demo — two tracks, real screens, one step at a time.                */
/* -------------------------------------------------------------------------- */

type DemoStep = { key: string; label: string; caption: string; Screen: () => JSX.Element };

const TRACKS: {
  id: "match" | "audit";
  tab: string;
  blurb: string;
  cta: { to: string; label: string; event: AnalyticsEvent };
  steps: DemoStep[];
}[] = [
  {
    id: "match",
    tab: "Find a contractor",
    blurb: "From a sentence about your kitchen to three builders who already passed inspection on one like it.",
    cta: { to: "/brief", label: "Start my brief — free", event: "cta_match_clicked" },
    steps: [
      {
        key: "space",
        label: "Say it in your words",
        caption: "Type or talk. Add a few photos if you have them. No forms, no jargon, no room-by-room quiz.",
        Screen: ScreenSpace,
      },
      {
        key: "sees",
        label: "We read it back",
        caption: "Haleo turns what you said into measurable observations — and asks you to confirm before anything moves.",
        Screen: ScreenScope,
      },
      {
        key: "brief",
        label: "Your scoped brief",
        caption: "The same document goes to every contractor, so their bids finally describe the same job.",
        Screen: ScreenBrief,
      },
      {
        key: "matches",
        label: "Permit-proven matches",
        caption: "Only builders with pulled permits and passed inspections for your project type, in your zip.",
        Screen: ScreenMatches,
      },
    ],
  },
  {
    id: "audit",
    tab: "Audit a quote",
    blurb: "Already holding an estimate? See exactly which lines are fair before you sign anything.",
    cta: { to: "/roast", label: "Audit my quote — free", event: "cta_roast_clicked" },
    steps: [
      {
        key: "audit",
        label: "Drop the quote in",
        caption: "PDF, photo, or pasted text. Nothing to set up and no account to create.",
        Screen: ScreenAudit,
      },
      {
        key: "bids",
        label: "Line them up",
        caption: "Every trade side by side, so a $12k backsplash can't hide inside a big round number.",
        Screen: ScreenBids,
      },
    ],
  },
];

const STEP_MS = 5600;

const DemoRail = () => {
  const [trackId, setTrackId] = useState<"match" | "audit">("match");
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const track_ = TRACKS.find((t) => t.id === trackId)!;
  const steps = track_.steps;
  const step = steps[Math.min(i, steps.length - 1)];
  const Screen = step.Screen;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((p) => (p + 1) % steps.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, paused, steps.length, trackId]);

  const switchTrack = (id: "match" | "audit") => {
    setTrackId(id);
    setI(0);
  };

  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="font-display text-xs tracking-[0.25em] text-accent">A SNEAK PEEK</p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-balance md:text-4xl">
            Here's the whole thing, in real screens.
          </h2>

          {/* Track switch */}
          <div className="mt-8 inline-flex rounded-full border border-border bg-card p-1">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTrack(t.id)}
                aria-pressed={t.id === trackId}
                className={`rounded-full px-4 py-2 text-[13px] font-medium transition-smooth ${
                  t.id === trackId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.tab}
              </button>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{track_.blurb}</p>
        </div>

        <div
          className="mt-12 grid items-center gap-10 md:grid-cols-[1fr_auto]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Step list — the narration */}
          <div className="order-2 space-y-1.5 md:order-1">
            {steps.map((s, idx) => {
              const active = idx === i;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setI(idx); setPaused(true); }}
                  className={`relative block w-full overflow-hidden rounded-2xl border px-5 py-4 text-left transition-smooth ${
                    active
                      ? "border-foreground/15 bg-card shadow-soft"
                      : "border-transparent hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-baseline gap-3">
                    <span className={`font-display text-xs tabular-nums ${active ? "text-accent" : "text-muted-foreground/60"}`}>
                      0{idx + 1}
                    </span>
                    <span className={`text-[15px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="pl-7 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="block pt-1.5">{s.caption}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {active && (
                    <motion.span
                      key={`${trackId}-${idx}-${paused}`}
                      aria-hidden
                      className="absolute bottom-0 left-0 h-[2px] bg-accent"
                      initial={{ width: "0%" }}
                      animate={{ width: paused ? "0%" : "100%" }}
                      transition={{ duration: paused ? 0 : STEP_MS / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              );
            })}

            <div className="pt-5 pl-5">
              <Link
                to={track_.cta.to}
                onClick={() => track(track_.cta.event, { location: "demo" })}
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-lift transition-smooth hover:bg-foreground/90"
              >
                {track_.cta.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* The phone */}
          <div className="relative order-1 md:order-2">
            <div className="absolute -inset-8 -z-10 bg-gradient-to-br from-amber-200/40 via-rose-100/30 to-transparent blur-3xl" />
            <PhoneShell>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${trackId}-${step.key}`}
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
            <p className="mt-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Actual screens · step {i + 1} of {steps.length}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};


/* -------------------------------------------------------------------------- */
/*  Before / With Haleo — the contrast that does the talking.                  */
/* -------------------------------------------------------------------------- */

const BeforeAfter = () => (
  <section className="bg-secondary/30 py-20 md:py-28 border-y border-border">
    <div className="container mx-auto max-w-6xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mb-12 md:mb-16 text-center"
      >
        <p className="font-display text-xs tracking-[0.25em] text-accent">WHY IT'S BROKEN · AND HOW WE FIX IT</p>
        <h2 className="mt-4 mx-auto max-w-2xl font-display text-3xl md:text-4xl font-medium leading-[1.1] tracking-tight text-balance">
          Remodeling is broken. We rebuilt it on the data that actually matters.
        </h2>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* BEFORE */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="rounded-3xl border border-border bg-background/60 p-6 md:p-8"
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Without Haleo</p>
          <p className="mt-2 font-display text-xl md:text-2xl text-muted-foreground leading-snug">
            Weeks of guessing.
          </p>

          <div className="mt-6 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-dashed border-foreground/15 bg-card/60 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">Bid #1 — $92k</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Yelp · 4.5★</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-foreground/15 bg-card/60 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">Bid #2 — $148k</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Referral?</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-foreground/15 bg-card/60 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">Bid #3 — $211k</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cold email</span>
            </div>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-muted-foreground/60">·</span> Star ratings from strangers</li>
            <li className="flex gap-2"><span className="text-muted-foreground/60">·</span> Explain your vision 6 times</li>
            <li className="flex gap-2"><span className="text-muted-foreground/60">·</span> No way to tell what's fair</li>
            <li className="flex gap-2"><span className="text-muted-foreground/60">·</span> Zero proof they finish what they start</li>
          </ul>
        </motion.div>

        {/* AFTER */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="rounded-3xl border border-foreground/10 bg-foreground text-background p-6 md:p-8 shadow-lift"
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent">With Haleo</p>
          <p className="mt-2 font-display text-xl md:text-2xl leading-snug">
            One verdict. Permit-proven matches. Bids that line up.
          </p>

          <div className="mt-6 space-y-2.5">
            <div className="rounded-xl bg-background/5 border border-background/10 px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-background/60">Verdict</span>
                <span className="rounded-full bg-amber-400/20 px-2 py-px text-[10px] font-medium text-amber-300">High</span>
              </div>
              <p className="mt-1 font-display text-base">$148k quote · fair range $112–134k</p>
            </div>
            {[
              { n: "Mehdi Builders", m: "11 kitchens passed inspection · 95128" },
              { n: "Casa Verde", m: "6 kitchens passed inspection · 95128" },
              { n: "Westwood & Co.", m: "8 kitchens passed inspection · 95126" },
            ].map((c) => (
              <div key={c.n} className="flex items-center gap-3 rounded-xl bg-background/5 border border-background/10 px-3.5 py-2.5">
                <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.n}</p>
                  <p className="truncate text-[11px] text-background/60">{c.m}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
              </div>
            ))}
          </div>

          <ul className="mt-6 space-y-2 text-sm text-background/80">
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> Matched by what you're actually building</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> A brief they read before they bid</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> Every line item, side by side</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> Receipts from the county, not Yelp</li>
          </ul>
        </motion.div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Remodel Roast — quick, free quote check.                                   */
/* -------------------------------------------------------------------------- */

const RoastHook = () => (
  <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 py-14 md:py-24 lg:py-32">
    <div className="container mx-auto max-w-5xl px-6">
      <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full mb-5">
            <Flame className="w-3.5 h-3.5" /> FREE · NO SIGNUP · 30 SECONDS
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-[1.1] text-foreground">
            Got a quote? <span className="italic">Get it roasted.</span>
          </h2>
          <p className="mt-5 text-lg text-foreground/70 max-w-md">
            Drop in your contractor's estimate. We line it up against real local costs and prior proposals, then tell you straight where you stand.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/roast"
              onClick={() => track("cta_roast_clicked", { location: "roast_hook" })}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-foreground/90 transition shadow-lg shadow-orange-200/50"
            >
              Roast my quote <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="self-center text-xs text-foreground/50">No login. Just answers.</span>
          </div>
        </motion.div>

        {/* Mock score card */}
        <motion.div
          initial={{ opacity: 0, y: 20, rotate: -2 }}
          whileInView={{ opacity: 1, y: 0, rotate: -2 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-200 to-rose-200 blur-3xl opacity-60 -z-10" />
          <div className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-7 text-white shadow-2xl">
            <p className="text-[10px] uppercase tracking-widest opacity-90">Remodel Roast</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-serif font-bold leading-none">34</span>
              <span className="text-sm opacity-90">/ 100</span>
            </div>
            <p className="mt-2 text-xl font-serif">Yikes Territory</p>
            <p className="mt-3 text-sm italic leading-snug opacity-95">
              "$12,000 for a backsplash? Are they tiling it with 24k gold?"
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-white/20">Cabinets · HIGH</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20">Labor · FAIR</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/*  Three calm value lines — no chrome, just typography.                       */
/* -------------------------------------------------------------------------- */



const Value = () => (
  <section className="bg-background py-24 md:py-32">
    <div className="container mx-auto max-w-4xl">
      <div className="grid gap-x-12 gap-y-16 md:grid-cols-3">
        {[
          {
            n: "01",
            t: "Audit the quote.",
            b: "Check every line item against real local costs and permit history. See what is fair, what is high, and what makes no sense. About 30 seconds.",
          },
          {
            n: "02",
            t: "Permit proven matches.",
            b: "Only builders who passed inspections for projects like yours in your neighborhood. Reviews can be bought. Permit history cannot.",
          },
          {
            n: "03",
            t: "Compare bids.",
            b: "Every trade and line item, lined up side by side. See where each builder is expensive or cheap before you decide.",
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
/*  NotLike — sharp differentiation vs Yelp / Thumbtack.                       */
/* -------------------------------------------------------------------------- */

const CONTRASTS = [
  {
    them: "Star ratings from strangers",
    us: "Permits pulled. Inspections passed.",
  },
  {
    them: "Matched by zip code",
    us: "Matched by what you're actually building",
  },
  {
    them: "5 contractors call you in 5 minutes",
    us: "A brief they read before they bid",
  },
  {
    them: "Apples-to-oranges quotes",
    us: "Every line item, side by side",
  },
];

const NotLike = () => (
  <section className="bg-foreground py-28 text-background md:py-40">
    <div className="container mx-auto max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mb-16 md:mb-24"
      >
        <p className="font-display text-xs tracking-[0.25em] text-accent">THE DIFFERENCE</p>
        <h2 className="mt-5 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-balance md:text-5xl">
          Not a directory. The way you actually hire.
        </h2>
      </motion.div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-x-6 gap-y-3 md:gap-x-12">
        <div className="text-right">
          <p className="font-display text-[10px] tracking-[0.25em] text-background/40 md:text-xs">YELP · THUMBTACK · ANGI</p>
        </div>
        <div />
        <div>
          <p className="font-display text-[10px] tracking-[0.25em] text-accent md:text-xs">HALEO</p>
        </div>

        {CONTRASTS.map((row, idx) => (
          <motion.div
            key={row.them}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE, delay: idx * 0.08 }}
            className="contents"
          >
            <div className="flex items-center justify-end border-t border-background/10 py-6">
              <p className="text-right text-sm leading-snug text-background/40 line-through decoration-background/30 md:text-lg">
                {row.them}
              </p>
            </div>
            <div className="flex items-center border-t border-background/10 py-6 text-background/30">
              <span className="font-display text-xs tracking-widest">→</span>
            </div>
            <div className="flex items-center border-t border-background/10 py-6">
              <p className="text-sm font-light leading-snug text-background md:text-lg">
                {row.us}
              </p>
            </div>
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
  <section className="relative bg-background py-28 md:py-36 border-t border-border">

    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: EASE }}
      className="container relative text-center"
    >
      <h2 className="mx-auto max-w-3xl text-3xl font-medium leading-[1.1] tracking-tight text-balance md:text-5xl">
        Ready when you are.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
        Start your brief without an account. We'll only ask you to sign up when your
        permit-matched contractors are ready.
      </p>
      <Link
        to="/brief"
        className="group mt-10 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-medium text-background shadow-lift transition-smooth hover:bg-foreground/90"
      >
        Start my brief — free
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-5 text-[13px] text-muted-foreground">
        Already have a quote?{" "}
        <Link to="/roast" className="font-medium text-foreground underline-offset-4 hover:underline">
          Get it roasted
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
      <BeforeAfter />
      <NotLike />
      <Value />
      <Closing />
      <SiteFooter />
    </main>
  );

};

export default Index;
