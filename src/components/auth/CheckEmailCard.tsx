// Shown after sign-up when Supabase wants the email confirmed before signing in.
// Shared by the homeowner and contractor sign-in pages so both read the same.
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  email: string;
  resendIn: number;
  busy: boolean;
  onResend: () => void;
  onSignIn: () => void;
};

const CheckEmailCard = ({ email, resendIn, busy, onResend, onSignIn }: Props) => (
  <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft md:p-8">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
      <Mail className="h-5 w-5" />
    </span>
    <h2 className="mt-4 font-display text-xl">Check your email</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
      We sent a link to <span className="font-medium text-foreground">{email}</span>. Open it on this device and you'll
      land right back here, signed in.
    </p>
    <p className="mt-3 text-xs text-muted-foreground">
      Nothing after a couple of minutes? Look in spam or promotions. It comes from Supabase, the service that runs
      Haleo's sign-in.
    </p>
    <Button type="button" variant="outline" className="mt-6 h-11 w-full rounded-full" disabled={busy || resendIn > 0} onClick={onResend}>
      {resendIn > 0 ? `Send it again in ${resendIn}s` : "Send it again"}
    </Button>
    <button type="button" onClick={onSignIn} className="mt-4 text-xs font-medium text-accent underline-offset-4 hover:underline">
      Already confirmed? Sign in
    </button>
  </div>
);

export default CheckEmailCard;
