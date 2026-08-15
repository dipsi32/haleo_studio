import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { track } from "@/lib/analytics";

const Login = () => {
  const { user, loading } = useAuth();
  const { isContractor, account, loading: contractorLoading } = useContractorAccount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";
  const resolvedNext = useMemo(() => {
    if (!user || !isContractor) return next;
    if (next === "/account" || next === "/login") {
      return account?.onboarded_at ? "/pro/profile" : "/pro/onboarding";
    }
    return next;
  }, [account?.onboarded_at, isContractor, next, user]);

  // Homeowners arriving from a finished brief are new, not returning —
  // open on sign-up and speak to what they just built.
  const intent = params.get("intent");
  const isMatchIntent = intent === "match";

  const [mode, setMode] = useState<"signin" | "signup">(isMatchIntent ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || contractorLoading || !user) return;
    navigate(resolvedNext, { replace: true });
  }, [user, loading, contractorLoading, navigate, resolvedNext]);

  const handleGoogle = async () => {
    setBusy(true);
    track(mode === "signup" ? "signup_started" : "login_completed", { method: "google" });
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + resolvedNext,
    });
    if (result.error) {
      toast({ title: "Couldn't sign in with Google", description: String(result.error), variant: "destructive" });
      setBusy(false);
      return;
    }
    if (result.redirected) return; // Browser is redirecting
    // Tokens set — go to next.
    navigate(resolvedNext, { replace: true });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        track("signup_started", { method: "email" });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + next,
            data: { full_name: name || undefined },
          },
        });
        if (error) throw error;
        track("signup_completed", { method: "email" });
        toast({ title: "Account created", description: "You're all set — signing you in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("login_completed", { method: "email" });
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
          <h1 className="font-display text-2xl font-light">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your brief, audit, and saved rooms live behind your account — so you can pick up where you left off.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <Button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            variant="outline"
            className="h-12 w-full gap-3 rounded-full border-border text-base"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Full name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 h-11 rounded-xl bg-background"
                />
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
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
              {mode === "signup" ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Haleo?"}{" "}
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
          Don't have access yet?{" "}
          <Link to="/waitlist" className="text-accent underline-offset-4 hover:underline">
            Join the waitlist
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;