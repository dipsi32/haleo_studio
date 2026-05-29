import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { identify, resetAnalytics, track } from "@/lib/analytics";

/**
 * Mount once inside <BrowserRouter> + <AuthProvider>.
 * - Fires $pageview on every route change.
 * - Identifies user (without PII) right after login.
 * - Resets on sign-out.
 */
export default function AnalyticsTracker() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const lastPath = useRef<string | null>(null);
  const identifiedFor = useRef<string | null>(null);

  // Route → $pageview (path only, no query — avoids leaking tokens)
  useEffect(() => {
    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;
    track("$pageview", { path });

    if (path === "/") track("landing_viewed");
  }, [location.pathname]);

  // Auth → identify / reset
  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (identifiedFor.current) {
        resetAnalytics();
        identifiedFor.current = null;
      }
      return;
    }

    if (identifiedFor.current === user.id) return;
    identifiedFor.current = user.id;

    (async () => {
      // Resolve user_type + pilot status without sending PII.
      const [{ data: contractorRow }, { data: pilotRow }] = await Promise.all([
        supabase
          .from("contractor_accounts")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("pilot_users")
          .select("is_active")
          .eq("email", user.email ?? "")
          .maybeSingle(),
      ]);

      const provider = user.app_metadata?.provider;
      identify(user.id, {
        user_type: contractorRow ? "contractor" : "homeowner",
        is_pilot_user: Boolean(pilotRow?.is_active),
        signup_method: provider === "google" ? "google" : "email",
        city: "San Jose",
        created_at: user.created_at,
      });
    })();
  }, [user, loading]);

  return null;
}
