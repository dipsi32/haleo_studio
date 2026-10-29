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
import CheckEmailCard from "@/components/auth/CheckEmailCard";
import { authMessage } from "@/lib/authMessages";
import { useIsAdmin } from "@/hooks/useIsAdmin";

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
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/pro/login" },
        });
        if (error) throw error;
        if (data.session) toast({ title: "Account created", description: "Signing you in…" });
        else {
          setSentTo(email);
          setResendIn(60);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = authMessage(err);
      if (msg.kind === "unconfirmed") setSentTo(email);
      else if (msg.kind === "exists") setMode("signin");
      toast({ title: msg.title, description: msg.body, variant: msg.kind === "rate" ? undefined : "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!sentTo || resendIn > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: window.location.origin + "/pro/login" },
    });
    setBusy(false);
    if (error) {
      const msg = authMessage(error);
      toast({ title: msg.title, description: msg.body });
      return;
    }
    setResendIn(60);
    toast({ title: "Sent again", description: `A fresh link is on its way to ${sentTo}.` });
  };

  // Signed in, but this email isn't linked to a contractor yet. Say so,
  // instead of showing the sign-in form again as if nothing happened.
  const signedInNotContractor = !loading && !acctLoading && !!user && !isContractor;

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
            {signedInNotContractor
              ? "One step from your workspace"
              : sentTo
                ? "Almost there"
                : mode === "signup"
                  ? "Create your contractor account"
                  : "Sign in to your workspace"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {signedInNotContractor
              ? "Link your business and your Pro Workspace opens."
              : sentTo
                ? "Confirm your email and you're in."
                : mode === "signup"
                  ? "Set up your Pro Workspace in under a minute."
                  : "Email and password, quick and simple."}
          </p>
        </div>

        {signedInNotContractor ? (
          <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft md:p-8">
            <h2 className="font-display text-xl">You're signed in</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              As <span className="font-medium text-foreground">{user?.email}</span>. This email isn't linked to a
              contractor profile yet. Haleo links it when your business shows up in San Jose's permit records and you
              claim it.
            </p>
            <div className="mt-6 space-y-2">
              <Button asChild className="h-11 w-full rounded-full">
                <Link to="/pro">
                  Find and claim my business <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {isAdmin && (
                <Button asChild variant="outline" className="h-11 w-full rounded-full">
                  <Link to="/admin">Open Mission control</Link>
                </Button>
              )}
              <Button asChild variant="outline" className="h-11 w-full rounded-full">
                <Link to="/account">Continue as a homeowner</Link>
              </Button>
            </div>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Sign out and use a different email
            </button>
          </div>
        ) : sentTo ? (
          <CheckEmailCard
            email={sentTo}
            resendIn={resendIn}
            busy={busy}
            onResend={resend}
            onSignIn={() => {
              setSentTo(null);
              setMode("signin");
            }}
          />
        ) : (
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
        )}

        {!signedInNotContractor && (
        <>
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
        </>
        )}
      </motion.div>
    </div>
  );
};

export default ProLogin;
