import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, ArrowUp, Menu } from "lucide-react";
import Logo from "@/components/Logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { track } from "@/lib/analytics";

/* ---------------------------------------------------------------- */
/* Quote input — hero + closing CTA                                   */
/* ---------------------------------------------------------------- */

const QuoteInput = ({ where }: { where: "hero" | "closing" }) => {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const go = () => {
    track("home_quote_check_clicked", { where });
    navigate("/roast", { state: { prefillQuote: text.trim() || undefined } });
  };

  return (
    <div className="w-full">
      {/* Desktop: single pill */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="hidden w-full max-w-[520px] items-center gap-2 rounded-full border border-border bg-card py-2 pl-6 pr-2 shadow-soft sm:flex"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your quote — or drop the PDF"
          aria-label="Paste your quote"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-[52px] shrink-0 items-center gap-2 rounded-full bg-foreground px-6 text-base font-semibold text-background transition-smooth hover:opacity-90"
        >
          Check it
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Mobile: stacked */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex w-full flex-col gap-2.5 sm:hidden"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your quote — or drop the PDF"
          aria-label="Paste your quote"
          className="w-full rounded-2xl border border-border bg-card px-[18px] py-4 text-[15.5px] text-foreground placeholder:text-muted-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-[16.5px] font-semibold text-background transition-smooth hover:opacity-90"
        >
          Check it
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

/* ---------------------------------------------------------------- */
/* Verdict (sample analysis) card                                     */
/* ---------------------------------------------------------------- */

type Verdict = "in-range" | "high" | "flagged" | "ask";

const verdictStyles: Record<Verdict, { label: string; className: string }> = {
  "in-range": { label: "In range", className: "bg-success-bg text-success-foreground" },
  high: { label: "High", className: "bg-warning-bg text-warning-foreground" },
  flagged: { label: "Flagged", className: "bg-danger-bg text-danger-foreground" },
  ask: { label: "Ask", className: "bg-muted text-muted-foreground" },
};

const lineItems: {
  name: string;
  detail: string;
  detailTone?: "muted" | "danger";
  amount: string;
  verdict: Verdict;
}[] = [
  { name: "Cabinets & install", detail: "Semi-custom, 22 linear ft", amount: "$31,000", verdict: "in-range" },
  { name: "Quartz countertops", detail: "48 sq ft, undermount sink cut", amount: "$9,400", verdict: "in-range" },
  {
    name: "Demolition & haul-away",
    detail: "Nearby jobs this size run $2,400–$3,600",
    detailTone: "danger",
    amount: "$6,200",
    verdict: "high",
  },
  {
    name: "City permit fee",
    detail: "San Jose charges $1,120 for this scope",
    detailTone: "danger",
    amount: "$2,800",
    verdict: "flagged",
  },
  { name: "\u201CFinish allowance\u201D", detail: "No scope attached — ask what it covers", amount: "$7,500", verdict: "ask" },
];

const VerdictCard = () => (
  <div className="rounded-[22px] border border-border bg-card p-5 shadow-lift sm:p-6">
    <div className="flex items-center justify-between pb-4">
      <p className="eyebrow text-muted-foreground">
        <span className="hidden sm:inline">Kitchen remodel · 180 sq ft · 95128</span>
        <span className="sm:hidden">Kitchen · 180 sq ft · 95128</span>
      </p>
      <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        Sample
      </span>
    </div>

    <div className="flex items-end justify-between gap-3 border-b border-border pb-4 sm:pb-5">
      <div className="space-y-1">
        <p className="font-display text-[32px] font-bold leading-none tracking-[-0.03em] sm:text-[38px]">$84,200</p>
        <p className="hidden text-sm text-muted-foreground sm:block">quoted by Bayview Kitchen Co.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-danger-bg px-3 py-2 text-danger-foreground">
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="text-[13px] font-bold sm:text-sm">$9,300 over</span>
      </div>
    </div>

    <ul className="pt-1">
      {lineItems.map((item, i) => (
        <li
          key={item.name}
          className={`flex items-start justify-between gap-3 py-3.5 sm:items-center ${
            i < lineItems.length - 1 ? "border-b border-border/60" : ""
          }`}
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-[14.5px] font-semibold sm:text-[15.5px]">{item.name}</p>
            <p
              className={`text-[12.5px] sm:text-[13px] ${
                item.detailTone === "danger" ? "text-danger" : "text-muted-foreground"
              }`}
            >
              {item.detail}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3.5">
            <span className="text-[14.5px] font-semibold sm:text-[15.5px]">{item.amount}</span>
            <span
              className={`w-[76px] rounded-full py-1.5 text-center text-[11.5px] font-bold sm:w-24 sm:text-[12.5px] ${
                verdictStyles[item.verdict].className
              }`}
            >
              {verdictStyles[item.verdict].label}
            </span>
          </div>
        </li>
      ))}
    </ul>

    <div className="mt-2 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <p className="text-[12.5px] leading-snug text-muted-foreground sm:text-[13.5px]">
        <span className="hidden sm:inline">Compared against 47 permitted kitchen remodels within two miles.</span>
        <span className="sm:hidden">Compared against 47 permitted kitchens within two miles.</span>
      </p>
    </div>
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
  <>
    Pulled <strong className="font-bold">9 kitchen permits</strong> within two miles
    <span className="hidden sm:inline"> of you</span>
  </>,
  <>Every one passed final inspection</>,
  <>License clear since 2009 — no stop-work orders</>,
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 md:px-20 md:py-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-[15px] font-medium text-muted-foreground transition-smooth hover:text-foreground">
            How it works
          </a>
          <Link to="/pro" className="text-[15px] font-medium text-muted-foreground transition-smooth hover:text-foreground">
            For contractors
          </Link>
          <Link
            to="/roast"
            className="inline-flex h-11 items-center rounded-full border border-border bg-card px-[22px] text-[15px] font-semibold transition-smooth hover:bg-secondary"
          >
            Check a quote
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger className="flex h-11 w-11 items-center justify-center md:hidden" aria-label="Menu">
            <Menu className="h-[22px] w-[22px]" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <SheetHeader>
              <SheetTitle className="text-left">Haleo</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-1 text-[15px]">
              <a href="#how-it-works" className="rounded-xl px-3 py-3 hover:bg-secondary">How it works</a>
              <Link to="/roast" className="rounded-xl px-3 py-3 hover:bg-secondary">Check a quote</Link>
              <Link to="/brief" className="rounded-xl px-3 py-3 hover:bg-secondary">Find a contractor</Link>
              <Link to="/pro" className="rounded-xl px-3 py-3 hover:bg-secondary">For contractors</Link>
              <Link to="/login" className="rounded-xl px-3 py-3 hover:bg-secondary">Sign in</Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pb-11 pt-5 md:grid-cols-[1.02fr_0.98fr] md:gap-[72px] md:px-20 md:pb-[104px] md:pt-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-5 md:gap-6"
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent md:h-[7px] md:w-[7px]" />
            <p className="eyebrow text-muted-foreground">
              <span className="hidden sm:inline">Free · No account · Any U.S. zip code</span>
              <span className="sm:hidden">Free · No account · Any U.S. zip</span>
            </p>
          </div>

          <h1 className="font-display text-[42px] font-extrabold leading-[1.03] tracking-[-0.035em] md:text-[70px] md:leading-none">
            Don't sign that<br className="hidden md:block" /> quote yet.
          </h1>

          <p className="max-w-[470px] text-[17px] leading-relaxed text-muted-foreground md:text-xl">
            Paste it here. In 60 seconds you'll know what's fair, what's padded, and whether they've
            actually done this job before.
          </p>

          <div className="flex flex-col gap-3 pt-0.5">
            <QuoteInput where="hero" />
            <p className="text-center text-[13px] text-muted-foreground sm:text-left sm:text-[13.5px]">
              <span className="hidden sm:inline">Free. No account. </span>We never show your quote to a contractor.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <VerdictCard />
        </motion.div>
      </section>

      {/* THE IDEA */}
      <section className="border-y border-border bg-card px-6 py-14 md:px-20 md:py-[104px]">
        <div className="mx-auto flex max-w-[880px] flex-col items-center gap-4 text-center md:gap-[22px]">
          <h2 className="font-display text-[30px] font-extrabold leading-[1.14] tracking-[-0.03em] md:text-[46px] md:leading-[1.12]">
            Everyone who gets a fair price<br className="hidden md:block" /> knows a guy.
          </h2>
          <p className="max-w-[660px] text-[16.5px] leading-relaxed text-muted-foreground md:text-xl">
            Someone in the trades who'll look at the quote and tell you what's real — and has no
            stake in whether you sign. Haleo is that person, for everyone else.
          </p>
        </div>
      </section>

      {/* CONTRACTORS */}
      <section
        id="how-it-works"
        className="mx-auto grid max-w-[1440px] items-center gap-6 px-5 py-14 md:grid-cols-2 md:gap-[72px] md:px-20 md:py-[104px]"
      >
        <div className="flex flex-col gap-3.5 md:gap-5">
          <p className="eyebrow text-accent">Then, when you're ready</p>
          <h2 className="font-display text-[30px] font-extrabold leading-[1.12] tracking-[-0.03em] md:text-[44px] md:leading-[1.1]">
            We'll show you who has actually done it.
          </h2>
          <p className="max-w-[480px] text-[16.5px] leading-relaxed text-muted-foreground md:text-[19px]">
            We read the city's permit records — who built what, where, and whether it passed
            inspection. Not star ratings from strangers.
          </p>
        </div>

        <div className="rounded-[20px] border border-border bg-card p-[22px] shadow-lift md:rounded-[22px] md:p-7">
          <div className="flex items-center gap-3 border-b border-border pb-[18px] md:gap-3.5 md:pb-[22px]">
            <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[13px] bg-accent-soft text-[15px] font-bold text-accent-soft-foreground md:h-[52px] md:w-[52px] md:rounded-[14px] md:text-[17px]">
              WB
            </div>
            <div>
              <p className="font-display text-[17px] font-bold tracking-[-0.01em] md:text-[19px]">Wise Builders</p>
              <p className="text-[12.5px] text-muted-foreground md:text-[13.5px]">CSLB #812440 · Willow Glen</p>
            </div>
          </div>

          <ul className="flex flex-col gap-3.5 py-[18px] md:gap-4 md:pb-5 md:pt-[22px]">
            {contractorProof.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 md:gap-3">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success md:h-[19px] md:w-[19px]" strokeWidth={2.4} />
                <span className="text-[14.5px] leading-snug md:text-[15.5px]">{line}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-4 md:pt-[18px]">
            <p className="hidden text-[13.5px] text-muted-foreground md:block">Last job closed March 2026</p>
            <Link
              to="/brief"
              onClick={() => track("home_find_contractor_clicked", { where: "contractor_card" })}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-[15px] font-semibold text-background transition-smooth hover:opacity-90 md:h-11 md:w-auto md:text-[14.5px]"
            >
              Send my brief
            </Link>
          </div>
        </div>
      </section>

      {/* DIFFERENCE */}
      <section className="bg-foreground px-6 py-14 text-background md:px-20 md:py-[104px]">
        <div className="mx-auto flex max-w-[980px] flex-col gap-[30px] md:gap-[46px]">
          <div className="flex flex-col gap-3.5 md:gap-[18px]">
            <p className="eyebrow text-accent">The difference</p>
            <h2 className="font-display text-[30px] font-extrabold leading-[1.14] tracking-[-0.03em] md:text-[46px] md:leading-[1.12]">
              Reviews tell you how someone felt.<br className="hidden md:block" /> Permits tell you what got built.
            </h2>
          </div>

          <div className="flex flex-col">
            {differences.map(([before, after], i) => (
              <div
                key={before}
                className={`flex flex-col gap-1.5 border-t border-background/[0.12] py-4 md:grid md:grid-cols-2 md:gap-10 md:py-[22px] ${
                  i === differences.length - 1 ? "border-b border-background/[0.12]" : ""
                }`}
              >
                <p className="text-sm text-background/50 line-through md:text-[17px]">{before}</p>
                <p className="text-base font-medium md:text-[17px]">{after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="px-5 py-14 md:px-20 md:py-[104px]">
        <div className="mx-auto flex max-w-[760px] flex-col items-center gap-5 text-center md:gap-[26px]">
          <h2 className="font-display text-[30px] font-extrabold leading-[1.14] tracking-[-0.03em] md:text-[46px] md:leading-[1.12]">
            Got a quote sitting in your inbox right now?
          </h2>
          <div className="flex w-full justify-center">
            <QuoteInput where="closing" />
          </div>
          <p className="max-w-[560px] text-[13px] leading-relaxed text-muted-foreground md:text-[14.5px]">
            Quote checks work anywhere in the U.S. Permit-matched contractors are live in San Jose,
            with Santa Clara and Sunnyvale next.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex items-center justify-between border-t border-border px-5 py-6 md:px-20 md:py-[30px]">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground md:h-[22px] md:w-[22px] md:text-xs">
            h
          </span>
          <span className="text-[13.5px] font-semibold md:text-sm">Haleo</span>
        </div>
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground md:gap-6 md:text-[13.5px]">
          <Link to="/" className="transition-smooth hover:text-foreground">Privacy</Link>
          <Link to="/" className="transition-smooth hover:text-foreground">Terms</Link>
          <Link to="/pro" className="hidden transition-smooth hover:text-foreground md:inline">For contractors</Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;
