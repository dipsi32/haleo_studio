import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUp, Menu } from "lucide-react";
import Logo from "@/components/Logo";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { setPendingQuoteFile, setPendingQuoteText } from "@/lib/quoteHandoff";
import { track } from "@/lib/analytics";
import JobFitBreakdown from "@/components/contractors/JobFitBreakdown";
import { classifyHomeEntry, type HomeEntry } from "@/lib/homeEntry";
import { jobFit } from "@/lib/jobFit";

/* ---------------------------------------------------------------- */
/* The one box: whatever they have, it finds the door                 */
/* ---------------------------------------------------------------- */

const NEXT: Record<HomeEntry, { button: string; hint: string }> = {
  project: { button: "Start with my project", hint: "We'll turn this into a clear brief, then show you who's built it near you." },
  names: { button: "Check these names", hint: "We'll pull out each contractor and read their permits, inspections and license against your job." },
  quote: { button: "Check this quote", hint: "We'll go through it line by line: what's fair, what's missing, what to ask." },
};

const FrontDoorBox = ({ where }: { where: "hero" | "closing" }) => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const typed = text.trim().length >= 4;
  const kind = classifyHomeEntry(text);
  const next = NEXT[kind];

  const go = () => {
    const t = text.trim();
    track("home_entry_started", { where, kind: typed ? kind : "empty" });
    if (!typed) return navigate("/brief");
    if (kind === "quote") {
      setPendingQuoteText(t);
      return navigate("/roast");
    }
    if (kind === "names") return navigate(`/shortlist?text=${encodeURIComponent(t.slice(0, 6000))}`);
    return navigate(`/brief?note=${encodeURIComponent(t.slice(0, 500))}`);
  };

  const quiet = "underline-offset-4 transition-smooth hover:text-foreground hover:underline";
  return (
    <div className="w-full max-w-2xl text-left">
      <div className="rounded-3xl border border-border bg-card p-3 shadow-soft focus-within:border-foreground/30">
        <label htmlFor={`front-door-${where}`} className="sr-only">
          Tell us about your project, or paste the names you've been given
        </label>
        <Textarea
          id={`front-door-${where}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go();
          }}
          rows={4}
          placeholder={"“Our kitchen is dark and cramped. We'd love to open it up.”\n\nOr paste the names neighbors sent you."}
          className="min-h-[150px] resize-none border-0 bg-transparent px-3 py-2 text-[16px] leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex flex-col gap-3 px-2 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-[20px] text-[13px] leading-snug text-muted-foreground" aria-live="polite">
            {typed ? next.hint : "Your project in your words, or the names you've got. Messy is fine."}
          </p>
          <button
            type="button"
            onClick={go}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-smooth hover:opacity-90"
          >
            {typed ? next.button : "Start with my project"} <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*,.txt,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setPendingQuoteFile(f);
          track("home_entry_started", { where, kind: "quote_file" });
          navigate("/roast");
        }}
      />
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 px-2 text-[13.5px] text-muted-foreground">
        <Link to="/shortlist" onClick={() => track("home_door_clicked", { door: "screenshots", where })} className={quiet}>
          Add screenshots of a thread
        </Link>
        <Link to="/shortlist?one=1" onClick={() => track("home_door_clicked", { door: "one_name", where })} className={quiet}>
          Check one contractor
        </Link>
        <button type="button" onClick={() => fileRef.current?.click()} className={quiet}>
          Upload a quote
        </button>
      </p>
    </div>
  );
};

/* ---------------------------------------------------------------- */
/* An example of what each name gets: the same component the product  */
/* uses, on example records                                           */
/* ---------------------------------------------------------------- */

const exampleFit = (() => {
  const d = (m: number) => new Date(Date.now() - m * 30 * 864e5).toISOString().slice(0, 10);
  const permits = [
    { permit_number: "e1", zip: "95125", city: "SAN JOSE", issued_date: d(2), work_type: "Alteration", description: "Kitchen remodel", address: "1 Cabana Dr" },
    { permit_number: "e2", zip: "95125", city: "SAN JOSE", issued_date: d(5), work_type: "Alteration", description: "Kitchen remodel, new circuits", address: "2 Minnesota Av" },
    { permit_number: "e3", zip: "95118", city: "SAN JOSE", issued_date: d(9), work_type: "Alteration", description: "Kitchen and bath remodel", address: "3 Branham Ln" },
    { permit_number: "e4", zip: "95112", city: "SAN JOSE", issued_date: d(14), work_type: "Alteration", description: "Bathroom remodel", address: "4 Taylor St" },
  ];
  const ok = (code: string, label: string) => ({ code, label, status: "complete" as const });
  return jobFit(permits, { room: "kitchen", address: { zip: "95125" }, painPoints: [], media: [] }, {
    inspections: [
      { folder_number: "e1", found: true, lifecycle: "closed", approvals: [ok("B", "Building"), ok("E", "Electrical"), ok("P", "Plumbing")] },
      { folder_number: "e2", found: true, lifecycle: "in_inspection", approvals: [ok("E", "Electrical"), ok("B", "Building")] },
    ],
    license: {
      license_number: "0000000", status: "Active", business_name: null, classifications: ["B"], issue_date: "2012-01-01",
      expiration_date: new Date(Date.now() + 700 * 864e5).toISOString(), has_disciplinary_action: false, disciplinary_notes: null,
      workers_comp_status: null, bond_status: null, scrape_succeeded: true, last_checked_at: new Date().toISOString(), deep_link: "",
    },
  });
})();

const ExampleFitCard = () => (
  <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-7">
    <p className="eyebrow text-muted-foreground">Example · what every name gets</p>
    <p className="mt-3 font-display text-xl">A contractor you were sent</p>
    <p className="mt-1 text-[13px] text-muted-foreground">Read against a kitchen remodel in 95125</p>
    <JobFitBreakdown fit={exampleFit} who="this contractor" defaultOpen className="mt-5" surface="home_example" />
  </div>
);

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
  ["Explaining your project eight times", "One brief they read before they call"],
  ["Apples-to-oranges quotes", "Every line item, side by side"],
];

// The doubts a homeowner carries from "who do I even call?" to signing,
// in their words, and what answers each one.
const doubts = [
  {
    doubt: "“Will they get what I want?”",
    answer: "Describe it once, in your words and a few photos. Every contractor gets the same clear brief, so you stop explaining it on every call, and they show up already knowing the job.",
  },
  {
    doubt: "“Have they actually done this before?”",
    answer: "For every name, from a neighbor or from us: jobs like yours, near you, lately, whether the city signed the work off, and whether their license is active. Receipts, not ratings.",
  },
  {
    doubt: "“Is this price fair?”",
    answer: "Bids written against the same brief can finally be compared. Every line is checked against what's normal nearby: what's included, what's missing, what to ask.",
  },
  {
    doubt: "“Am I ready to sign?”",
    answer: "By now you know who's done it, what it should cost and what you're agreeing to. Haleo gathers the facts. The call is yours, and you'll make it with confidence.",
  },
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
              <Link to="/shortlist" className="rounded-xl px-3 py-3 hover:bg-secondary">Check my names</Link>
              <Link to="/brief" className="rounded-xl px-3 py-3 hover:bg-secondary">Find a contractor</Link>
              <Link to="/pro" className="rounded-xl px-3 py-3 hover:bg-secondary">For contractors</Link>
              <Link to="/login" className="rounded-xl px-3 py-3 hover:bg-secondary">Sign in</Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* HERO: one box, whatever they have */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-8 md:pb-28 md:pt-16 lg:grid-cols-[1.25fr_0.75fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-3xl">
          <p className="eyebrow text-accent">Hiring someone for your home</p>
          <h1 className="mt-5 font-display text-[40px] font-light leading-[1.05] tracking-tight md:text-[60px]">
            Find the contractor you'll be <span className="italic">glad you trusted.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-muted-foreground">
            Everyone has a guy. What you can't tell is who has built a job like yours, nearby, and passed the city's
            inspections. We read the record, so you hire on facts, not hope.
          </p>
          <div className="mt-10">
            <FrontDoorBox where="hero" />
          </div>
        </motion.div>
        {/* What you'll know about every name, right where the doubt starts (desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hidden lg:block"
        >
          <ExampleFitCard />
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

          <div className="mt-16 grid items-start gap-6 md:grid-cols-2 lg:mx-auto lg:max-w-2xl lg:grid-cols-1">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5 }} className="lg:hidden">
              <ExampleFitCard />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, delay: 0.1 }}>
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

      {/* CLOSING: the same box, wherever they are in it */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center md:py-32">
          <h2 className="font-display text-[30px] leading-tight tracking-tight md:text-[40px]">
            Wherever you are in it, <span className="italic">start here.</span>
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            A project you've been putting off, a thread full of names, or a quote you're not sure about.
          </p>
          <div className="mt-10 flex w-full justify-center">
            <FrontDoorBox where="closing" />
          </div>
          <p className="mt-8 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Contractor records are live in San Jose. Quote checks work anywhere in the U.S.
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
