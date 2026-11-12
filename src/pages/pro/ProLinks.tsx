// Brief links: the contractor sends a prospect a Haleo link before the site
// visit. The prospect fills in the project, and the brief comes back to the
// contractor's inbox, free, with a deal read on top.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Link2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ProHeader from "@/components/pro/ProHeader";
import BuyBoxCard from "@/components/pro/BuyBoxCard";
import FrontDoorCard from "@/components/pro/FrontDoorCard";
import YourLinkHero from "@/components/pro/YourLinkHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import {
  INVITE_LIST_LABEL,
  contractorDisplayName,
  inviteListStatus,
  inviteMessage,
  inviteUrl,
  type InviteListStatus,
} from "@/lib/invites";
import type { Database } from "@/integrations/supabase/types";

type InviteRow = Database["public"]["Tables"]["contractor_invites"]["Row"];

const STATUS_STYLE: Record<InviteListStatus, string> = {
  sent: "border-border bg-secondary text-muted-foreground",
  opened: "border-amber-400/40 bg-amber-50 text-amber-700",
  received: "border-sage/30 bg-sage/10 text-sage",
  expired: "border-border bg-secondary text-muted-foreground",
  revoked: "border-border bg-secondary text-muted-foreground",
};

export default function ProLinks() {
  const { user } = useAuth();
  const { account, refetch } = useContractorAccount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const contractorId = account?.contractor_id ?? null;
  const name = contractorDisplayName({ company: account?.company_name ?? null, name: "your team" });

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractorId) return;
    const { data } = await supabase
      .from("contractor_invites")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false })
      .limit(50);
    setInvites((data ?? []) as InviteRow[]);
    setLoading(false);
  }, [contractorId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Counts change while the contractor is away from this tab.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // Honor #fit so "Set your fit criteria" lands on the card.
  useEffect(() => {
    if (window.location.hash === "#fit" || window.location.hash === "#front-door") document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loading]);

  const copy = async (key: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
      toast({ title: `${what} copied` });
    } catch {
      toast({ title: "Couldn't copy", description: "Select the link and copy it by hand.", variant: "destructive" });
    }
  };

  const create = async () => {
    if (!contractorId || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("contractor_invites")
        .insert({ contractor_id: contractorId, created_by: user.id, prospect_label: label.trim() || null })
        .select("*")
        .single();
      if (error) throw error;
      setInvites((cur) => [data as InviteRow, ...cur]);
      setLabel("");
      track("invite_created", { has_label: !!label.trim() });
      await copy(`link-${(data as InviteRow).id}`, inviteUrl((data as InviteRow).token), "Link");
    } catch (e) {
      toast({ title: "Couldn't create the link", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("contractor_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast({ title: "Couldn't turn it off", description: error.message, variant: "destructive" });
      return;
    }
    track("invite_revoked");
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <ProHeader />
      <main className="mx-auto max-w-5xl px-6 py-7 md:py-10">
        <h1 className="sr-only">Your link</h1>
        <div className="mb-8">
          <YourLinkHero
            contractorId={contractorId}
            companyName={account?.company_name ?? null}
            handle={(account as { front_door_handle?: string | null } | null)?.front_door_handle ?? null}
          />
        </div>

        <h2 className="mb-3 font-display text-xl">On your website and Google</h2>
        {account && (
          <div className="mb-8">
            <FrontDoorCard
              accountId={account.id}
              contractorId={contractorId}
              branding={account.branding}
              companyName={account.company_name}
              handle={(account as { front_door_handle?: string | null }).front_door_handle ?? null}
              onSaved={() => void refetch()}
            />
          </div>
        )}

        <details className="group rounded-3xl border border-border bg-card p-6 shadow-soft">
          <summary className="cursor-pointer list-none font-display text-xl">
            A link for one person <span className="text-sm font-normal text-muted-foreground">Optional. Track one lead by name.</span>
          </summary>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 80))}
              placeholder="Who is it for? Only you see this"
              aria-label="Who is this link for"
              className="h-11 rounded-xl bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) void create();
              }}
            />
            <Button onClick={create} disabled={creating || !contractorId} className="h-11 rounded-full px-6">
              <Link2 className="h-4 w-4" /> {creating ? "Creating…" : "Create link"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Each link is for one prospect and works for 45 days. The homeowner sees that it came from {account?.company_name ? account.company_name : "you"}, and their brief stays theirs.
          </p>
        </details>

        {(loading || invites.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-xl">Links you've sent to one person</h2>
          {loading ? (
            <div className="mt-4 space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/40" />)}</div>
          ) : (
            <ul className="mt-4 space-y-3">
              {invites.map((i) => {
                const status = inviteListStatus(i);
                const live = status === "sent" || status === "opened";
                const url = inviteUrl(i.token);
                return (
                  <li key={i.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.prospect_label || "Unnamed prospect"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Created {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                          {i.open_count > 0 && status !== "received" ? ` · opened ${i.open_count} time${i.open_count === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
                        {INVITE_LIST_LABEL[status]}
                      </span>
                    </div>

                    {live && (
                      <>
                        <p className="mt-3 break-all rounded-xl bg-muted/50 px-3 py-2 font-mono text-xs text-foreground/80">{url}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => copy(`link-${i.id}`, url, "Link")}>
                            {copied === `link-${i.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() =>
                              copy(`msg-${i.id}`, inviteMessage({ contractor: account?.company_name || name, url }), "Message")
                            }
                          >
                            {copied === `msg-${i.id}` ? <Check className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />} Copy a text message
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => revoke(i.id)}>
                            Turn off
                          </Button>
                        </div>
                      </>
                    )}

                    {status === "received" && i.outreach_send_id && (
                      <div className="mt-3">
                        <Button size="sm" className="rounded-full" onClick={() => navigate(`/pro/inbox?open=${i.outreach_send_id}`)}>
                          Open the brief
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        )}

        <div className="mt-10">
          {account ? (
            <BuyBoxCard accountId={account.id} initial={account.buy_box} onSaved={() => void refetch()} />
          ) : (
            <div className="h-48 animate-pulse rounded-3xl bg-muted/40" />
          )}
        </div>
      </main>
    </div>
  );
}
