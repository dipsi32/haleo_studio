// Sending a brief to the contractor who invited you shouldn't need an
// account: the homeowner already gave their name and number, and a sign-up
// wall (with an email to confirm) loses real leads at the last step.
//
// So a visitor without an account gets a quiet guest session (Supabase
// anonymous sign-in) and sends right away. If guest sessions are switched
// off for the project, it falls back to the normal sign-in. The contractor
// demo's send step writes nothing and skips all of this.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { isDemoToken } from "@/lib/invites";

export default function InviteSendRoute({ children }: { children: React.ReactNode }) {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const demo = isDemoToken(token);
  const [guest, setGuest] = useState<"idle" | "trying" | "failed">("idle");

  useEffect(() => {
    if (demo || loading || user || guest !== "idle") return;
    setGuest("trying");
    supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) {
        track("error_edge_function", { where: "guest_send", message: error.message });
        setGuest("failed");
      }
      // On success, the auth listener sets the user and this renders the page.
    });
  }, [demo, loading, user, guest]);

  if (demo) return <>{children}</>;
  if (user) return <>{children}</>;
  if (guest === "failed") return <ProtectedRoute>{children}</ProtectedRoute>;
  return (
    <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">One moment…</div>
  );
}
