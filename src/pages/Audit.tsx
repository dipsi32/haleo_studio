import { Link } from "react-router-dom";
import { ArrowLeft, FileSearch, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";

const Audit = () => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-smooth hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </div>
    </header>
    <main className="container max-w-3xl py-24 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <FileSearch className="h-6 w-6" />
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">The forensic audit</p>
      <h1 className="mt-3 font-display text-5xl font-light leading-tight text-balance md:text-6xl">
        Coming online <em className="italic text-accent">next.</em>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground">
        Upload a contractor proposal and we'll cross-check every line item against San Jose permit
        data — Haleo Score, top findings, and the smart questions to ask before you sign.
      </p>
      <div className="mx-auto mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-accent" />
        Wiring up Lovable Cloud + AI Gateway in the next pass.
      </div>
      <Link
        to="/brief"
        className="mt-12 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-smooth hover:bg-primary/90"
      >
        No quote yet? Let's find your contractor.
      </Link>
    </main>
  </div>
);

export default Audit;
