import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type ContractorAccount = Database["public"]["Tables"]["contractor_accounts"]["Row"];

export type PortfolioLink = {
  url: string;
  type?: "instagram" | "website" | "houzz" | "yelp" | "other";
  title?: string;
  thumbnail?: string;
  status?: "pending" | "scraping" | "ready" | "failed";
};

export function useContractorAccount() {
  const { user, loading: authLoading } = useAuth();
  const [account, setAccount] = useState<ContractorAccount | null>(null);
  const [isContractor, setIsContractor] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    if (!user) return;
    const [{ data: roleData }, { data: acctData }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "contractor" }),
      supabase.from("contractor_accounts").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setIsContractor(Boolean(roleData));
    setAccount(acctData ?? null);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsContractor(false);
      setAccount(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await refetch();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  return { account, isContractor, loading, refetch };
}
