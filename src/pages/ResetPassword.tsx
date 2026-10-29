// /reset-password: where the "reset your password" email lands. The link signs
// the person in for this one purpose; here they choose a new password.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { authMessage } from "@/lib/authMessages";
import { track } from "@/lib/analytics";

// Only send people back inside the app.
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

const ResetPassword = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // An expired or already-used link comes back with the reason in the URL hash.
  const linkError = useMemo(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return h.get("error_description") || h.get("error") || null;
  }, []);

  useEffect(() => {
    track("password_reset_opened", { has_session: !!user, link_error: !!linkError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      const msg = authMessage(error);
      toast({ title: msg.title, description: msg.body, variant: "destructive" });
      return;
    }
    track("password_reset_completed", {});
    toast({ title: "Password saved", description: "You're signed in." });
    navigate(next, { replace: true });
  };

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-warm px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Opening your link…</p>
          ) : !user ? (
            <div className="text-center">
              <h1 className="font-display text-xl">This link has expired</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Reset links work once, for a limited time, on the device you open them on. Ask for a fresh one and
                open it here.
              </p>
              {linkError && <p className="mt-2 text-xs text-muted-foreground">({linkError})</p>}
              <Button asChild className="mt-6 h-11 w-full rounded-full">
                <Link to={next.startsWith("/pro") ? "/pro/login?mode=signin&forgot=1" : "/login?forgot=1"}>
                  Send a new link <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={save}>
              <h1 className="font-display text-xl">Choose a new password</h1>
              <p className="mt-2 text-sm text-muted-foreground">For {user.email}.</p>
              <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">New password</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required minLength={8} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="h-11 rounded-xl bg-background pl-9" />
              </div>
              <label className="mt-3 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type it again</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl bg-background pl-9" />
              </div>
              {mismatch && <p className="mt-2 text-xs text-destructive">Those don't match yet.</p>}
              <Button type="submit" disabled={busy || password.length < 8 || password !== confirm} className="mt-5 h-11 w-full rounded-full">
                {busy ? "Saving…" : "Save and sign in"} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
