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
} from "lucide-react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/context/AuthContext";

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

const SCREENS = [ScreenAudit, ScreenBrief, ScreenMatches, ScreenBids];

const Hero = () => {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SCREENS.length), 3200);
    return () => clearInterval(t);
  }, []);

  const Screen = SCREENS[i];

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-gradient-warm" aria-hidden />

      <SiteHeader />

      <div className="container relative pt-32 pb-20 md:pt-40 md:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Free · 30 seconds · no signup
          </div>
          <h1 className="mt-6 text-[2.25rem] font-semibold leading-[1.05] tracking-tight text-balance text-foreground md:text-[3.75rem]">
            Got a contractor quote?<br className="hidden sm:block" /> <span className="text-accent">Get it roasted.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            We read between the line items. Fact-check every number against real permit history on your block — and tell you, plainly, what's fair and what's a stretch.
          </p>

          <div className="mt-10 flex flex-col items-center gap-5">
            <Link
              to="/roast"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-[14px] font-medium text-background shadow-lift transition-smooth hover:bg-foreground/90"
            >
              Get it roasted
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="flex flex-col items-center gap-1.5">
              <Link to="/brief" className="text-[14px] font-medium text-foreground underline-offset-4 hover:underline">
                No quote yet? Find your contractor →
              </Link>
              <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                Matched to contractors with real permit history near you. Not star ratings, actual proof.
              </p>
            </div>
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
/*  Remodel Roast — quick, free quote check.                                   */
/* -------------------------------------------------------------------------- */

const RoastHook = () => (
  <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 py-24 md:py-32">
    <div className="container mx-auto max-w-5xl px-6">
      <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full mb-5">
            FREE · 30 SECONDS · NO SIGNUP
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-light leading-[1.05] text-foreground">
            Got a quote? <span className="italic">Get it roasted.</span>
          </h2>
          <p className="mt-5 text-lg text-foreground/70 max-w-md">
            Drop in your contractor's estimate. Haleo lines it up against local cost guides, permit comps, and prior Haleo proposals, then tells you straight where you stand.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/roast"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-foreground/90 transition shadow-lg shadow-orange-200/50"
            >
              Got a contractor quote? Get it roasted <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="self-center text-xs text-foreground/50">Drop your estimate. We'll tell you what's off, and how to fix it.</span>
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
            <p className="text-[10px] uppercase tracking-widest opacity-90">Haleo quote score</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-serif font-bold leading-none">38</span>
              <span className="text-sm opacity-90">/ 100</span>
            </div>
            <p className="mt-2 text-xl font-serif">Notably high</p>
            <p className="mt-3 text-sm leading-snug opacity-95">
              Backsplash line is $12,000. Local fair range for this size is $3,800 to $5,200.
            </p>
            <div className="mt-5 flex gap-2 text-[10px]">
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
  <section className="bg-background py-28 md:py-40">
    <div className="container mx-auto max-w-4xl">
      <div className="grid gap-x-12 gap-y-16 md:grid-cols-3">
        {[
          {
            n: "01",
            t: "Audit the quote.",
            b: "Every line item against local permit comps and cost guides. You see fair, high, and 'what are they thinking' in 30 seconds.",
          },
          {
            n: "02",
            t: "Permit-proven matches.",
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
        <h2 className="mt-5 max-w-3xl font-display text-4xl font-light leading-[1.05] tracking-tight text-balance md:text-6xl">
          We're not a directory.{" "}
          <em className="italic text-accent">We're how you actually hire.</em>
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
  <section className="relative overflow-hidden bg-gradient-warm py-32 md:py-44">
    <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-60" aria-hidden />
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: EASE }}
      className="container relative text-center"
    >
      <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
        Start with the quote in your hand.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
        Thirty seconds. Every line item, fact-checked against permits on your block.
      </p>
      <Link
        to="/roast"
        className="group mt-10 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-medium text-background shadow-lift transition-smooth hover:bg-foreground/90"
      >
        Audit my proposal
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-5 text-[13px] text-muted-foreground">
        No quote yet?{" "}
        <Link to="/brief" className="font-medium text-foreground underline-offset-4 hover:underline">
          Find your contractor →
        </Link>
      </p>
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
      <NotLike />
      <Value />
      <Closing />
      <SiteFooter />
    </main>
  );

};

export default Index;
