// Homeowner-side drawer for reading & replying to a contractor's question
// about a specific brief. Pulls the same brief_clarifications thread the
// contractor sees, and notifies the contractor on every reply.
import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Loader2, Hammer } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type Message = {
  id: string;
  sender_role: "contractor" | "homeowner";
  message: string;
  created_at: string;
};

type SendMeta = {
  contractor_id: string;
  contractor_name: string | null;
  headline: string;
};

export default function HomeownerConversationDrawer({
  outreachSendId,
  open,
  onClose,
}: {
  outreachSendId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meta, setMeta] = useState<SendMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load thread + send metadata
  useEffect(() => {
    if (!open || !outreachSendId || !user) return;
    let active = true;
    setLoading(true);
    setMessages([]);
    setMeta(null);

    (async () => {
      const [sendRes, msgRes] = await Promise.all([
        supabase
          .from("outreach_sends")
          .select("contractor_id, contractor_name, outreach_batches(brief_snapshot, neighborhood)")
          .eq("id", outreachSendId)
          .maybeSingle(),
        supabase
          .from("brief_clarifications")
          .select("id, sender_role, message, created_at")
          .eq("outreach_send_id", outreachSendId)
          .order("created_at", { ascending: true }),
      ]);

      if (!active) return;
      if (sendRes.data) {
        const snap: any = sendRes.data.outreach_batches?.brief_snapshot ?? {};
        const proj = snap.projectType || snap.scope_label || "your project";
        const hood = sendRes.data.outreach_batches?.neighborhood;
        setMeta({
          contractor_id: sendRes.data.contractor_id,
          contractor_name: sendRes.data.contractor_name,
          headline: hood ? `${proj} in ${hood}` : proj,
        });
      }
      if (msgRes.data) setMessages(msgRes.data as Message[]);
      setLoading(false);

      // Mark related notifications as read
      await supabase
        .from("homeowner_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("outreach_send_id", outreachSendId)
        .eq("type", "clarification_received");
    })();

    // Realtime: see contractor follow-ups while drawer is open
    const channel = supabase
      .channel(`clar-${outreachSendId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "brief_clarifications", filter: `outreach_send_id=eq.${outreachSendId}` },
        (payload) => setMessages((cur) => [...cur, payload.new as Message]),
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [open, outreachSendId, user]);

  // Scroll to latest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sendReply = async () => {
    const trimmed = reply.trim();
    if (!trimmed || !meta || !user || !outreachSendId) return;
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("brief_clarifications")
        .insert({
          outreach_send_id: outreachSendId,
          contractor_id: meta.contractor_id,
          homeowner_user_id: user.id,
          sender_role: "homeowner",
          message: trimmed.slice(0, 800),
        })
        .select("id, sender_role, message, created_at")
        .single();
      if (error) throw error;

      // Notify the contractor — bell + push (push pipeline picks this up).
      await supabase.from("contractor_notifications").insert({
        contractor_id: meta.contractor_id,
        outreach_send_id: outreachSendId,
        type: "clarification_reply",
        title: "Homeowner replied to your question",
        body: trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed,
      });

      if (data) setMessages((cur) => [...cur, data as Message]);
      setReply("");
      toast({ title: "Reply sent", description: `${meta.contractor_name ?? "The contractor"} will see it right away.` });
    } catch (e) {
      toast({ title: "Couldn't send", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <MessageSquare className="h-4 w-4 text-accent" />
            {meta?.contractor_name ?? "Contractor"}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs">
            <Hammer className="h-3 w-3" /> {meta?.headline ?? "Your project"}
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 px-6 py-5">
          {loading ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_role === "homeowner";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
                      mine ? "bg-foreground text-background" : "border border-border bg-card"
                    }`}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                      {mine ? "You" : meta?.contractor_name ?? "Contractor"} ·{" "}
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border bg-background px-6 py-4">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 800))}
            placeholder="Type your reply…"
            rows={3}
            className="resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{reply.length}/800 · They'll be notified instantly.</span>
            <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
              <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
