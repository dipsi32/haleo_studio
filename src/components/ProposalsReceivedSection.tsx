import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Inbox, Loader2, AlertTriangle, ShieldCheck, ArrowRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// Surfaces every proposal a contractor has submitted on behalf of this
// homeowner across all of their outreach batches. Cards show the
// "Advocate is reviewing" state while analysis runs and the risk score
// once it's ready.

type Row = {
  send_id: string;
  contractor_name: string | null;
  proposal_submitted_at: string | null;
  proposal_source: string | null;
  proposal_analysis_id: string | null;
  status: string;
  homeowner_email: string | null;
  brief: any;
  // analysis
  analysis_status: string | null;
  analysis_risk_score: number | null;
  analysis_red_flags: any[] | null;
  analysis_total_cost: number | null;
};

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export default function ProposalsReceivedSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }

    const load = async () => {
      // Find every batch this homeowner started (by email match on outreach_batches),
      // then pull every send under those batches that has a submitted proposal.
      const { data: batches } = await supabase
        .from("outreach_batches")
        .select("id, brief_snapshot, homeowner_email")
        .eq("homeowner_email", user.email);

      const batchIds = (batches ?? []).map((b: any) => b.id);
      if (batchIds.length === 0) { setRows([]); setLoading(false); return; }

      const { data: sends } = await supabase
        .from("outreach_sends")
        .select("id, contractor_name, proposal_submitted_at, proposal_source, proposal_analysis_id, status, batch_id")
        .in("batch_id", batchIds)
        .not("proposal_submitted_at", "is", null)
        .order("proposal_submitted_at", { ascending: false });

      const analysisIds = (sends ?? []).map((s: any) => s.proposal_analysis_id).filter(Boolean) as string[];
      let analysesById: Record<string, any> = {};
      if (analysisIds.length > 0) {
        const { data: analyses } = await supabase
          .from("proposal_analyses")
          .select("id, status, risk_score, red_flags, total_cost")
          .in("id", analysisIds);
        for (const a of analyses ?? []) analysesById[(a as any).id] = a;
      }

      const briefById: Record<string, any> = {};
      for (const b of batches ?? []) briefById[(b as any).id] = (b as any).brief_snapshot;

      const merged: Row[] = (sends ?? []).map((s: any) => {
        const a = s.proposal_analysis_id ? analysesById[s.proposal_analysis_id] : null;
        return {
          send_id: s.id,
          contractor_name: s.contractor_name,
          proposal_submitted_at: s.proposal_submitted_at,
          proposal_source: s.proposal_source,
          proposal_analysis_id: s.proposal_analysis_id,
          status: s.status,
          homeowner_email: user.email!,
          brief: briefById[s.batch_id] ?? null,
          analysis_status: a?.status ?? null,
          analysis_risk_score: a?.risk_score ?? null,
          analysis_red_flags: a?.red_flags ?? null,
          analysis_total_cost: a?.total_cost ?? null,
        };
      });
      setRows(merged);
      setLoading(false);
    };

    load();

    // Realtime: when an analysis completes, refresh.
    const channel = supabase
      .channel("proposal-analyses-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_analyses" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_sends" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.email]);

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-accent" />
        <h2 className="font-display text-xl font-medium">Proposals received</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every contractor submission lands here. Your Advocate reviews each one before you read a single line.
      </p>

      <div className="mt-6 grid gap-3">
        {rows.map((r, i) => {
          const reviewing = r.analysis_status !== "complete";
          const riskScore = r.analysis_risk_score;
          const flagCount = Array.isArray(r.analysis_red_flags) ? r.analysis_red_flags.length : 0;

          // risk band colors (semantic tokens)
          const scoreClass =
            riskScore == null ? "text-muted-foreground"
            : riskScore >= 75 ? "text-success"
            : riskScore >= 55 ? "text-warning"
            : "text-danger";

          return (
            <motion.div
              key={r.send_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent shrink-0" />
                    <p className="truncate font-display text-base font-medium">
                      {r.contractor_name ?? "Contractor"}
                    </p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/60">
                      {r.proposal_source === "haleo_builder" ? "Haleo proposal" : "PDF"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {fmtDate(r.proposal_submitted_at)}
                    {r.analysis_total_cost != null && <> · Total {fmt(r.analysis_total_cost)}</>}
                  </p>

                  {/* Advocate state */}
                  {reviewing ? (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2.5">
                      <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-accent shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-accent-soft-foreground">Your Advocate is reviewing this proposal.</p>
                        <p className="mt-0.5 text-xs text-accent-soft-foreground/80">
                          Checking every line against real permit cost data for your area. Usually under a minute.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5">
                      <div className={`text-3xl font-bold ${scoreClass}`}>{riskScore ?? "—"}</div>
                      <div className="text-sm">
                        <p className="font-medium">
                          Risk score {riskScore}/100
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {flagCount > 0
                            ? `${flagCount} thing${flagCount === 1 ? "" : "s"} to review before signing`
                            : "Looks clean — open to see the full breakdown"}
                        </p>
                      </div>
                      {flagCount > 0 ? (
                        <AlertTriangle className="ml-auto h-4 w-4 text-warning" />
                      ) : (
                        <ShieldCheck className="ml-auto h-4 w-4 text-sage" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  to={r.proposal_analysis_id ? `/proposal/${r.proposal_analysis_id}` : `/proposal`}
                  aria-disabled={reviewing}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    reviewing
                      ? "pointer-events-none bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {reviewing ? "Reviewing…" : "Open proposal and analysis"}
                  {!reviewing && <ArrowRight className="h-3.5 w-3.5" />}
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
