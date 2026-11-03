// "Forgot password?" for both sign-in pages: ask for the email, send a reset
// link, then say plainly where it went. The link opens /reset-password.
import { useEffect, useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { authMessage } from "@/lib/authMessages";
import { track } from "@/lib/analytics";

type Props = {
  initialEmail: string;
  /** Where to send them after the new password is saved. */
  next: string;
  onBack: () => void;
};

const ForgotPasswordCard = ({ initialEmail, next, onBack }: Props) => {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || wait > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password?next=${encodeURIComponent(next)}`,
    });
    setBusy(false);
    if (error) {
      const msg = authMessage(error);
      toast({ title: msg.title, description: msg.body, variant: msg.kind === "rate" ? undefined : "destructive" });
      return;
    }
    track("password_reset_requested", {});
    setSent(true);
    setWait(60);
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      {sent ? (
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <Mail className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-display text-xl">Check your email</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            If there's an account for <span className="font-medium text-foreground">{email}</span>, a link to set a new
            password is on its way. Open it on this device.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Nothing after a couple of minutes? Look in spam or promotions.</p>
          <Button type="button" variant="outline" className="mt-6 h-11 w-full rounded-full" disabled={busy || wait > 0} onClick={() => void send()}>
            {wait > 0 ? `Send it again in ${wait}s` : "Send it again"}
          </Button>
        </div>
      ) : (
        <form onSubmit={send}>
          <h2 className="font-display text-xl">Reset your password</h2>
          <p className="mt-2 text-sm text-muted-foreground">We'll email you a link to set a new one.</p>
          <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Email</label>
          <div className="relative mt-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="h-11 rounded-xl bg-background pl-9"
            />
          </div>
          <Button type="submit" disabled={busy || !email} className="mt-4 h-11 w-full rounded-full">
            {busy ? "Sending…" : "Send reset link"} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}
      <button type="button" onClick={onBack} className="mt-4 block w-full text-center text-xs font-medium text-accent underline-offset-4 hover:underline">
        Back to sign in
      </button>
    </div>
  );
};

export default ForgotPasswordCard;
