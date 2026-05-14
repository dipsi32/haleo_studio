import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Hammer, ArrowRight, FileSearch, MapPin, Clock, Sparkles } from "lucide-react";

/**
 * The "two doors" — the first thing a homeowner sees when they land in their
 * account. Most homeowners arrive in one of two emotional states:
 *
 *   1. They already have a proposal in hand and they're nervous about signing it.
 *   2. They have a project in mind and don't know which contractor to trust.
 *
 * We route both, gently and clearly, without overwhelming them with options.
 */
export default function HomeownerPathChooser() {
  return (
    <section aria-labelledby="paths-heading" className="mt-10">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 id="paths-heading" className="font-display text-xl font-medium">
          Where can we meet you today?
        </h2>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Two doors. Pick the one that matches where you are right now — we'll take it from there.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* PATH 1 — Proposal in hand, needs a forensic read before signing. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:shadow-warm"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft">
              <FileSearch className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                Path 1 · You have a proposal
              </p>
              <h3 className="mt-1 font-display text-2xl font-light leading-tight">
                Read it for me, line by line.
              </h3>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Drop the PDF (or the link a contractor sent). Your Advocate cross-checks every
            line against permit records, license status, and what neighbors actually paid —
            then hands you the exact pushback language for anything that smells off.
          </p>

          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span>About a minute to a full risk score</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              <span>Inflated lines, missing permits, vague terms — flagged</span>
            </li>
          </ul>

          <Link
            to="/proposal"
            className="mt-6 inline-flex items-center justify-between gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
          >
            Review my proposal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-2 text-[11px] text-muted-foreground">
            PDF, image, or link · Free first read
          </p>
        </motion.div>

        {/* PATH 2 — Earlier in the journey: needs trustworthy contractors who've
            actually pulled permits in their city. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="group relative flex flex-col overflow-hidden rounded-3xl border border-sage/30 bg-sage-soft p-6 shadow-soft transition-all hover:shadow-warm"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-background/60">
              <Hammer className="h-5 w-5 text-sage" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">
                Path 2 · You need the right contractor
              </p>
              <h3 className="mt-1 font-display text-2xl font-light leading-tight">
                Show me who's actually permitted near me.
              </h3>
            </div>
          </div>

          <p className="mt-4 text-sm text-sage-foreground/85">
            Tell us about your space in a few minutes. We'll match you with a short, ranked
            list of contractors who have a clean license and have pulled real permits for
            jobs like yours — in your city. No directory junk. No paid placements.
          </p>

          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-sage" />
              <span>Filtered by permits in your zip, not ads</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-sage" />
              <span>License, bond, and violation history checked first</span>
            </li>
          </ul>

          <Link
            to="/brief?fresh=1"
            className="mt-6 inline-flex items-center justify-between gap-2 rounded-full bg-sage px-5 py-3 text-sm font-medium text-sage-foreground transition-all hover:opacity-90"
          >
            Build my project brief <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-2 text-[11px] text-sage-foreground/70">
            ~3 minutes · You stay anonymous until you choose to reach out
          </p>
        </motion.div>
      </div>

      {/* Quiet reassurance bar — for the homeowner who isn't sure either applies. */}
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Not sure yet? Either path is reversible — and you can do both. Most homeowners do.
      </p>
    </section>
  );
}
