// The homepage. One question ("Where are you in your search?"), four honest
// answers, and a walkthrough that plays exactly what happens next for the
// path they pick. Everything else on the page earns trust for that choice.
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import Logo from "@/components/Logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Gateway from "@/components/home/Gateway";
import PathDemo from "@/components/home/PathDemo";
import type { GatewayPath } from "@/lib/homeGateway";

const differences = [
  ["Star ratings from strangers", "Permits pulled, inspections passed"],
  ["Matched by zip code", "Matched by what you're building"],
  ["Explaining your project eight times", "One brief they read before they call"],
  ["Apples-to-oranges quotes", "Every line item, side by side"],
];

// The doubts a homeowner carries from "who do I even call?" to signing,
// in their words, and what answers each one.
const doubts = [
  {
    doubt: "“Will they get what I want?”",
    answer: "Describe it once, in your words and a few photos. Every contractor gets the same clear brief, so you stop explaining it on every call.",
  },
  {
    doubt: "“Have they actually done this before?”",
    answer: "For every name: jobs like yours, near you, lately, whether the city signed the work off, and whether their license is active. Receipts, not ratings.",
  },
  {
    doubt: "“Is this price fair?”",
    answer: "Bids written against the same brief can finally be compared, and every line is checked against what's normal nearby.",
  },
  {
    doubt: "“Am I ready to sign?”",
    answer: "You know who has done it, what it should cost and what you're agreeing to. Haleo gathers the facts. The call is yours.",
  },
];

const navLink = "text-[15px] text-muted-foreground transition-smooth hover:text-foreground";

const Index = () => {
  const [path, setPath] = useState<GatewayPath | null>(null);
  // The closing question has its own state: opening one must not open (and focus) the other.
  const [closingPath, setClosingPath] = useState<GatewayPath | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:py-8">
        <Logo />
        <nav className="hidden items-center gap-9 md:flex">
          <a href="#how-it-works" className={navLink}>How it works</a>
          <Link to="/pro" className={navLink}>For contractors</Link>
          <Link to="/login" className={navLink}>Sign in</Link>
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
              <Link to="/pro" className="rounded-xl px-3 py-3 hover:bg-secondary">For contractors</Link>
              <Link to="/login" className="rounded-xl px-3 py-3 hover:bg-secondary">Sign in</Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* HERO: the question, and what happens next */}
      <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-6 md:pb-28 md:pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="eyebrow text-accent">Hiring someone for your home</p>
          <h1 className="mt-5 font-display text-[40px] font-light leading-[1.05] tracking-tight md:text-[56px]">
            Find the contractor you'll be <span className="italic">glad you trusted.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground md:text-[18px]">
            Everyone has a guy. What you can't tell is who has built a job like yours, nearby, and passed the city's
            inspections. We read the record, so you hire on facts, not hope.
          </p>
          <div className="mt-9">
            <Gateway selected={path} onSelect={setPath} where="hero" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="lg:sticky lg:top-6 lg:self-start lg:pt-10"
        >
          <p className="mb-4 text-center text-[13px] text-muted-foreground lg:hidden">Here's exactly what happens next</p>
          <PathDemo path={path} onPath={setPath} />
        </motion.div>
      </section>

      {/* FROM HOPING TO KNOWING: each doubt, and what answers it */}
      <section id="how-it-works" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="eyebrow text-accent">From hoping to knowing</p>
          <h2 className="mt-5 max-w-2xl font-display text-[30px] leading-tight tracking-tight md:text-[40px]">
            Every doubt you have, <span className="italic">answered before you sign.</span>
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-2 md:gap-x-16 md:gap-y-14">
            {doubts.map((d, i) => (
              <li key={d.doubt} className="flex gap-5">
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-[13px] text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-display text-[22px] leading-snug">{d.doubt}</p>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">{d.answer}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* THE IDEA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
          <h2 className="font-display text-[30px] leading-tight tracking-tight md:text-[42px]">
            Everyone who gets a fair price knows a guy.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Someone in the trades who'll look at the quote and tell you what's real, with no stake in whether you sign.
            Haleo is that person, for everyone else.
          </p>
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
                className={`grid gap-1.5 border-t border-border py-5 md:grid-cols-2 md:gap-12 md:py-6 ${i === differences.length - 1 ? "border-b" : ""}`}
              >
                <p className="text-[15px] text-muted-foreground line-through md:text-base">{before}</p>
                <p className="text-[15px] md:text-base">{after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING: the same question */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 md:py-32">
          <h2 className="text-center font-display text-[30px] leading-tight tracking-tight md:text-[40px]">
            Wherever you are in it, <span className="italic">start here.</span>
          </h2>
          <div className="mt-10 w-full">
            <Gateway selected={closingPath} onSelect={setClosingPath} where="closing" />
          </div>
          <p className="mt-8 max-w-md text-center text-[13.5px] leading-relaxed text-muted-foreground">
            Contractor records are live in San Jose. Quote checks work anywhere in the U.S.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <Logo />
          <div className="flex items-center gap-6 text-[13.5px] text-muted-foreground">
            <Link to="/pro" className="transition-smooth hover:text-foreground">For contractors</Link>
            <span>© {new Date().getFullYear()} Haleo</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
