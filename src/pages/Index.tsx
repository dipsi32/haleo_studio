import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUp, Check, Menu, Upload } from "lucide-react";
import Logo from "@/components/Logo";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { setPendingQuoteFile, setPendingQuoteText } from "@/lib/quoteHandoff";
import { track } from "@/lib/analytics";
import HeroStory from "@/components/hero-story/HeroStory";

/* ---------------------------------------------------------------- */
/* Quote entry — upload first, paste as a quiet fallback              */
/* ---------------------------------------------------------------- */

const QuoteEntry = ({ where }: { where: "hero" | "closing" }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState("");

  const goWithFile = (file: File) => {
    setPendingQuoteFile(file);
    track("cta_roast_clicked", { where, mode: "upload" });
    navigate("/roast");
  };

  const goWithText = () => {
    setPendingQuoteText(text.trim());
    track("cta_roast_clicked", { where, mode: "paste" });
    navigate("/roast");
  };

  return (
    <div className="w-full max-w-md">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*,.txt,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) goWithFile(f);
        }}
      />

      {!pasteOpen ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) goWithFile(f);
          }}
          className="space-y-3"
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-8 text-base font-medium text-background transition-smooth hover:opacity-90 sm:w-auto"
          >
            <Upload className="h-[18px] w-[18px]" strokeWidth={1.8} />
            Upload your quote
          </button>
          <p className="text-[13.5px] text-muted-foreground">
            PDF, photo or screenshot — or{" "}
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="underline underline-offset-4 transition-smooth hover:text-foreground"
            >
              paste the text instead
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            autoFocus
            placeholder={"Kitchen remodel\nCabinets — $31,000\nCountertops — $9,400\n…\nTotal: $84,200"}
            className="rounded-2xl text-[14px]"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={text.trim().length < 40}
              onClick={goWithText}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[15px] font-medium text-background transition-smooth hover:opacity-90 disabled:opacity-40"
            >
              Check it <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => setPasteOpen(false)}
              className="text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Upload a file instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- */
/* Sample verdict card                                                */
/* ---------------------------------------------------------------- */

type Verdict = "in-range" | "high" | "flagged" | "ask";

const verdictStyles: Record<Verdict, { label: string; className: string }> = {
  "in-range": { label: "In range", className: "text-success" },
  high: { label: "High", className: "text-warning-foreground" },
  flagged: { label: "Flagged", className: "text-danger" },
  ask: { label: "Ask", className: "text-muted-foreground" },
};

const lineItems: { name: string; detail?: string; amount: string; verdict: Verdict }[] = [
  { name: "Cabinets & install", amount: "$31,000", verdict: "in-range" },
  { name: "Quartz countertops", amount: "$9,400", verdict: "in-range" },
  { name: "Demolition & haul-away", detail: "Nearby jobs run $2,400–$3,600", amount: "$6,200", verdict: "high" },
  { name: "City permit fee", detail: "San Jose charges $1,120 for this scope", amount: "$2,800", verdict: "flagged" },
  { name: "\u201CFinish allowance\u201D", detail: "No scope attached", amount: "$7,500", verdict: "ask" },
];

const VerdictCard = () => (
  <div className="rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-9">
    <div className="flex items-baseline justify-between">
      <p className="eyebrow text-muted-foreground">Sample · Kitchen · 95128</p>
    </div>

    <div className="mt-6 flex items-end justify-between gap-4">
      <p className="font-display text-[34px] leading-none tracking-tight sm:text-[40px]">$84,200</p>
      <span className="inline-flex items-center gap-1.5 text-sm text-danger">
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
        $9,300 over
      </span>
    </div>

    <ul className="mt-7 space-y-0">
      {lineItems.map((item, i) => (
        <li
          key={item.name}
          className={`flex items-baseline justify-between gap-4 py-4 ${
            i < lineItems.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="text-[15px]">{item.name}</p>
            {item.detail && <p className="mt-1 text-[13px] text-muted-foreground">{item.detail}</p>}
          </div>
          <div className="flex shrink-0 items-baseline gap-5">
            <span className="text-[15px] tabular-nums">{item.amount}</span>
            <span className={`w-16 text-right text-[13px] ${verdictStyles[item.verdict].className}`}>
              {verdictStyles[item.verdict].label}
            </span>
          </div>
        </li>
      ))}
    </ul>

    <p className="mt-7 text-[13px] text-muted-foreground">
      Compared against 47 permitted kitchen remodels within two miles.
    </p>
  </div>
);

/* ---------------------------------------------------------------- */
/* Page                                                               */
/* ---------------------------------------------------------------- */

const differences = [
  ["Star ratings from strangers", "Permits pulled, inspections passed"],
  ["Matched by zip code", "Matched by what you're building"],
  ["Five calls in five minutes", "A brief they read before they bid"],
  ["Apples-to-oranges quotes", "Every line item, side by side"],
];

const contractorProof = [
  "Pulled 9 kitchen permits within two miles of you",
  "Every one passed final inspection",
  "License clear since 2009 — no stop-work orders",
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:py-8">
        <Logo />
        <nav className="hidden items-center gap-9 md:flex">
          <a href="#how-it-works" className="text-[15px] text-muted-foreground transition-smooth hover:text-foreground">
            How it works
          </a>
          <Link to="/pro" className="text-[15px] text-muted-foreground transition-smooth hover:text-foreground">
            For contractors
          </Link>
          <Link to="/login" className="text-[15px] text-muted-foreground transition-smooth hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger className="flex h-10 w-10 items-center justify-center md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" strokeWidth={1.8} />
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <SheetHeader>
              <SheetTitle className="text-left font-display text-xl font-medium">Haleo</SheetTitle>
            </SheetHeader>
            <div className="mt-8 flex flex-col gap-1 text-[15px]">
              <a href="#how-it-works" className="rounded-xl px-3 py-3 hover:bg-secondary">How it works</a>
              <Link to="/roast" className="rounded-xl px-3 py-3 hover:bg-secondary">Check a quote</Link>
              <Link to="/brief" className="rounded-xl px-3 py-3 hover:bg-secondary">Find a contractor</Link>
              <Link to="/pro" className="rounded-xl px-3 py-3 hover:bg-secondary">For contractors</Link>
              <Link to="/login" className="rounded-xl px-3 py-3 hover:bg-secondary">Sign in</Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* HERO — "Text From Mike": an interactive pain-simulation story.
          Deliberately its own design world (see src/components/hero-story) —
          gets reconciled with the rest of the site's design system later. */}
      <HeroStory />

      {/* SAMPLE */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-20">
            <div>
              <p className="eyebrow text-accent">What you get back</p>
              <h2 className="mt-5 font-display text-[30px] leading-tight tracking-tight md:text-[38px]">
                Every line, checked against the neighborhood.
              </h2>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
            >
              <VerdictCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* THE IDEA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
          <h2 className="font-display text-[30px] leading-tight tracking-tight md:text-[42px]">
            Everyone who gets a fair price knows a guy.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Someone in the trades who'll look at the quote and tell you what's real — with no stake in
            whether you sign. Haleo is that person, for everyone else.
          </p>
        </div>
      </section>

      {/* CONTRACTORS */}
      <section id="how-it-works" className="border-t border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:gap-20 md:py-28">
          <div>
            <p className="eyebrow text-accent">Then, when you're ready</p>
            <h2 className="mt-5 font-display text-[30px] leading-tight tracking-tight md:text-[40px]">
              We'll show you who has actually done it.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              We read the city's permit records — who built what, where, and whether it passed
              inspection. Not star ratings from strangers.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-9">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-medium text-accent-soft-foreground">
                WB
              </div>
              <div>
                <p className="font-display text-lg">Wise Builders</p>
                <p className="text-[13px] text-muted-foreground">CSLB #812440 · Willow Glen</p>
              </div>
            </div>

            <ul className="mt-7 space-y-3.5">
              {contractorProof.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Check className="mt-[3px] h-[17px] w-[17px] shrink-0 text-success" strokeWidth={2} />
                  <span className="text-[15px] leading-snug">{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
              <p className="hidden text-[13px] text-muted-foreground sm:block">Last job closed March 2026</p>
              <Link
                to="/brief"
                onClick={() => track("cta_match_clicked", { where: "contractor_card" })}
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-foreground/15 px-6 text-[15px] font-medium transition-smooth hover:bg-foreground hover:text-background sm:w-auto"
              >
                Send my brief
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENCE */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
          <p className="eyebrow text-accent">The difference</p>
          <h2 className="mt-5 max-w-2xl font-display text-[30px] leading-tight tracking-tight md:text-[40px]">
            Reviews tell you how someone felt. Permits tell you what got built.
          </h2>

          <div className="mt-12">
            {differences.map(([before, after], i) => (
              <div
                key={before}
                className={`grid gap-1.5 border-t border-border py-5 md:grid-cols-2 md:gap-12 md:py-6 ${
                  i === differences.length - 1 ? "border-b" : ""
                }`}
              >
                <p className="text-[15px] text-muted-foreground line-through md:text-base">{before}</p>
                <p className="text-[15px] md:text-base">{after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center md:py-32">
          <h2 className="font-display text-[30px] leading-tight tracking-tight md:text-[40px]">
            Got a quote sitting in your inbox right now?
          </h2>
          <div className="mt-10 flex justify-center">
            <QuoteEntry where="closing" />
          </div>
          <p className="mt-8 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Quote checks work anywhere in the U.S. Permit-matched contractors are live in San Jose.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <Logo />
          <div className="flex items-center gap-6 text-[13.5px] text-muted-foreground">
            <Link to="/roast" className="transition-smooth hover:text-foreground">Check a quote</Link>
            <Link to="/pro" className="transition-smooth hover:text-foreground">For contractors</Link>
            <span>© {new Date().getFullYear()} Haleo</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
