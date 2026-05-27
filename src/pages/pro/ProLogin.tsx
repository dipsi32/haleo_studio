// Plain email + password login for contractors.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";

const ProLogin = () => {
  const { user, loading } = useAuth();
  const { isContractor, account, loading: acctLoading } = useContractorAccount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/pro/profile";
  const errorParam = params.get("error");

  const initialMode = (params.get("mode") === "signin" ? "signin" : "signup") as "signin" | "signup";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || acctLoading) return;
    if (!user) return;
    if (!isContractor) return;
    navigate(account?.onboarded_at ? next : "/pro/onboarding", { replace: true });
  }, [user, loading, isContractor, acctLoading, account, navigate, next]);

  useEffect(() => {
    if (errorParam === "not_contractor") {
      toast({
        title: "This isn't a contractor account",
        description:
          "Sign in here is for contractors. If you're a homeowner, head to /login. If you should have access, email hello@haleo.studio.",
        variant: "destructive",
      });
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/pro/login" },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "Signing you in…" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast({
        title: mode === "signup" ? "Couldn't create account" : "Sign in failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-warm px-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo />
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Pro Workspace
          </span>
          <h1 className="font-display text-2xl font-light">
            {mode === "signup" ? "Create your contractor account" : "Sign in to your workspace"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {mode === "signup"
              ? "Set up your Pro Workspace in under a minute."
              : "Email and password — quick and simple."}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`h-9 rounded-full text-xs font-medium uppercase tracking-[0.18em] transition ${
                mode === "signup" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`h-9 rounded-full text-xs font-medium uppercase tracking-[0.18em] transition ${
                mode === "signin" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 rounded-xl bg-background pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 rounded-xl bg-background pl-9"
                />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
              {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New contractor?"}{" "}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have a profile yet?{" "}
          <Link to="/pro" className="text-accent underline-offset-4 hover:underline">
            Find yours →
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Are you a homeowner?{" "}
          <Link to="/login" className="text-accent underline-offset-4 hover:underline">
            Sign in here
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ProLogin;
