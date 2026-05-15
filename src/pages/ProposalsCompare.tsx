import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sparkles, ShieldCheck, AlertTriangle, AlertCircle, Check, X,
  ChevronDown, ChevronLeft, ChevronRight, Send, Info, Loader2, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import {
  type AnalyzedProposal, type ScoredProposal, type Verdict, type StandoutChip,
  scoreProposal, computeVerdict, draftPushback, extractRequestedTrades,
  classifyTradeCoverage, computeStandouts,
} from "@/lib/proposalComparison";

// Multi-bid comparison view. The whole point of this screen: in 10 seconds the
// homeowner knows which proposal is the strongest. Verdict bar leads. Table
// supports it. Drilldown explains it. Pushback pad activates it.

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

const scoreClass = (s: number) =>
  s >= 85 ? { text: "text-sage", bg: "bg-sage-soft", border: "border-sage/30", label: "Clean" }
  : s >= 70 ? { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30", label: "Review carefully" }
  : s >= 55 ? { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30", label: "Significant concerns" }
  : { text: "text-danger", bg: "bg-danger/10", border: "border-danger/30", label: "Do not sign as written" };

export default function ProposalsCompare() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<AnalyzedProposal[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [briefSnapshot, setBriefSnapshot] = useState<any>(null);
  const [activeMobileIdx, setActiveMobileIdx] = useState(0);
  const [expandedDrilldown, setExpandedDrilldown] = useState<string | null>(null);
  const [pushbackDrafts, setPushbackDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [previousWinner, setPreviousWinner] = useState<string | null>(null);
  const [recommendationChanged, setRecommendationChanged] = useState(false);

  // Load every analyzed proposal across this homeowner's batches.
  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      const { data: batches } = await supabase
        .from("outreach_batches")
        .select("id, brief_snapshot")
        .eq("homeowner_email", user.email);

      const batchIds = (batches ?? []).map((b: any) => b.id);
      // Use the most recent batch's brief as the requested trade list (if any).
      if (!cancelled && batches && batches.length > 0) {
        setBriefSnapshot((batches[batches.length - 1] as any).brief_snapshot);
      }

      // ── Contractor-submitted proposals via outreach ─────────────────
      let sendsArr: any[] = [];
      if (batchIds.length > 0) {
        const { data: sends } = await supabase
          .from("outreach_sends")
          .select("id, contractor_id, contractor_name, proposal_analysis_id, status, proposal_source, proposal_structured, proposal_submitted_at")
          .in("batch_id", batchIds)
          .not("proposal_submitted_at", "is", null)
          .order("proposal_submitted_at", { ascending: false });
        sendsArr = sends ?? [];
      }

      const sendAnalysisIds = sendsArr.map((s: any) => s.proposal_analysis_id).filter(Boolean) as string[];

      let analysesById: Record<string, any> = {};
      if (sendAnalysisIds.length > 0) {
        const { data: analyses } = await supabase
          .from("proposal_analyses")
          .select("id, status, risk_score, red_flags, extracted_data, permit_data, license_data, next_actions, analysis_jsonb, total_cost")
          .in("id", sendAnalysisIds);
        for (const a of analyses ?? []) analysesById[(a as any).id] = a;
      }

      // ── Homeowner-uploaded PDFs (no outreach_send) ──────────────────
      let uploadedRows: any[] = [];
      if (user?.id) {
        const { data: uploaded } = await supabase
          .from("proposal_analyses")
          .select("id, status, risk_score, red_flags, extracted_data, permit_data, license_data, next_actions, analysis_jsonb, total_cost, contractor_name, created_at")
          .eq("user_id", user.id)
          .is("outreach_send_id", null)
          .order("created_at", { ascending: false })
          .limit(5);
        uploadedRows = uploaded ?? [];
      }

      let pending = 0;
      const merged: AnalyzedProposal[] = [];

      for (const s of sendsArr) {
        const a = s.proposal_analysis_id ? analysesById[s.proposal_analysis_id] : null;
        const isComplete = a && a.status === "complete";
        if (!isComplete) { pending++; continue; }
        merged.push({
          send_id: s.id,
          contractor_id: s.contractor_id,
          contractor_name: s.contractor_name ?? "Unknown contractor",
          proposal_analysis_id: s.proposal_analysis_id!,
          status: s.status,
          proposal_source: s.proposal_source,
          proposal_structured: s.proposal_structured,
          source_kind: "haleo",
          analysis_status: a.status,
          risk_score: a.risk_score,
          red_flags: Array.isArray(a.red_flags) ? a.red_flags : [],
          extracted_data: a.extracted_data ?? {},
          permit_data: a.permit_data ?? {},
          license_data: a.license_data ?? {},
          next_actions: Array.isArray(a.next_actions) ? a.next_actions : [],
          analysis_jsonb: a.analysis_jsonb ?? {},
          total_cost: a.total_cost,
        });
      }

      for (const a of uploadedRows) {
        const isComplete = a.status === "complete";
        if (!isComplete) { pending++; continue; }
        const name =
          a.contractor_name
          ?? a.extracted_data?.contractorName
          ?? a.extracted_data?.contractor_name
          ?? "Uploaded proposal";
        merged.push({
          send_id: `upload:${a.id}`,
          contractor_id: null,
          contractor_name: name,
          proposal_analysis_id: a.id,
          status: "uploaded",
          proposal_source: "upload",
          proposal_structured: null,
          source_kind: "uploaded",
          analysis_status: a.status,
          risk_score: a.risk_score,
          red_flags: Array.isArray(a.red_flags) ? a.red_flags : [],
          extracted_data: a.extracted_data ?? {},
          permit_data: a.permit_data ?? {},
          license_data: a.license_data ?? {},
          next_actions: Array.isArray(a.next_actions) ? a.next_actions : [],
          analysis_jsonb: a.analysis_jsonb ?? {},
          total_cost: a.total_cost,
        });
      }

      if (!cancelled) {
        setProposals(merged.slice(0, 3)); // max 3 columns per spec
        setPendingCount(pending);
        setLoading(false);
      }
    };

    load();

    // Realtime: a new analysis completing should refresh the table.
    const channel = supabase
      .channel("compare-proposals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_analyses" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_sends" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.email]);

  const requestedTrades = useMemo(() => extractRequestedTrades(briefSnapshot), [briefSnapshot]);

  const scored = useMemo(
    () => proposals.map((p) => scoreProposal(p, requestedTrades)),
    [proposals, requestedTrades],
  );

  const verdict = useMemo<Verdict | null>(
    () => (scored.length >= 2 ? computeVerdict(scored) : null),
    [scored],
  );

  const standoutsBySend = useMemo(() => computeStandouts(scored), [scored]);

  const sourceMix = useMemo(() => {
    const haleo = scored.filter((s) => s.proposal.source_kind === "haleo").length;
    const uploaded = scored.filter((s) => s.proposal.source_kind === "uploaded").length;
    return { haleo, uploaded, mixed: haleo > 0 && uploaded > 0 };
  }, [scored]);

  // Detect when the recommended winner changes (realtime update moment).
  useEffect(() => {
    if (verdict?.kind !== "winner") return;
    if (previousWinner && previousWinner !== verdict.winnerSendId) {
      setRecommendationChanged(true);
      const t = setTimeout(() => setRecommendationChanged(false), 6000);
      return () => clearTimeout(t);
    }
    if (!previousWinner) setPreviousWinner(verdict.winnerSendId);
    else setPreviousWinner(verdict.winnerSendId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict?.kind === "winner" ? (verdict as any).winnerSendId : null]);

  // Auto-draft pushback once per proposal (preserves the homeowner's edits).
  useEffect(() => {
    setPushbackDrafts((prev) => {
      const next = { ...prev };
      for (const s of scored) {
        if (!(s.proposal.send_id in next)) {
          next[s.proposal.send_id] = draftPushback(s);
        }
      }
      return next;
    });
  }, [scored]);

  const sendPushback = async (s: ScoredProposal) => {
    if (!user) return;
    const message = pushbackDrafts[s.proposal.send_id]?.trim();
    if (!message) {
      toast.error("Add a message before sending.");
      return;
    }
    setSending((prev) => ({ ...prev, [s.proposal.send_id]: true }));
    try {
      const { error: insErr } = await supabase.from("brief_clarifications").insert({
        outreach_send_id: s.proposal.send_id,
        contractor_id: s.proposal.contractor_id,
        homeowner_user_id: user.id,
        sender_role: "homeowner",
        message,
      });
      if (insErr) throw insErr;

      // Mark the send as 'negotiating' so the contractor sees the state change.
      await supabase
        .from("outreach_sends")
        .update({ status: "negotiating" })
        .eq("id", s.proposal.send_id);

      // Notify the contractor.
      if (s.proposal.contractor_id) {
        await supabase.from("contractor_notifications").insert({
          contractor_id: s.proposal.contractor_id,
          outreach_send_id: s.proposal.send_id,
          type: "homeowner_pushback",
          title: "The homeowner sent feedback on your proposal",
          body: message.slice(0, 140),
        });
      }
      toast.success(`Sent to ${s.proposal.contractor_name}.`, {
        description: "We'll let you know the moment they reply.",
      });
    } catch (e: any) {
      toast.error("Couldn't send", { description: e.message ?? "Try again." });
    } finally {
      setSending((prev) => ({ ...prev, [s.proposal.send_id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link to="/account" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-secondary">
            <ArrowLeft className="h-3 w-3" /> Back to your account
          </Link>
        </div>
      </header>

      <main className="container max-w-6xl py-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Side by side</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight md:text-5xl">
          Your proposals, compared honestly.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Not the cheapest. Not the most expensive. The one with the strongest track record, the cleanest terms, and the fewest things to fix before you sign.
        </p>

        {/* ─── EMPTY / WAITING STATES ─── */}
        {scored.length === 0 && pendingCount === 0 && (
          <EmptyState />
        )}

        {scored.length === 1 && (
          <SingleProposalState scored={scored[0]} />
        )}

        {scored.length === 0 && pendingCount > 0 && (
          <PendingFirstAnalysisState count={pendingCount} />
        )}

        {/* ─── LAYER 1 — VERDICT BAR ─── */}
        {verdict && scored.length >= 2 && (
          <VerdictBar verdict={verdict} scored={scored} changed={recommendationChanged} />
        )}

        {/* Honest disclosure when sources are mixed — protects against
            apples-to-oranges wins driven by data availability. */}
        {scored.length >= 2 && sourceMix.mixed && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Heads up: permit history and license checks are richer for the {sourceMix.haleo} proposal{sourceMix.haleo === 1 ? "" : "s"} submitted through Haleo. The {sourceMix.uploaded} bid{sourceMix.uploaded === 1 ? "" : "s"} you uploaded {sourceMix.uploaded === 1 ? "has" : "have"} scope and pricing data only — keep that in mind when reading the verdict.
            </p>
          </div>
        )}

        {/* Pending banner if a third (or more) proposal is still analyzing */}
        {scored.length >= 2 && pendingCount > 0 && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-accent shrink-0" />
            <p className="text-accent-soft-foreground">
              {pendingCount === 1 ? "One more proposal is being analyzed" : `${pendingCount} more proposals are being analyzed`} — they'll appear here automatically.
            </p>
          </div>
        )}

        {/* ─── LAYER 2 — COMPARISON TABLE ─── */}
        {scored.length >= 2 && (
          <>
            {/* Desktop / tablet table */}
            <div className="mt-8 hidden md:block">
              <ComparisonTable scored={scored} requestedTrades={requestedTrades} verdict={verdict} standoutsBySend={standoutsBySend} />
            </div>
            {/* Mobile single-column with swipe */}
            <div className="mt-8 md:hidden">
              <MobileProposalCard
                scored={scored[activeMobileIdx]}
                requestedTrades={requestedTrades}
                idx={activeMobileIdx}
                total={scored.length}
                onPrev={() => setActiveMobileIdx((i) => Math.max(0, i - 1))}
                onNext={() => setActiveMobileIdx((i) => Math.min(scored.length - 1, i + 1))}
                isWinner={verdict?.kind === "winner" && (verdict as any).winnerSendId === scored[activeMobileIdx].proposal.send_id}
                standouts={standoutsBySend[scored[activeMobileIdx].proposal.send_id] ?? []}
              />
            </div>
          </>
        )}

        {/* ─── LAYER 3 — DRILL DOWN ─── */}
        {scored.length >= 2 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-medium">The full analysis, per proposal</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Expand any proposal to see every flag in detail, or open the full analysis page.
            </p>
            <div className="mt-4 grid gap-3">
              {scored.map((s) => (
                <DrilldownCard
                  key={s.proposal.send_id}
                  scored={s}
                  expanded={expandedDrilldown === s.proposal.send_id}
                  onToggle={() => setExpandedDrilldown(
                    expandedDrilldown === s.proposal.send_id ? null : s.proposal.send_id,
                  )}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── NEGOTIATION LAUNCH PAD ─── */}
        {scored.length >= 2 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-light">Ready to push back?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We've drafted what to say. Edit before sending — your changes save automatically.
            </p>
            <div className="mt-5 grid gap-4">
              {scored.map((s) => (
                <PushbackCard
                  key={s.proposal.send_id}
                  scored={s}
                  draft={pushbackDrafts[s.proposal.send_id] ?? ""}
                  onChange={(v) => setPushbackDrafts((p) => ({ ...p, [s.proposal.send_id]: v }))}
                  onSend={() => sendPushback(s)}
                  sending={!!sending[s.proposal.send_id]}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ─── Verdict Bar ─────────────────────────────────────────────────────

function VerdictBar({ verdict, scored, changed }: { verdict: Verdict; scored: ScoredProposal[]; changed: boolean }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const toneClass =
    verdict.kind === "winner" ? "border-sage/40 bg-sage-soft"
    : verdict.kind === "all_flagged" ? "border-warning/40 bg-warning/10"
    : "border-accent/30 bg-accent-soft";
  const Icon = verdict.kind === "winner" ? ShieldCheck : verdict.kind === "all_flagged" ? AlertTriangle : Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`mt-8 rounded-3xl border ${toneClass} p-6 md:p-8 shadow-soft`}
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-background/60">
          <Icon className="h-6 w-6 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">Haleo's read</p>
          <h2 className="mt-2 font-display text-2xl font-light leading-snug md:text-3xl">{verdict.headline}</h2>
          {verdict.explanation && (
            <p className="mt-2 text-sm text-foreground/80 md:text-base">{verdict.explanation}</p>
          )}
          {changed && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-xs text-foreground/70"
            >
              <Sparkles className="h-3 w-3" /> We updated our recommendation based on the latest proposal.
            </motion.p>
          )}
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground"
          >
            {showBreakdown ? "Hide" : "Why we recommended this"}
            <ChevronDown className={`h-3 w-3 transition-transform ${showBreakdown ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showBreakdown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 overflow-hidden"
          >
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="grid grid-cols-[1fr_repeat(var(--cols),minmax(0,1fr))] gap-3 text-xs"
                style={{ ["--cols" as any]: scored.length }}>
                <div className="font-medium text-muted-foreground">Dimension</div>
                {scored.map((s) => (
                  <div key={s.proposal.send_id} className="font-medium text-foreground truncate">
                    {s.proposal.contractor_name}
                  </div>
                ))}
                {scored[0].dimensions.map((_, di) => (
                  <RowFromDim key={di} di={di} scored={scored} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RowFromDim({ di, scored }: { di: number; scored: ScoredProposal[] }) {
  const label = scored[0].dimensions[di].label;
  const weight = scored[0].dimensions[di].weight;
  return (
    <>
      <div className="border-t border-border/40 pt-2 text-muted-foreground">
        {label} <span className="text-foreground/40">· {Math.round(weight * 100)}%</span>
      </div>
      {scored.map((s) => {
        const dim = s.dimensions[di];
        return (
          <div key={s.proposal.send_id} className="border-t border-border/40 pt-2">
            <span className={`tabular-nums font-medium ${scoreClass(dim.score).text}`}>{Math.round(dim.score)}</span>
            <span className="ml-1 text-foreground/50">/100</span>
          </div>
        );
      })}
    </>
  );
}

// ─── Comparison Table (desktop) ──────────────────────────────────────

function ComparisonTable({
  scored, requestedTrades, verdict, standoutsBySend,
}: { scored: ScoredProposal[]; requestedTrades: string[]; verdict: Verdict | null; standoutsBySend: Record<string, StandoutChip[]> }) {
  const winnerId = verdict?.kind === "winner" ? (verdict as any).winnerSendId : null;
  const cols = scored.length;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      {/* Column headers */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `220px repeat(${cols}, minmax(0,1fr))` }}>
        <div className="bg-secondary/40 p-5" />
        {scored.map((s) => {
          const sc = scoreClass(s.haleoScore);
          const isWinner = s.proposal.send_id === winnerId;
          const chips = standoutsBySend[s.proposal.send_id] ?? [];
          return (
            <div key={s.proposal.send_id} className={`p-5 ${isWinner ? "bg-sage-soft/40" : ""} border-l border-border`}>
              <div className="mb-2 flex items-center gap-1.5">
                {isWinner && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sage-foreground">
                    <ShieldCheck className="h-3 w-3" /> Recommended
                  </span>
                )}
                <SourceBadge kind={s.proposal.source_kind} />
              </div>
              <p className="font-display text-base font-medium leading-tight">{s.proposal.contractor_name}</p>
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${sc.bg} ${sc.border} border px-3 py-1`}>
                <span className={`text-sm font-semibold tabular-nums ${sc.text}`}>{s.haleoScore}</span>
                <span className={`text-[11px] ${sc.text}`}>· {sc.label}</span>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {s.permitCount != null && s.permitCount > 0
                  ? `${s.permitCount} job${s.permitCount === 1 ? "" : "s"} on file in your area`
                  : "No San Jose permits on file under this name"}
              </p>
              <p className="mt-3 font-display text-2xl font-light tabular-nums">{fmtMoney(s.proposal.total_cost)}</p>

              {/* Standout strip — what makes this proposal stand out vs the others */}
              <StandoutStrip chips={chips} />
            </div>
          );
        })}
      </div>

      {/* Row groups */}
      <RowGroup title="The numbers">
        <Row label="Total contract value" cols={cols}>
          {scored.map((s) => <Cell key={s.proposal.send_id}>{fmtMoney(s.proposal.total_cost)}</Cell>)}
        </Row>
        <Row label="Deposit required" cols={cols}>
          {scored.map((s) => {
            const flag = s.depositPct != null && s.depositPct > 10;
            return (
              <Cell key={s.proposal.send_id}>
                {s.depositPct == null ? "—" : `${Math.round(s.depositPct)}%`}
                {flag && <span title="California law caps deposits at 10% or $1,000, whichever is less"> ⚠️</span>}
              </Cell>
            );
          })}
        </Row>
        <Row label="Payment milestones" cols={cols}>
          {scored.map((s) => <Cell key={s.proposal.send_id}>{s.milestoneCount || "—"}</Cell>)}
        </Row>
        <Row label="Estimated timeline" cols={cols}>
          {scored.map((s) => <Cell key={s.proposal.send_id}>{s.proposal.extracted_data?.timeline ?? "—"}</Cell>)}
        </Row>
        <Row label="Start date" cols={cols}>
          {scored.map((s) => <Cell key={s.proposal.send_id}>{s.proposal.extracted_data?.start_date ?? "—"}</Cell>)}
        </Row>
      </RowGroup>

      {requestedTrades.length > 0 && (
        <RowGroup title="Scope coverage">
          {requestedTrades.map((trade) => (
            <Row key={trade} label={trade} cols={cols}>
              {scored.map((s) => {
                const c = classifyTradeCoverage(trade, s.proposal);
                return (
                  <Cell key={s.proposal.send_id}>
                    {c === "covered"
                      ? <span className="inline-flex items-center gap-1 text-sage"><Check className="h-3.5 w-3.5" /> Included</span>
                      : c === "vague"
                      ? <span className="inline-flex items-center gap-1 text-warning">~ Vague</span>
                      : <span className="inline-flex items-center gap-1 text-danger"><X className="h-3.5 w-3.5" /> Missing</span>}
                  </Cell>
                );
              })}
            </Row>
          ))}
        </RowGroup>
      )}

      <RowGroup title="Risk signals">
        <Row label="Critical red flags" cols={cols}>
          {scored.map((s) => (
            <Cell key={s.proposal.send_id}>
              <Pill tone={s.criticalFlagCount === 0 ? "sage" : "danger"}>{s.criticalFlagCount}</Pill>
            </Cell>
          ))}
        </Row>
        <Row label="Warnings" cols={cols}>
          {scored.map((s) => (
            <Cell key={s.proposal.send_id}>
              <Pill tone={s.warningFlagCount === 0 ? "sage" : "warning"}>{s.warningFlagCount}</Pill>
            </Cell>
          ))}
        </Row>
        <Row label="Permit completion rate" cols={cols}>
          {scored.map((s) => <Cell key={s.proposal.send_id}>{s.finaledPct == null ? "—" : `${Math.round(s.finaledPct)}%`}</Cell>)}
        </Row>
        <Row label="License status" cols={cols}>
          {scored.map((s) => {
            const status = s.proposal.license_data?.status ?? s.proposal.license_data?.license_status;
            const verified = s.proposal.license_data?.verified;
            return (
              <Cell key={s.proposal.send_id}>
                <Pill tone={verified || /active/i.test(String(status)) ? "sage" : "neutral"}>
                  {status ?? (verified ? "Verified" : "Unverified")}
                </Pill>
              </Cell>
            );
          })}
        </Row>
        <Row label="Workers' comp" cols={cols}>
          {scored.map((s) => {
            const wc = s.proposal.license_data?.workers_comp_status ?? s.proposal.license_data?.workers_comp;
            return <Cell key={s.proposal.send_id}><Pill tone={wc ? "sage" : "neutral"}>{wc ?? "—"}</Pill></Cell>;
          })}
        </Row>
        <Row label="Bond status" cols={cols}>
          {scored.map((s) => {
            const b = s.proposal.license_data?.bond_status ?? s.proposal.license_data?.bond;
            return <Cell key={s.proposal.send_id}><Pill tone={b ? "sage" : "neutral"}>{b ?? "—"}</Pill></Cell>;
          })}
        </Row>
        <Row label="Disciplinary record" cols={cols}>
          {scored.map((s) => {
            const d = s.proposal.license_data?.has_disciplinary_action;
            return <Cell key={s.proposal.send_id}>{d ? <Pill tone="danger">Action on file</Pill> : <span className="text-muted-foreground">None</span>}</Cell>;
          })}
        </Row>
      </RowGroup>

      <RowGroup title="Protections">
        <ProtectionRow cols={cols} label="Permits included" tip="If permits aren't included, you may be on the hook to pull them yourself."
          values={scored.map((s) => !!s.proposal.extracted_data?.permits_mentioned)} />
        <ProtectionRow cols={cols} label="Workmanship warranty"
          tip="Without a written warranty, you have no formal recourse if something fails after final payment."
          values={scored.map((s) => {
            const w = String(s.proposal.extracted_data?.warranty_terms ?? "");
            return !!w && !/not specified|none|n\/a/i.test(w);
          })} />
        <ProtectionRow cols={cols} label="End date specified"
          tip="No end date means no accountability for when your project finishes. Ask for a specific completion date in writing before signing."
          values={scored.map((s) => {
            const d = String(s.proposal.extracted_data?.end_date ?? "");
            return !!d && !/not specified/i.test(d);
          })} />
        <ProtectionRow cols={cols} label="Change order policy"
          tip="Without a written change order policy, costs can balloon mid-project with no clear approval process."
          values={scored.map((s) => {
            const c = String(s.proposal.extracted_data?.change_order_policy ?? "");
            return !!c && !/not specified/i.test(c);
          })} />
        <ProtectionRow cols={cols} label="Dispute resolution"
          tip="A defined dispute process (mediation/arbitration) saves thousands if things go sideways."
          values={scored.map((s) => {
            const d = String(s.proposal.extracted_data?.dispute_resolution ?? "");
            return !!d && !/not specified/i.test(d);
          })} />
      </RowGroup>

      <RowGroup title="Bottom line">
        <Row label="Haleo composite score" cols={cols}>
          {scored.map((s) => {
            const sc = scoreClass(s.haleoScore);
            return <Cell key={s.proposal.send_id}><span className={`text-base font-semibold tabular-nums ${sc.text}`}>{s.haleoScore}<span className="text-xs text-muted-foreground">/100</span></span></Cell>;
          })}
        </Row>
        <Row label="Recommended action" cols={cols}>
          {scored.map((s) => {
            const tone = s.recommendedAction === "strongest" ? "sage"
              : s.recommendedAction === "do_not_sign" ? "danger"
              : s.recommendedAction === "significant_concerns" ? "warning"
              : "neutral";
            return <Cell key={s.proposal.send_id}><Pill tone={tone as any}>{s.recommendedActionLabel}</Pill></Cell>;
          })}
        </Row>
      </RowGroup>
    </div>
  );
}

function RowGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="bg-secondary/40 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, cols, children }: { label: string; cols: number; children: React.ReactNode }) {
  return (
    <div className="grid items-center border-t border-border/60 first:border-t-0" style={{ gridTemplateColumns: `220px repeat(${cols}, minmax(0,1fr))` }}>
      <div className="bg-secondary/20 p-3 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="border-l border-border/60 p-3 text-sm">{children}</div>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "sage" | "warning" | "danger" | "neutral" }) {
  const cls =
    tone === "sage" ? "bg-sage-soft text-sage"
    : tone === "warning" ? "bg-warning/15 text-warning"
    : tone === "danger" ? "bg-danger/15 text-danger"
    : "bg-secondary text-foreground/70";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function ProtectionRow({ cols, label, tip, values }: { cols: number; label: string; tip: string; values: boolean[] }) {
  return (
    <Row label={label} cols={cols}>
      {values.map((v, i) => (
        <Cell key={i}>
          {v
            ? <Check className="h-4 w-4 text-sage" />
            : <span className="inline-flex items-center gap-1 text-danger" title={tip}><X className="h-4 w-4" /><Info className="h-3 w-3 opacity-60" /></span>}
        </Cell>
      ))}
    </Row>
  );
}

// ─── Mobile single-column view ───────────────────────────────────────

function MobileProposalCard({
  scored, requestedTrades, idx, total, onPrev, onNext, isWinner,
}: {
  scored: ScoredProposal; requestedTrades: string[]; idx: number; total: number;
  onPrev: () => void; onNext: () => void; isWinner: boolean;
}) {
  const sc = scoreClass(scored.haleoScore);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button onClick={onPrev} disabled={idx === 0} className="inline-flex items-center gap-1 disabled:opacity-30">
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <span>{idx + 1} of {total}</span>
        <button onClick={onNext} disabled={idx === total - 1} className="inline-flex items-center gap-1 disabled:opacity-30">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`mt-3 rounded-3xl border bg-card p-5 shadow-soft ${isWinner ? "border-sage/40" : "border-border"}`}>
        {isWinner && (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sage-foreground">
            <ShieldCheck className="h-3 w-3" /> Recommended
          </p>
        )}
        <p className="font-display text-lg font-medium">{scored.proposal.contractor_name}</p>
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${sc.bg} ${sc.border} border px-3 py-1`}>
          <span className={`text-sm font-semibold tabular-nums ${sc.text}`}>{scored.haleoScore}</span>
          <span className={`text-[11px] ${sc.text}`}>· {sc.label}</span>
        </div>
        <p className="mt-3 font-display text-3xl font-light tabular-nums">{fmtMoney(scored.proposal.total_cost)}</p>

        {/* Trade coverage first on mobile, per spec */}
        {requestedTrades.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">Scope coverage</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {requestedTrades.map((t) => {
                const c = classifyTradeCoverage(t, scored.proposal);
                return (
                  <li key={t} className="flex items-center justify-between">
                    <span>{t}</span>
                    {c === "covered" ? <Check className="h-4 w-4 text-sage" />
                      : c === "vague" ? <span className="text-xs text-warning">~ Vague</span>
                      : <X className="h-4 w-4 text-danger" />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical flags</p><p className="mt-1"><Pill tone={scored.criticalFlagCount === 0 ? "sage" : "danger"}>{scored.criticalFlagCount}</Pill></p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Warnings</p><p className="mt-1"><Pill tone={scored.warningFlagCount === 0 ? "sage" : "warning"}>{scored.warningFlagCount}</Pill></p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Permit rate</p><p className="mt-1">{scored.finaledPct == null ? "—" : `${Math.round(scored.finaledPct)}%`}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deposit</p><p className="mt-1">{scored.depositPct == null ? "—" : `${Math.round(scored.depositPct)}%`}</p></div>
        </div>

        <p className="mt-5 rounded-xl bg-secondary/40 p-3 text-sm">{scored.recommendedActionLabel}</p>
      </div>
    </div>
  );
}

// ─── Drilldown ───────────────────────────────────────────────────────

function DrilldownCard({ scored, expanded, onToggle }: { scored: ScoredProposal; expanded: boolean; onToggle: () => void }) {
  const sc = scoreClass(scored.haleoScore);
  const flags = Array.isArray(scored.proposal.red_flags) ? scored.proposal.red_flags : [];
  const questions: string[] =
    scored.proposal.analysis_jsonb?.questions_to_ask ??
    scored.proposal.analysis_jsonb?.questionsToAsk ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-secondary/30">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-medium truncate">{scored.proposal.contractor_name}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={`tabular-nums font-medium ${sc.text}`}>{scored.haleoScore}/100</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{flags.length} flag{flags.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Full analysis</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-4 p-5">
              {flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No red flags raised. Your Advocate found nothing critical to address.</p>
              ) : (
                flags.slice(0, 6).map((f: any, i: number) => {
                  const sev = f.severity ?? "notice";
                  const Icon = sev === "critical" ? AlertCircle : sev === "warning" ? AlertTriangle : Info;
                  const tone = sev === "critical" ? "text-danger" : sev === "warning" ? "text-warning" : "text-foreground/60";
                  return (
                    <div key={i} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 ${tone} mt-0.5 shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{f.title ?? f.category ?? "Issue"}</p>
                          {f.detail && <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>}
                          {f.whatToDo && (
                            <p className="mt-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-xs text-accent-soft-foreground">
                              <span className="font-medium">What to do: </span>{f.whatToDo}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {questions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">Questions worth asking</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {questions.slice(0, 4).map((q, i) => <li key={i} className="text-foreground/80">• {q}</li>)}
                  </ul>
                </div>
              )}

              <Link
                to={`/proposal/${scored.proposal.proposal_analysis_id}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                Open the full analysis <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pushback Card ───────────────────────────────────────────────────

function PushbackCard({
  scored, draft, onChange, onSend, sending,
}: {
  scored: ScoredProposal; draft: string; onChange: (v: string) => void; onSend: () => void; sending: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-medium">{scored.proposal.contractor_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{scored.recommendedActionLabel}</p>
        </div>
        <Pill tone={scored.criticalFlagCount > 0 ? "danger" : scored.warningFlagCount > 0 ? "warning" : "sage"}>
          {scored.criticalFlagCount + scored.warningFlagCount} item{scored.criticalFlagCount + scored.warningFlagCount === 1 ? "" : "s"} to address
        </Pill>
      </div>
      <Textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(12, Math.max(6, draft.split("\n").length + 1))}
        className="mt-4 font-mono text-sm leading-relaxed"
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={onSend} disabled={sending || !draft.trim()} className="rounded-full">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send to {scored.proposal.contractor_name?.split(" ")[0] ?? "contractor"}
        </Button>
      </div>
    </div>
  );
}

// ─── Empty / waiting states ──────────────────────────────────────────

function EmptyState() {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-accent" />
      <p className="mt-3 font-display text-lg">No proposals yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll let you know the moment a contractor submits one. Your Advocate will analyze it automatically when it arrives.
      </p>
    </div>
  );
}

function PendingFirstAnalysisState({ count }: { count: number }) {
  return (
    <div className="mt-8 rounded-3xl border border-accent/20 bg-accent-soft p-10 text-center">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
      <p className="mt-3 font-display text-lg">Your Advocate is reading {count === 1 ? "the proposal" : `${count} proposals`}.</p>
      <p className="mt-1 text-sm text-accent-soft-foreground/80">
        Cross-checking every line against permit records, license status, and what neighbors paid. Comparison opens automatically once two are ready.
      </p>
    </div>
  );
}

function SingleProposalState({ scored }: { scored: ScoredProposal }) {
  return (
    <>
      <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <p className="font-display text-lg font-medium">{scored.proposal.contractor_name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{scored.recommendedActionLabel}</p>
        <Link to={`/proposal/${scored.proposal.proposal_analysis_id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          Open this analysis <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Waiting on more proposals? Once a second one arrives we'll compare them side by side automatically.
      </p>
    </>
  );
}
