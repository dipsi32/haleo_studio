// Magic-link login for contractors. Email + 6-digit OTP. No passwords.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowRight } from "lucide-react";
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
  const next = params.get("next") || "/pro/inbox";
  const errorParam = params.get("error");

  const [stage, setStage] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
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

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/pro/login`,
        },
      });
      if (error) throw error;
      setStage("otp");
      toast({ title: "We sent you a 6-digit code", description: `Check ${email}` });
    } catch (err) {
      toast({
        title: "Couldn't send code",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      // Effect above handles routing
    } catch (err) {
      toast({
        title: "That code didn't work",
        description: err instanceof Error ? err.message : "Try again or request a new one.",
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
          <h1 className="font-display text-3xl font-light">
            {stage === "email" ? "Sign in to your workspace" : "Enter your 6-digit code"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {stage === "email"
              ? "Type the email tied to your Haleo profile. We'll send you a one-time code — no passwords."
              : `Check ${email} — the code expires in 10 minutes.`}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          {stage === "email" ? (
            <form onSubmit={sendOtp} className="space-y-3">
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
              <Button type="submit" disabled={busy || !email} className="h-11 w-full rounded-full">
                {busy ? "Sending…" : "Send my code"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-3">
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="h-14 rounded-xl bg-background text-center font-mono text-2xl tracking-[0.5em]"
              />
              <Button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="h-11 w-full rounded-full"
              >
                {busy ? "Opening…" : "Open my workspace"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStage("email");
                  setOtp("");
                }}
                className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Wrong email? Go back
              </button>
            </form>
          )}
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
