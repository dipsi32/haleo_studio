import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

const ProLanding = () => {
  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link to="/pro/login" className="text-sm font-medium text-foreground hover:text-accent">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Haleo for contractors
          </span>
          <h1 className="mt-6 font-display text-5xl font-light leading-[1.05] md:text-6xl">
            Win more of the <em className="text-accent">right</em> work.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Skip the cold leads. Haleo sends you projects from homeowners who've already done the
            scope, the budget, and the photos — so your bid lands in context, not in a guessing game.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/pro/login">
                Open my workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>

        <div className="mt-20 grid gap-5 text-left md:grid-cols-3">
          {[
            {
              icon: Inbox,
              title: "A real inbox",
              body: "Every project arrives with a brief, photos, and a budget signal. No more 'how much for a kitchen?' calls.",
            },
            {
              icon: FileText,
              title: "Translate, don't write",
              body: "Turn the homeowner's brief into a proposal in minutes. We pre-fill the scope; you set the price.",
            },
            {
              icon: Sparkles,
              title: "Your portfolio, on the record",
              body: "Paste your Instagram and site. We pull your best work into a clean portal you can share anywhere.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card/60 p-5 shadow-soft backdrop-blur">
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ProLanding;
