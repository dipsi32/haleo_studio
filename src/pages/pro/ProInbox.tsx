// Contractor inbox: list of received briefs with locked/unlocked states,
// push prompt, notification bell, and an unlock-then-annotate flow.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, Lock, MapPin, Sparkles, Bell as BellIcon, X, CheckCircle2,
  MessageSquare, Send as SendIcon, Wallet, Clock, Hammer, Heart, AlertCircle, ImageIcon,
  ExternalLink, DollarSign, ImagePlus,
} from "lucide-react";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { getPushPermission, subscribeToPush, deferPushPermission, isPushSupported } from "@/lib/push";

type BriefSnapshot = {
  homeowner_name?: string;
  neighborhood?: string;
  scope_summary?: string;
  vision?: string;
  frustrations?: string[];
  rooms?: string[];
  scope_label?: string;
  timeline?: string;
  budget?: string;
  rendering_urls?: string[];
  trade_groups?: { trade: string; lines: string[] }[];
  projectType?: string;
};

type SendRow = {
  id: string;
  contractor_id: string;
  batch_id: string;
  sent_at: string | null;
  unlocked_at: string | null;
  passed_at: string | null;
  outreach_batches: {
    neighborhood: string | null;
    homeowner_name: string | null;
    homeowner_user_id: string | null;
    brief_snapshot: BriefSnapshot | null;
  } | null;
};

type Annotation = { id: string; section_key: string; content: string };
type Clarification = {
  id: string;
  sender_role: "contractor" | "homeowner";
  message: string;
  created_at: string;
};

const headlineFor = (s: SendRow) => {
  const snap = s.outreach_batches?.brief_snapshot ?? {};
  const proj = snap.projectType || snap.scope_label || "New project";
  const hood = s.outreach_batches?.neighborhood;
  return hood ? `${proj} in ${hood}` : proj;
};

const ProInbox = () => {
  const { account } = useContractorAccount();
  const { toast } = useToast();
  const [sends, setSends] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSendId, setActiveSendId] = useState<string | null>(null);
  const [pushBannerOpen, setPushBannerOpen] = useState(false);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  const contractorId = account?.contractor_id;
  const activeSend = useMemo(() => sends.find((s) => s.id === activeSendId) ?? null, [sends, activeSendId]);

  // Fetch slug for "View public profile" link
  useEffect(() => {
    if (!contractorId) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("contractors").select("slug").eq("id", contractorId).maybeSingle();
      if (active && data?.slug) setProfileSlug(data.slug);
    })();
    return () => { active = false; };
  }, [contractorId]);

  // Load briefs
  useEffect(() => {
    if (!contractorId) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("outreach_sends")
        .select("id, contractor_id, batch_id, sent_at, unlocked_at, passed_at, outreach_batches(neighborhood, homeowner_name, homeowner_user_id, brief_snapshot)")
        .eq("contractor_id", contractorId)
        .order("sent_at", { ascending: false });
      if (active && data) setSends(data as unknown as SendRow[]);
      if (active) setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`inbox-${contractorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outreach_sends", filter: `contractor_id=eq.${contractorId}` },
        () => load()
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [contractorId]);

  // Push banner: prompt once, only if not deferred & not already granted
  useEffect(() => {
    (async () => {
      if (!contractorId) return;
      if (!(await isPushSupported())) return;
      const perm = await getPushPermission();
      if (perm === "granted" || perm === "denied" || perm === "unsupported") return;
      const { data } = await supabase.from("contractors").select("push_permission_deferred").eq("id", contractorId).maybeSingle();
      if (!data?.push_permission_deferred) setPushBannerOpen(true);
    })();
  }, [contractorId]);

  const enablePush = async () => {
    const r = await subscribeToPush();
    if (r.ok) { toast({ title: "Push notifications on ✨", description: "We'll ping you the moment a brief lands." }); setPushBannerOpen(false); }
    else toast({ title: "Couldn't turn on push", description: r.reason ?? "Try again later", variant: "destructive" });
  };
  const dismissPush = async () => {
    if (contractorId) await deferPushPermission(contractorId);
    setPushBannerOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-sm font-medium">{account?.company_name ?? "Workspace"}</span>
          </div>
          <div className="flex items-center gap-2">
            {contractorId && (
              <NotificationBell
                table="contractor_notifications"
                filter={{ column: "contractor_id", value: contractorId }}
                onItemClick={(n) => n.outreach_send_id && setActiveSendId(n.outreach_send_id)}
              />
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/pro/profile">My Studio</Link>
            </Button>
            {profileSlug && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/pro/${profileSlug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Public profile
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {pushBannerOpen && (
        <div className="border-b border-accent/30 bg-accent/5">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-3">
              <BellIcon className="h-4 w-4 text-accent" />
              <p className="text-sm">
                <span className="font-medium">Get briefs the moment they land.</span>{" "}
                <span className="text-muted-foreground">First contractor to reply usually wins.</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={enablePush}>Turn on</Button>
              <Button size="sm" variant="ghost" onClick={dismissPush} aria-label="Dismiss"><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-light">Your inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Projects from homeowners, with the brief already done.</p>
        </div>

        {loading ? (
          <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/40" />)}</div>
        ) : sends.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-4 font-display text-xl">No briefs yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">When a homeowner sends you one, it'll appear here.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-xs font-medium text-accent">
              <Sparkles className="h-3 w-3" /> You'll be notified across every channel
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {sends.map((s) => {
              const headline = headlineFor(s);
              const homeowner = s.outreach_batches?.homeowner_name ?? "A homeowner";
              const isUnlocked = !!s.unlocked_at;
              const isPassed = !!s.passed_at;
              const snap = s.outreach_batches?.brief_snapshot ?? {};
              const preview = snap.scope_summary || snap.vision || (snap.trade_groups?.[0]?.lines?.[0] ?? "");
              const photoCount = snap.rendering_urls?.length ?? 0;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveSendId(s.id)}
                    className="flex w-full items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-accent/40 hover:shadow-soft"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg">{headline}</h3>
                        {isUnlocked && <CheckCircle2 className="h-4 w-4 text-accent" />}
                        {isPassed && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Passed</span>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">From {homeowner}</p>

                      {preview && (
                        <p className={`mt-2 text-sm text-foreground/80 ${isUnlocked ? "line-clamp-2" : "line-clamp-2 italic"}`}>
                          {isUnlocked ? preview : `"${preview}"`}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {s.outreach_batches?.neighborhood && (
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.outreach_batches.neighborhood}</span>
                        )}
                        {snap.budget && (
                          <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" /> {snap.budget}</span>
                        )}
                        {snap.timeline && (
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {snap.timeline}</span>
                        )}
                        {photoCount > 0 && (
                          <span className="inline-flex items-center gap-1"><ImagePlus className="h-3 w-3" /> {photoCount} photo{photoCount === 1 ? "" : "s"}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {!isUnlocked && !isPassed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                          <Lock className="h-3 w-3" /> $99 to unlock
                        </span>
                      )}
                      {s.sent_at && (
                        <p className="mt-2 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(s.sent_at), { addSuffix: true })}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {activeSend && contractorId && (
        <BriefDetailDialog
          send={activeSend}
          contractorId={contractorId}
          onClose={() => setActiveSendId(null)}
        />
      )}
    </div>
  );
};

// =============================================================
// Brief detail with locked / unlocked states + private annotations
// =============================================================
function BriefDetailDialog({ send, contractorId, onClose }: { send: SendRow; contractorId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [unlocking, setUnlocking] = useState(false);
  const [passing, setPassing] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [question, setQuestion] = useState("");
  const [sendingQ, setSendingQ] = useState(false);

  const headline = headlineFor(send);
  const homeowner = send.outreach_batches?.homeowner_name ?? "the homeowner";
  const homeownerUserId = send.outreach_batches?.homeowner_user_id ?? null;
  const snap: BriefSnapshot = send.outreach_batches?.brief_snapshot ?? {};
  const isUnlocked = !!send.unlocked_at;

  // Load annotations + clarifications when unlocked
  useEffect(() => {
    if (!isUnlocked) return;
    let active = true;
    (async () => {
      const [annRes, clarRes] = await Promise.all([
        supabase
          .from("brief_annotations")
          .select("id, section_key, content")
          .eq("contractor_id", contractorId)
          .eq("outreach_send_id", send.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("brief_clarifications")
          .select("id, sender_role, message, created_at")
          .eq("outreach_send_id", send.id)
          .order("created_at", { ascending: true }),
      ]);
      if (!active) return;
      if (annRes.data) setAnnotations(annRes.data as Annotation[]);
      if (clarRes.data) setClarifications(clarRes.data as Clarification[]);
    })();
    return () => { active = false; };
  }, [isUnlocked, contractorId, send.id]);

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      const { error: payErr } = await supabase.from("contractor_payments").insert({
        contractor_id: contractorId,
        outreach_send_id: send.id,
        amount: 9900,
        status: "paid",
        stripe_status: "stubbed",
        paid_at: new Date().toISOString(),
      });
      if (payErr) throw payErr;
      const { error: upErr } = await supabase
        .from("outreach_sends")
        .update({ unlocked_at: new Date().toISOString() })
        .eq("id", send.id);
      if (upErr) throw upErr;
      toast({ title: "Brief unlocked", description: "You've got the full picture now. Make it count." });
    } catch (e) {
      toast({ title: "Couldn't unlock", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setUnlocking(false); }
  };

  const handlePass = async () => {
    setPassing(true);
    try {
      await supabase.from("outreach_sends").update({ passed_at: new Date().toISOString() }).eq("id", send.id);
      toast({ title: "Marked as pass", description: "We'll keep this off your radar." });
      onClose();
    } finally { setPassing(false); }
  };

  const saveNote = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from("brief_annotations")
        .insert({ contractor_id: contractorId, outreach_send_id: send.id, section_key: "general", content: trimmed.slice(0, 500) })
        .select("id, section_key, content")
        .single();
      if (error) throw error;
      if (data) setAnnotations((cur) => [...cur, data as Annotation]);
      setDraft("");
    } catch (e) {
      toast({ title: "Couldn't save note", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setSavingNote(false); }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("brief_annotations").delete().eq("id", id);
    setAnnotations((cur) => cur.filter((a) => a.id !== id));
  };

  const sendQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!homeownerUserId) {
      toast({ title: "Can't reach this homeowner", description: "Older brief — no contact route on file.", variant: "destructive" });
      return;
    }
    setSendingQ(true);
    try {
      const { data, error } = await supabase
        .from("brief_clarifications")
        .insert({
          outreach_send_id: send.id,
          contractor_id: contractorId,
          homeowner_user_id: homeownerUserId,
          sender_role: "contractor",
          message: trimmed.slice(0, 800),
        })
        .select("id, sender_role, message, created_at")
        .single();
      if (error) throw error;

      // Notify the homeowner so they see it in their bell
      await supabase.from("homeowner_notifications").insert({
        user_id: homeownerUserId,
        outreach_send_id: send.id,
        type: "clarification_received",
        title: `Question from a contractor`,
        body: trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed,
      });

      if (data) setClarifications((cur) => [...cur, data as Clarification]);
      setQuestion("");
      toast({ title: "Sent to homeowner", description: "They'll see it in their notifications." });
    } catch (e) {
      toast({ title: "Couldn't send", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setSendingQ(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{headline}</DialogTitle>
          <DialogDescription>From {homeowner}</DialogDescription>
        </DialogHeader>

        {!isUnlocked ? (
          <div className="space-y-6 py-2">
            <div className="rounded-2xl border border-border bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3 w-3" /> Preview
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {homeowner} sent a detailed brief for {headline.toLowerCase()}. Photos, scope, budget signal,
                and timing are all in there. Unlock to see everything.
              </p>
              {snap.scope_summary && (
                <p className="mt-3 line-clamp-2 text-sm italic text-foreground/70">"{snap.scope_summary}"</p>
              )}
            </div>
            <div className="rounded-2xl bg-foreground p-6 text-background">
              <p className="font-display text-2xl">$99 to unlock the full brief</p>
              <p className="mt-1 text-sm opacity-80">One-time. No subscription. No commission.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleUnlock} disabled={unlocking} className="bg-background text-foreground hover:bg-background/90">
                  {unlocking ? "Unlocking…" : "Unlock for $99"}
                </Button>
                <Button onClick={handlePass} disabled={passing} variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
                  Not for me
                </Button>
              </div>
              <p className="mt-3 text-[11px] opacity-60">Payment is stubbed in this build — click to simulate.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Top metadata strip */}
            <div className="grid gap-3 sm:grid-cols-3">
              {snap.scope_label && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><Hammer className="h-3 w-3" /> Scope</div>
                  <p className="mt-1 text-sm font-medium">{snap.scope_label}</p>
                </div>
              )}
              {snap.timeline && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><Clock className="h-3 w-3" /> Timeline</div>
                  <p className="mt-1 text-sm font-medium">{snap.timeline}</p>
                </div>
              )}
              {snap.budget && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><Wallet className="h-3 w-3" /> Budget</div>
                  <p className="mt-1 text-sm font-medium">{snap.budget}</p>
                </div>
              )}
            </div>

            {/* Vision */}
            {(snap.scope_summary || snap.vision) && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Heart className="h-3 w-3" /> What they want
                </div>
                {snap.scope_summary && <p className="mt-3 text-sm leading-relaxed text-foreground/90">{snap.scope_summary}</p>}
                {snap.vision && <p className="mt-2 text-sm italic leading-relaxed text-foreground/70">"{snap.vision}"</p>}
              </section>
            )}

            {/* Frustrations */}
            {snap.frustrations && snap.frustrations.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <AlertCircle className="h-3 w-3" /> What's frustrating them today
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
                  {snap.frustrations.map((f, i) => <li key={i}>• {f}</li>)}
                </ul>
              </section>
            )}

            {/* Trade groups */}
            {snap.trade_groups && snap.trade_groups.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Hammer className="h-3 w-3" /> Scope by trade
                </div>
                <div className="mt-3 space-y-3">
                  {snap.trade_groups.map((g, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold">{g.trade}</p>
                      <ul className="mt-1 space-y-1 text-sm text-foreground/80">
                        {g.lines.map((l, j) => <li key={j}>– {l}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Renderings */}
            {snap.rendering_urls && snap.rendering_urls.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ImageIcon className="h-3 w-3" /> Inspiration & renderings
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {snap.rendering_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-border">
                      <img src={url} alt={`Inspiration ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Private notes */}
            <section className="rounded-2xl border border-border bg-muted/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Your private notes</p>
                <span className="text-[11px] text-muted-foreground">Only you can see these</span>
              </div>
              <ul className="mt-3 space-y-2">
                {annotations.map((a) => (
                  <li key={a.id} className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                    <p className="text-sm">{a.content}</p>
                    <button onClick={() => deleteNote(a.id)} className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-label="Delete note">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  placeholder="e.g. Bid 18-22k. Demo will be tight — old plaster."
                  rows={2}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{draft.length}/500</span>
                  <Button size="sm" onClick={saveNote} disabled={savingNote || !draft.trim()}>
                    {savingNote ? "Saving…" : "Save note"}
                  </Button>
                </div>
              </div>
            </section>

            {/* Clarifications — contractor ↔ homeowner */}
            <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
                <MessageSquare className="h-3 w-3" /> Ask the homeowner
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Questions go straight to {homeowner}'s notification bell. They can reply right back.
              </p>
              {clarifications.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {clarifications.map((c) => (
                    <li
                      key={c.id}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        c.sender_role === "contractor"
                          ? "ml-8 bg-foreground text-background"
                          : "mr-8 border border-border bg-card"
                      }`}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                        {c.sender_role === "contractor" ? "You" : homeowner} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{c.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 space-y-2">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 800))}
                  placeholder="e.g. Are you flexible on the island size? And is the existing electrical panel 200A?"
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{question.length}/800</span>
                  <Button size="sm" onClick={sendQuestion} disabled={sendingQ || !question.trim() || !homeownerUserId}>
                    <SendIcon className="h-3.5 w-3.5" /> {sendingQ ? "Sending…" : "Send to homeowner"}
                  </Button>
                </div>
                {!homeownerUserId && (
                  <p className="text-[11px] text-muted-foreground">This brief was sent before reply-routing was set up.</p>
                )}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProInbox;
