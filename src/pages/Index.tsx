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
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Ruler,
  Upload,
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
/*  HERO — Flighty-style. The product demonstrates itself. Cards orbit phone. */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  HERO — Persona-driven 5-frame walkthrough of the actual app.              */
/*  Maya, first kitchen remodel. Every frame mirrors a real screen.           */
/* -------------------------------------------------------------------------- */

// A single phone frame. Used five times across the walkthrough — one per step.
const PhoneFrame = ({
  step,
  label,
  caption,
  delay = 0,
  tone = "accent",
  children,
}: {
  step: string;
  label: string;
  caption: string;
  delay?: number;
  tone?: "accent" | "sage" | "primary";
  children: React.ReactNode;
}) => {
  const dot =
    tone === "sage" ? "bg-emerald-500" : tone === "primary" ? "bg-primary" : "bg-accent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className="relative flex flex-col items-center"
    >
      {/* Caption above — fixed height so all phones align */}
      <div className="mb-4 flex h-[120px] w-[240px] flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
          <span className={`h-1 w-1 rounded-full ${dot}`} />
          Step {step}
        </div>
        <p className="mt-2 font-display text-base leading-tight text-foreground lg:text-lg">
          {label}
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{caption}</p>
      </div>

      {/* Phone */}
      <div
        className="relative rounded-[2.25rem] border border-foreground/15 bg-foreground/95 p-[8px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
        style={{ width: 240 }}
      >
        <div className="relative overflow-hidden rounded-[1.85rem] bg-gradient-to-b from-background to-secondary/60">
          <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-foreground/95" />
          <div className="px-3.5 pb-4 pt-8">{children}</div>
        </div>
      </div>

      {/* Soft glow */}
      <div
        className="pointer-events-none absolute -bottom-6 left-1/2 -z-10 h-20 w-[110%] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
        aria-hidden
      />
    </motion.div>
  );
};

// Connector between frames (desktop only — hidden until we have horizontal room)
const StepArrow = () => (
  <div className="hidden shrink-0 items-center justify-center self-center pt-[120px] lg:flex" aria-hidden>
    <ArrowRight className="h-5 w-5 text-accent/60" />
  </div>
);

// ── Frame 1 — Upload: photos, video walkthrough, floor plan, architect plan
const Frame1Upload = () => (
  <>
    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Maya's kitchen</p>
    <p className="mt-0.5 font-display text-sm font-medium">Show us the space</p>

    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {[
        { icon: ImageIcon, label: "Room photos", count: "12" },
        { icon: VideoIcon, label: "Walkthrough video", count: "0:42" },
        { icon: Ruler, label: "Floor plan", count: "PDF" },
        { icon: FileText, label: "Architect plans", count: "3 pg" },
      ].map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-border bg-card p-2"
        >
          <it.icon className="h-3.5 w-3.5 text-accent" />
          <p className="mt-1 text-[10px] font-medium leading-tight text-foreground">{it.label}</p>
          <p className="text-[9px] text-muted-foreground">{it.count}</p>
        </div>
      ))}
    </div>

    <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/40 bg-accent/5 py-2 text-[10px] font-medium text-accent">
      <Upload className="h-3 w-3" /> Drop more
    </div>
  </>
);

// ── Frame 2 — Haleo reads the scope (real ConfirmReadScreen behavior)
const Frame2Read = () => (
  <>
    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Haleo sees</p>
    <p className="mt-0.5 font-display text-sm font-medium">~140 sq ft galley</p>

    <div className="mt-3 space-y-1.5">
      {[
        "Load-bearing wall on north side",
        "Gas line at range — relocation likely",
        "Recessed lighting on single circuit",
        "Original 1962 cabinetry, no soft-close",
      ].map((line, i) => (
        <motion.div
          key={line}
          initial={{ opacity: 0, x: -6 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.08 }}
          className="flex items-start gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5"
        >
          <Eye className="mt-[2px] h-3 w-3 shrink-0 text-accent" />
          <p className="text-[10px] leading-snug text-foreground">{line}</p>
        </motion.div>
      ))}
    </div>

    <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/10 px-2 py-1.5">
      <span className="text-[10px] font-medium text-emerald-700">Looks right?</span>
      <span className="text-[9px] text-emerald-700/80">Maya: confirmed ✓</span>
    </div>
  </>
);

// ── Frame 3 — The brief
const Frame3Brief = () => (
  <>
    <div className="flex items-center justify-between">
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Your brief</p>
      <CheckCircle2 className="h-3 w-3 text-accent" />
    </div>
    <p className="mt-0.5 font-display text-sm font-medium">Ready to send</p>

    <div className="mt-3 space-y-2 text-[10px] leading-snug text-foreground">
      <div>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Scope</p>
        <p>Full remodel · island seating · gas → induction</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Site</p>
        <p>95128 · 1962 build · ~140 sq ft</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Permits</p>
        <p>Electrical, plumbing relocation, structural review</p>
      </div>
    </div>

    <div className="mt-3 flex flex-wrap gap-1">
      {["~$140k", "8 wks", "warm-modern"].map((t) => (
        <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[9px] text-foreground/70">
          {t}
        </span>
      ))}
    </div>
  </>
);

// ── Frame 4 — Permit-proven contractor matches
const Frame4Match = () => (
  <>
    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Matched builders</p>
    <p className="mt-0.5 font-display text-sm font-medium">4 permit-proven</p>

    <div className="mt-3 space-y-1.5">
      {[
        { name: "Mehdi Builders", meta: "11 kitchens · 95128", dist: "1.2 mi" },
        { name: "Westwood & Co.", meta: "8 kitchens · 95126", dist: "1.8 mi" },
        { name: "Casa Verde", meta: "6 kitchens · 95128", dist: "0.9 mi" },
      ].map((c) => (
        <div key={c.name} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500/15">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10.5px] font-medium text-foreground">{c.name}</p>
            <p className="truncate text-[9px] text-muted-foreground">{c.meta}</p>
          </div>
          <span className="text-[9px] tabular-nums text-muted-foreground">{c.dist}</span>
        </div>
      ))}
    </div>

    <div className="mt-2.5 text-center text-[9px] text-muted-foreground">
      All passed city inspections on similar jobs
    </div>
  </>
);

// ── Frame 5 — Compare bids side-by-side, trade-by-trade
const Frame5Compare = () => {
  const trades = [
    { t: "Cabinets", a: 22, b: 28, c: 24 },
    { t: "Plumbing", a: 14, b: 13, c: 16 },
    { t: "Tile", a: 11, b: 19, c: 12 },
    { t: "Electrical", a: 9, b: 11, c: 10 },
  ];
  const max = 30;
  return (
    <>
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">3 bids in</p>
      <p className="mt-0.5 font-display text-sm font-medium">Compare line by line</p>

      <div className="mt-3 grid grid-cols-[1fr_repeat(3,18px)] gap-x-1.5 text-[9px] text-muted-foreground">
        <span />
        <span className="text-center font-medium text-foreground">M</span>
        <span className="text-center font-medium text-foreground">W</span>
        <span className="text-center font-medium text-foreground">C</span>
      </div>

      <div className="mt-1.5 space-y-1.5">
        {trades.map((row) => {
          const vals = [row.a, row.b, row.c];
          const lo = Math.min(...vals);
          const hi = Math.max(...vals);
          return (
            <div key={row.t} className="rounded-md border border-border bg-card px-2 py-1.5">
              <div className="grid grid-cols-[1fr_repeat(3,18px)] items-center gap-x-1.5">
                <span className="text-[10px] text-foreground">{row.t}</span>
                {vals.map((v, i) => (
                  <span
                    key={i}
                    className={`rounded text-center text-[9px] tabular-nums leading-4 ${
                      v === lo
                        ? "bg-emerald-500/15 text-emerald-700"
                        : v === hi
                        ? "bg-accent-soft text-accent"
                        : "text-muted-foreground"
                    }`}
                  >
                    {v}k
                  </span>
                ))}
              </div>
              <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-accent/60" style={{ width: `${(row.a / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-primary/5 px-2 py-1.5">
        <span className="text-[10px] font-medium text-foreground">Total spread</span>
        <span className="text-[10px] font-semibold tabular-nums text-primary">$56k → $71k</span>
      </div>
    </>
  );
};

const Hero = () => (
  <section className="relative overflow-hidden bg-gradient-warm">
    <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
    <div
      className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-accent/10 blur-[120px]"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[120px]"
      aria-hidden
    />

    <SiteHeader />

    <div className="container relative pt-24 pb-20 md:pt-32 md:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto max-w-4xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          For first-time remodelers
        </span>

        <h1 className="mt-7 font-display text-[2.5rem] font-light leading-[1.04] text-balance md:text-[5rem]">
          Hire your contractor in <em className="font-normal italic text-accent">days,</em>
          <br className="hidden md:inline" />
          not <em className="font-normal italic text-accent">months.</em>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Upload what you already have. We read the scope, write the brief, match permit-proven
          builders, and put their bids side by side.
        </p>
      </motion.div>

      {/* Persona strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
        className="mx-auto mt-10 flex max-w-md items-center justify-center gap-3 rounded-full border border-border bg-card/70 px-4 py-2 text-xs text-muted-foreground backdrop-blur"
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-300 via-rose-300 to-orange-400" />
        <p className="text-left leading-tight">
          <span className="font-medium text-foreground">Maya, San Jose.</span> First kitchen remodel.
          Here's what she did in <span className="font-medium text-foreground">one evening.</span>
        </p>
      </motion.div>

      {/* 5-frame walkthrough — horizontal scroll on mobile, full grid on desktop */}
      <div className="relative mx-auto mt-12 max-w-[1400px]">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] md:items-start md:gap-2 md:overflow-visible md:px-0">
          <div className="snap-center shrink-0">
            <PhoneFrame
              step="01"
              label="Show the space"
              caption="Photos, a video walkthrough, floor plan, architect drawings — whatever you already have."
              delay={0.0}
            >
              <Frame1Upload />
            </PhoneFrame>
          </div>
          <StepArrow />
          <div className="snap-center shrink-0">
            <PhoneFrame
              step="02"
              label="Haleo reads the scope"
              caption="We surface what matters — load-bearing walls, permits, gotchas. You confirm."
              delay={0.1}
              tone="accent"
            >
              <Frame2Read />
            </PhoneFrame>
          </div>
          <StepArrow />
          <div className="snap-center shrink-0">
            <PhoneFrame
              step="03"
              label="Your brief, written"
              caption="One structured brief. The same one every contractor sees. No more repeating yourself."
              delay={0.2}
              tone="accent"
            >
              <Frame3Brief />
            </PhoneFrame>
          </div>
          <StepArrow />
          <div className="snap-center shrink-0">
            <PhoneFrame
              step="04"
              label="Permit-proven matches"
              caption="Builders who've actually passed city inspections for your kind of project, in your zip."
              delay={0.3}
              tone="sage"
            >
              <Frame4Match />
            </PhoneFrame>
          </div>
          <StepArrow />
          <div className="snap-center shrink-0">
            <PhoneFrame
              step="05"
              label="Compare. Decide."
              caption="Every bid, every trade, side by side. See exactly where each builder is high or low."
              delay={0.4}
              tone="primary"
            >
              <Frame5Compare />
            </PhoneFrame>
          </div>
        </div>

        {/* Mobile scroll hint */}
        <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">
          ← swipe through Maya's evening →
        </p>
      </div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
        className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
      >
        <Link
          to="/brief"
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-medium text-primary-foreground shadow-lift transition-smooth hover:bg-primary/90 hover:shadow-accent"
        >
          <Hammer className="h-4 w-4" />
          Start my brief
          <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
        </Link>
        <Link
          to="/proposal"
          className="group inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-7 py-4 text-sm font-medium text-foreground transition-smooth hover:border-accent/40 hover:bg-secondary"
        >
          <FileSearch className="h-4 w-4" />
          I have a proposal to review
        </Link>
      </motion.div>

      <p className="mx-auto mt-6 max-w-md text-center text-xs text-muted-foreground">
        Free to start. We only charge when you actually save time or money.
      </p>
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
    n: "months",
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
/*  BEFORE / AFTER — the same homeowner, same kitchen, two realities.         */
/* -------------------------------------------------------------------------- */
const BeforeAfter = () => (
  <section className="bg-gradient-warm py-24 md:py-32">
    <div className="container">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Same kitchen. Same budget.
        </p>
        <h2 className="mt-4 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Two completely different <em className="italic text-foreground/70">experiences.</em>
        </h2>
      </motion.div>

      <div className="relative mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-2">
        {/* BEFORE — chaos, scattered, slightly off-kilter */}
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl border border-border bg-secondary/40 p-7 md:p-9"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              Without Haleo
            </span>
            <span className="font-display text-xs italic text-muted-foreground">Week 14</span>
          </div>

          <p className="mt-4 font-display text-xl font-light leading-snug text-foreground/70 md:text-2xl">
            "I have nine bids, no idea which to trust, and I've explained the project twelve times."
          </p>

          {/* Messy scattered cards */}
          <div className="relative mt-8 h-[280px]">
            <div className="absolute left-2 top-0 w-44 -rotate-6 rounded-lg border border-border bg-card/85 p-3 shadow-soft">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Yelp ad</p>
              <p className="mt-0.5 text-sm font-medium text-foreground/80">"Premier Kitchens"</p>
              <p className="text-[11px] text-muted-foreground line-through">$84,000</p>
            </div>
            <div className="absolute right-4 top-4 w-44 rotate-3 rounded-lg border border-border bg-card/85 p-3 shadow-soft">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cousin's guy</p>
              <p className="mt-0.5 text-sm font-medium text-foreground/80">"Mike — call him"</p>
              <p className="text-[11px] text-muted-foreground">$140,000?</p>
            </div>
            <div className="absolute left-12 top-[88px] w-48 -rotate-2 rounded-lg border border-border bg-card/85 p-3 shadow-soft">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referral</p>
              <p className="mt-0.5 text-sm font-medium text-foreground/80">A&amp;G Construction</p>
              <p className="text-[11px] text-muted-foreground">$112k · vague scope</p>
            </div>
            <div className="absolute right-2 top-[112px] w-44 rotate-6 rounded-lg border border-border bg-card/85 p-3 shadow-soft">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open house</p>
              <p className="mt-0.5 text-sm font-medium text-foreground/80 line-through">Bayside Builders</p>
              <p className="text-[11px] text-muted-foreground">"never replied"</p>
            </div>
            <div className="absolute left-6 top-[200px] w-52 -rotate-3 rounded-lg border border-border bg-card/85 p-3 shadow-soft">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Magazine</p>
              <p className="mt-0.5 text-sm font-medium text-foreground/80">Ridgeline Co.</p>
              <p className="text-[11px] text-muted-foreground">$56k? "missing plumbing"</p>
            </div>
            <div className="absolute right-8 top-[208px] w-36 rotate-[-8deg] rounded-sm bg-amber-100 p-2.5 shadow-soft">
              <p className="text-[11px] leading-tight text-amber-950/80">ask about permits??</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
            <div>
              <p className="font-display text-2xl font-light text-muted-foreground">60</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">interviewed</p>
            </div>
            <div>
              <p className="font-display text-2xl font-light text-muted-foreground">12×</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">re-explained</p>
            </div>
            <div>
              <p className="font-display text-xl font-light text-muted-foreground">$84–140k</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">bid spread</p>
            </div>
          </div>
        </motion.div>

        {/* AFTER — clean, ordered, branded */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-accent/30 bg-card p-7 shadow-lift md:p-9"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              With Haleo
            </span>
            <span className="font-display text-xs italic text-accent">Day 3</span>
          </div>

          <p className="mt-4 font-display text-xl font-light leading-snug text-foreground md:text-2xl">
            "Four permit-verified builders. One brief. Bids lined up side by side."
          </p>

          <div className="mt-8 space-y-2.5">
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center gap-2">
                <ScrollText className="h-3.5 w-3.5 text-accent" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your brief — sent once
                </p>
              </div>
              <p className="mt-1 text-sm text-foreground">
                Full kitchen · island · gas → induction · 95128
              </p>
            </div>

            <p className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Permit-matched · ranked
            </p>
            {[
              { name: "Mehdi Builders", bid: "$92k", score: 94, hi: true },
              { name: "Lozano Construction", bid: "$88k", score: 91, hi: false },
              { name: "Rivera & Co.", bid: "$96k", score: 88, hi: false },
              { name: "Ridgeline Co.", bid: "$84k", score: 85, hi: false },
            ].map((c) => (
              <div
                key={c.name}
                className={`flex items-center justify-between rounded-xl border bg-card px-3 py-2.5 ${
                  c.hi ? "border-accent/40 shadow-soft" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-foreground/80">{c.bid}</span>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                    {c.score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
            <div>
              <p className="font-display text-2xl font-light text-accent">4</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">shortlisted</p>
            </div>
            <div>
              <p className="font-display text-2xl font-light text-accent">1×</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">explained</p>
            </div>
            <div>
              <p className="font-display text-xl font-light text-accent">$84–96k</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">tight spread</p>
            </div>
          </div>
        </motion.div>

        {/* Dividing arrow — desktop only */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-lift">
            <ArrowRight className="h-5 w-5 text-accent" />
          </div>
        </div>
      </div>
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
      <BeforeAfter />
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
