// Subscribes to homeowner_notifications and shows a toast for any new one,
// so the homeowner never misses a contractor reply — regardless of which page
// they're on. Mount once at the app root inside AuthProvider.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function HomeownerNotificationToaster() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    mountedAt.current = Date.now();

    const channel = supabase
      .channel(`hn-toast-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "homeowner_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string;
            title: string;
            body: string;
            outreach_send_id: string | null;
            created_at: string;
          };
          // Skip stale events that fire on initial subscribe.
          if (new Date(n.created_at).getTime() < mountedAt.current - 5000) return;

          toast({
            title: n.title,
            description: n.body,
            action: n.outreach_send_id
              ? ({
                  altText: "Open conversation",
                  onClick: () => navigate(`/account?convo=${n.outreach_send_id}`),
                  children: "Open",
                } as any)
              : undefined,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
}
