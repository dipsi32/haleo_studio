// Wraps any page that requires a paid / early-access / test pass.
// Admin bypasses. Otherwise we render either the "request access" or
// "your trial expired" screen instead of the gated content.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePilotAccess } from "@/hooks/usePilotAccess";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";

const AccessGate = ({ children }: { children: React.ReactNode }) => {
  const access = usePilotAccess();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { signOut, user } = useAuth();

  useEffect(() => {
    if (access.loading || adminLoading) return;
    if (isAdmin || access.hasAccess) return;
    track("access_gate_hit", { reason: access.isExpired ? "expired" : "not_invited" });
  }, [access.loading, access.hasAccess, access.isExpired, adminLoading, isAdmin]);

  if (access.loading || adminLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (isAdmin || access.hasAccess) {
    return <>{children}</>;
  }

  if (access.isExpired) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-warm px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-light">Your access just wrapped</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your trial window has closed. Reach out and we'll renew or convert your account to a paid plan.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <a href="mailto:hi@haleo.com" className="w-full">
              <Button className="w-full rounded-full">Email us to renew</Button>
            </a>
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not invited
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-warm px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-foreground/70">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-light">Haleo is invite-only right now</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You're signed in as <span className="text-foreground">{user?.email}</span> but this email
          isn't on our access list yet. Drop your details on the waitlist and we'll reach out personally.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link to="/waitlist" className="w-full">
            <Button className="w-full rounded-full">
              <Sparkles className="h-4 w-4" /> Join the waitlist
            </Button>
          </Link>
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessGate;