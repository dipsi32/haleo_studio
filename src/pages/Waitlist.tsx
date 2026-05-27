import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";
import { toast } from "@/hooks/use-toast";

const Waitlist = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectType, setProjectType] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setBusy(true);
    const { error } = await supabase
      .from("waitlist")
      .insert({ name, email, project_type: projectType || null, message: message || null });
    setBusy(false);
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Couldn't submit", description: error.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-warm px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
        </div>

        {submitted ? (
          <div className="rounded-3xl border border-border bg-card p-6 md:p-8 text-center shadow-soft">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-soft text-sage">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-light">You're on the list 🙏</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We read every submission personally and will reach out within 24 hours. If you already have a contractor proposal in hand, reply to your confirmation email and we'll prioritize it.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="outline" className="rounded-full">Back to home</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3 w-3" /> Private pilot
              </p>
              <h1 className="mt-4 font-display text-2xl font-light leading-tight md:text-3xl">
                Haleo is invite-only.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Tell us about your project and we'll reach out personally if it's a fit.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 h-11 rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 h-11 rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">What are you remodeling?</label>
                <Input value={projectType} onChange={(e) => setProjectType(e.target.value)} placeholder="e.g. Kitchen, primary bath, full home" className="mt-1 h-11 rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Anything we should know? <span className="opacity-60">(optional)</span>
                </label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 rounded-xl bg-background" />
              </div>
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
                {busy ? "Submitting…" : "Request access"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already have access? <Link to="/login" className="text-accent underline-offset-4 hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Waitlist;