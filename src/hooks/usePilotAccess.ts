// Determines whether the signed-in user has access to gated flows
// (brief, contractors, audit). Three pass types:
//   - paid          → permanent
//   - early_access  → time-bound, admin-granted
//   - test          → time-bound, internal QA
// Admins bypass entirely (handled at the gate component).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type PassType = "paid" | "early_access" | "test";

export interface PilotAccess {
  loading: boolean;
  hasAccess: boolean;
  isExpired: boolean;
  isNotInvited: boolean;
  passType: PassType | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
}

const empty: PilotAccess = {
  loading: true,
  hasAccess: false,
  isExpired: false,
  isNotInvited: false,
  passType: null,
  expiresAt: null,
  daysRemaining: null,
};

export function usePilotAccess(): PilotAccess {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PilotAccess>(empty);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setState({ ...empty, loading: false, isNotInvited: true });
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("pilot_users")
        .select("pass_type, is_active, expires_at")
        .eq("email", user.email!)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState({ ...empty, loading: false, isNotInvited: true });
        return;
      }

      const passType = (data.pass_type as PassType) ?? null;
      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      const isActive = data.is_active !== false;
      const isExpired = !!expiresAt && expiresAt.getTime() <= Date.now();
      const daysRemaining = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      // Paid never expires regardless of expires_at.
      const hasAccess = isActive && (passType === "paid" || !isExpired);

      setState({
        loading: false,
        hasAccess,
        isExpired: !hasAccess && isExpired,
        isNotInvited: false,
        passType,
        expiresAt,
        daysRemaining,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}