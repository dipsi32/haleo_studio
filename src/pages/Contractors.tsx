// Contractor Discovery — surfaces real San Jose contractors who pulled
// permits matching the homeowner's project type, ranked by Trust Score.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, MapPin, Calendar, Hammer, Check,
  ExternalLink, Send, X, Info, Sparkles, AlertCircle, Paperclip,
  CheckCircle2, FileText, Clock, Wallet, Home,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIntake } from "@/lib/intake";
import { useContractors, type RankedContractor } from "@/lib/useContractors";
import { projectTypeLabel, cslbDeepLink, buildBriefSnapshot, getSessionId } from "@/lib/contractors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const ScoreRing = ({ score }: { score: number }) => {
  const pct = Math.max(0, Math.min(100, score));
  const tone = pct >= 80 ? "text-sage" : pct >= 60 ? "text-accent" : "text-muted-foreground";
  return (
    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 border-current ${tone}`}>
      <span className="font-display text-lg font-medium leading-none">{pct}</span>
      <span className="text-[8px] uppercase tracking-wider opacity-70">Trust</span>
    </div>
  );
};

const ContractorCard = ({
  rc, selected, onToggle, projectLabel, neighborhood,
}: {
  rc: RankedContractor;
  selected: boolean;
  onToggle: () => void;
  projectLabel: string;
  neighborhood: string;
}) => {
  const { contractor, permits, license, score, matchCount, recentPermit } = rc;
  const licenseActive = license?.status?.toLowerCase().includes("active") || license?.status?.toLowerCase().includes("current");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative overflow-hidden rounded-3xl border bg-card p-6 shadow-soft transition-smooth ${
        selected ? "border-accent shadow-accent" : "border-border hover:-translate-y-0.5 hover:shadow-lift"
      }`}
    >
      {selected && (
        <div className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground shadow-soft">
          <Check className="h-4 w-4" />
        </div>
      )}
      <div className="flex items-start gap-4">
        <ScoreRing score={score.total} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="font-display text-lg font-medium leading-tight text-foreground">
              {contractor.company ?? contractor.name}
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {contractor.specialty ?? "General"} · {contractor.city ?? "San Jose"}
          </p>
          <div className="mt-3 space-y-1.5 text-sm text-foreground/80">
            <div className="flex items-center gap-1.5">
              <Hammer className="h-3.5 w-3.5 text-accent" />
              <span><strong className="font-medium text-foreground">{matchCount || permits.length}</strong> {projectLabel} permit{(matchCount || permits.length) === 1 ? "" : "s"} in {neighborhood}</span>
            </div>
            {recentPermit && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-accent" />
                <span>Last job: {formatDate(recentPermit.issued_date)}{recentPermit.address ? ` · ${recentPermit.address}` : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <ShieldCheck className={`h-3.5 w-3.5 ${licenseActive ? "text-sage" : "text-muted-foreground"}`} />
              <span>
                {license?.scrape_succeeded
                  ? <>License {license.status ?? "on file"}{license.expiration_date ? ` · expires ${formatDate(license.expiration_date)}` : ""}</>
                  : <>License on file — <a href={cslbDeepLink(contractor.license_number)} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">verify on CSLB <ExternalLink className="inline h-3 w-3" /></a></>}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Link to={`/contractors/${contractor.id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          View profile →
        </Link>
        <Button
          size="sm"
          variant={selected ? "default" : "outline"}
          onClick={onToggle}
          className="rounded-full"
        >
          {selected ? <><Check className="h-3.5 w-3.5" /> Selected</> : "Select"}
        </Button>
      </div>
    </motion.div>
  );
};

const Contractors = () => {
  const { data } = useIntake();
  const navigate = useNavigate();
  const { status, ranked, backfillNote, error } = useContractors(data);
  const projectLabel = projectTypeLabel(data);
  const neighborhood = data.address?.city || "your area";
  const zip = data.address?.zip || "your zip";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const selectedList = useMemo(
    () => ranked.filter(r => selected.has(r.contractor.id)),
    [ranked, selected]
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendBrief = async () => {
    if (selectedList.length === 0) return;
    setSending(true);
    try {
      const sessionId = getSessionId();
      const snapshot = buildBriefSnapshot(data);
      const { data: batch, error: bErr } = await supabase
        .from("outreach_batches")
        .insert({
          session_id: sessionId,
          neighborhood,
          brief_snapshot: snapshot,
          recipient_count: selectedList.length,
        })
        .select("id")
        .single();
      if (bErr || !batch) throw bErr ?? new Error("Failed to create batch");

      const sends = selectedList.map(rc => ({
        batch_id: batch.id,
        contractor_id: rc.contractor.id,
        contractor_name: rc.contractor.company ?? rc.contractor.name,
        contractor_email: rc.contractor.email,
        personal_note: notes[rc.contractor.id] ?? null,
        status: "sent",
        is_simulated: true,
        sent_at: new Date().toISOString(),
      }));
      const { error: sErr } = await supabase.from("outreach_sends").insert(sends);
      if (sErr) throw sErr;

      toast({
        title: "Brief sent 😊",
        description: `Your project brief is queued for ${selectedList.length} contractor${selectedList.length === 1 ? "" : "s"}. We'll let you know when they respond.`,
      });
      setSelected(new Set());
      setNotes({});
      setOutreachOpen(false);
    } catch (e) {
      toast({
        title: "Couldn't send brief",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-32">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link to="/brief/result" className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to brief
          </Link>
        </div>
      </header>

      <main className="container max-w-6xl py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Verified contractors near you</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight md:text-5xl text-balance">
            These contractors have actually done <em className="italic">{projectLabel}</em> work near you.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Verified by real permit data from the City of San Jose — not reviews, not paid listings.
            Every contractor here has pulled permits and completed similar work in {neighborhood}.
          </p>
        </motion.div>

        {/* Differentiator banner */}
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-foreground">Unlike Yelp or Angie's List, every contractor here has a verified permit history.</p>
            <p className="text-xs text-muted-foreground">We show you who has actually done the work — not who paid to be listed.</p>
          </div>
        </div>

        {/* Status / count */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {status === "loading" && <p className="text-sm text-muted-foreground">{backfillNote ?? "Pulling verified contractors near you…"}</p>}
            {status === "ready" && ranked.length > 0 && (
              <p className="text-sm text-foreground/80">
                <strong className="font-display text-2xl font-medium">{ranked.length}</strong>{" "}
                verified contractors with completed {projectLabel} permits in or near {zip}.
              </p>
            )}
            {status === "ready" && ranked.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No matches yet for {zip}. {backfillNote}
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Contractor grid */}
        {ranked.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {ranked.slice(0, 24).map(rc => (
              <ContractorCard
                key={rc.contractor.id}
                rc={rc}
                selected={selected.has(rc.contractor.id)}
                onToggle={() => toggle(rc.contractor.id)}
                projectLabel={projectLabel}
                neighborhood={neighborhood}
              />
            ))}
          </div>
        )}

        {/* Trust score explainer */}
        <div className="mt-12 rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-accent" />
            <div>
              <p className="font-display text-lg font-medium">How we score trust</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The Haleo Trust Score is a 0–100 rating based on verified permit history, license status, and real completed work near you — not reviews or paid listings.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-foreground/80 md:grid-cols-2">
                <li>• Local permit volume — 30 pts</li>
                <li>• Recent activity (last 12 months) — 20 pts</li>
                <li>• License status & history — 25 pts</li>
                <li>• Project type match — 15 pts</li>
                <li>• Job completion rate — 10 pts</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Selection bar */}
      {selected.size > 0 && !outreachOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-lift backdrop-blur"
        >
          <div className="container flex max-w-6xl items-center justify-between gap-4 py-4">
            <div>
              <p className="font-display text-base font-medium">{selected.size} contractor{selected.size === 1 ? "" : "s"} selected</p>
              <p className="text-xs text-muted-foreground">Send your project brief to all of them in one go.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected(new Set())} className="rounded-full">Clear</Button>
              <Button onClick={() => setOutreachOpen(true)} className="rounded-full">
                <Send className="h-4 w-4" /> Send project brief
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Outreach drawer (inline, simple) */}
      {outreachOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 p-4 backdrop-blur"
          onClick={() => !sending && setOutreachOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card p-6 shadow-lift md:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Project brief preview</p>
                <h2 className="mt-2 font-display text-2xl font-light">Sending to {selectedList.length} contractor{selectedList.length === 1 ? "" : "s"}</h2>
              </div>
              <button onClick={() => setOutreachOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background p-5">
              <p className="text-sm text-foreground/80">
                Hi — I found you through Haleo based on your verified permit history in {neighborhood}.
              </p>
              <p className="mt-3 text-sm text-foreground/80">
                I'm planning a <strong>{projectLabel}</strong>{data.scope ? ` (${data.scope === "refresh" ? "design refresh" : data.scope === "remodel" ? "full remodel" : data.scope === "reconfigure" ? "layout reconfiguration" : "addition"})` : ""}{data.timeline === "asap" ? ", ready to start now" : data.timeline === "1-3" ? ", looking to start in 1–3 months" : ""}.
              </p>
              {data.notes && <p className="mt-3 text-sm italic text-foreground/70">"{data.notes}"</p>}
              {data.painPoints.length > 0 && (
                <p className="mt-3 text-sm text-foreground/80">
                  Key things I want solved: {data.painPoints.slice(0, 4).join(", ").toLowerCase()}.
                </p>
              )}
              <p className="mt-3 text-sm text-foreground/80">I'd love to get a quote from you.</p>
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Add a personal note (optional)</p>
              {selectedList.map(rc => (
                <div key={rc.contractor.id} className="rounded-2xl border border-border p-3">
                  <p className="text-sm font-medium">{rc.contractor.company ?? rc.contractor.name}</p>
                  <Textarea
                    placeholder={`Add a personal note for ${rc.contractor.company ?? rc.contractor.name}…`}
                    value={notes[rc.contractor.id] ?? ""}
                    onChange={e => setNotes(n => ({ ...n, [rc.contractor.id]: e.target.value }))}
                    rows={2}
                    className="mt-2 rounded-lg bg-background text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              <span>📨 Real email sending will be enabled once your domain is set up. For now, sends are tracked in your dashboard.</span>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOutreachOpen(false)} disabled={sending} className="rounded-full">Cancel</Button>
              <Button onClick={sendBrief} disabled={sending} className="rounded-full">
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : `Send to ${selectedList.length} contractor${selectedList.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Contractors;
