// The one thing a contractor needs after the kickoff call: their link, and
// a two-tap way to send it to the lead who just texted them.
import { useEffect, useState } from "react";
import { Check, Copy, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { frontDoorHandle, frontDoorUrl } from "@/lib/frontDoor";
import { inviteMessage } from "@/lib/invites";

type Props = { contractorId: string | null; companyName: string | null; handle: string | null; personName?: string | null };

const STEPS = ["A lead texts you about a project", "You reply with your link", "Their project lands in your inbox, scoped. You make the call."];

export default function YourLinkHero({ contractorId, companyName, handle: chosen, personName }: Props) {
  const { toast } = useToast();
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId) return;
    supabase
      .from("contractors")
      .select("slug")
      .eq("id", contractorId)
      .maybeSingle()
      .then(({ data }) => setSlug((data as { slug?: string | null } | null)?.slug ?? null));
  }, [contractorId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const handle = slug ? frontDoorHandle({ chosen, companyName, slug }) : null;
  const url = handle ? frontDoorUrl(handle, "text", origin) : "";
  const who = personName ? `${personName} from ${companyName ?? "us"}` : companyName ?? "us";
  const message = url ? inviteMessage({ contractor: who, url }) : "";

  const copy = async (key: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
      toast({ title: `${what} copied`, description: key === "msg" ? "Paste it into your reply." : undefined });
      track("your_link_copied", { what: key });
    } catch {
      toast({ title: "Couldn't copy", description: "Press and hold the link to copy it.", variant: "destructive" });
    }
  };

  const share = async () => {
    track("your_link_shared", { via: typeof navigator !== "undefined" && "share" in navigator ? "share_sheet" : "sms" });
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        /* closed the sheet */
        return;
      }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
  };

  if (!contractorId) return null;

  return (
    <section className="rounded-3xl border border-accent/30 bg-card p-6 shadow-soft md:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Your link</p>
      {!url ? (
        <div className="mt-3 h-10 w-2/3 animate-pulse rounded-xl bg-muted/50" />
      ) : (
        <p className="mt-2 break-all font-display text-2xl font-light md:text-3xl">{url.replace(/^https?:\/\//, "")}</p>
      )}
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Reply to your next lead with this. They share photos, what they want, budget, timing and when they can meet.
        You know the job before you make the trip.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="lg" className="rounded-full" onClick={share} disabled={!url}>
          <Send className="h-4 w-4" /> Text it to a lead
        </Button>
        <Button size="lg" variant="outline" className="rounded-full" onClick={() => copy("msg", message, "Message")} disabled={!url}>
          {copied === "msg" ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} Copy the reply
        </Button>
        <Button size="lg" variant="ghost" className="rounded-full" onClick={() => copy("link", url, "Link")} disabled={!url}>
          {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy link
        </Button>
      </div>

      {message && (
        <p className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-foreground/80">{message}</p>
      )}

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-start gap-2.5 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground">{i + 1}</span>
            <span className="text-foreground/80">{s}</span>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-xs text-muted-foreground">
        Tip: save the reply as a text shortcut on your phone (iPhone: Settings → General → Keyboard → Text Replacement), and
        it's two taps every time.
      </p>
    </section>
  );
}
