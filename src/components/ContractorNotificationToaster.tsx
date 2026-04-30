// Same pattern as HomeownerNotificationToaster, for contractors.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useContractorAccount } from "@/hooks/useContractorAccount";

export default function ContractorNotificationToaster() {
  const { account } = useContractorAccount();
  const navigate = useNavigate();
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!account?.contractor_id) return;
    mountedAt.current = Date.now();

    const channel = supabase
      .channel(`cn-toast-${account.contractor_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contractor_notifications",
          filter: `contractor_id=eq.${account.contractor_id}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string;
            title: string;
            body: string;
            outreach_send_id: string | null;
            created_at: string;
          };
          if (new Date(n.created_at).getTime() < mountedAt.current - 5000) return;
          toast(n.title, {
            description: n.body,
            action: n.outreach_send_id
              ? {
                  label: "Open",
                  onClick: () => navigate(`/pro/inbox?open=${n.outreach_send_id}`),
                }
              : undefined,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account?.contractor_id, navigate]);

  return null;
}
