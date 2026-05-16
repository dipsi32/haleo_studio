// "Recent jobs at a glance" — a homeowner-friendly inspector's view of the
// contractor's 3 most recent permitted jobs in San José. NOT scored. This is
// the "3-Address Strategy" baked into the profile so the homeowner doesn't
// have to drive to City Hall.
//
// Pulls live from SJ Open Data via the fetch-permit-inspections edge function.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Calendar, ExternalLink, CheckCircle2, Loader2, AlertTriangle, Hourglass, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Permit } from "@/lib/contractors";

type Approval = { code: string; label: string; status: 'complete' | 'in_progress' | 'pending' | 'unknown'; raw: string };
type Lifecycle = 'closed' | 'in_inspection' | 'stalled' | 'expired_open' | 'unknown';

type InspectionResult = {
  folder_number: string;
  found: boolean;
  sj_url: string;
  source?: string;
  address?: string | null;
  work_type?: string | null;
  work_name?: string | null;
  description?: string | null;
  valuation?: number | null;
  issued_date?: string | null;
  final_date?: string | null;
  months_since_issued?: number | null;
  sj_status?: string | null;
  lifecycle?: Lifecycle;
  owner_builder?: boolean;
  applicant?: string | null;
  owner?: string | null;
  approvals?: Approval[];
};

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

const formatMoney = (v?: number | null) => {
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
};

const lifecycleChip = (lc?: Lifecycle, months?: number | null) => {
  switch (lc) {
    case 'closed':
      return { Icon: CheckCircle2, label: 'Closed — final inspection passed', tone: 'bg-sage/15 text-sage border-sage/30' };
    case 'stalled':
      return { Icon: AlertTriangle, label: `Open ${months ?? '?'}+ months — never finalized`, tone: 'bg-destructive/15 text-destructive border-destructive/30' };
    case 'expired_open':
      return { Icon: ShieldAlert, label: 'Expired without final inspection', tone: 'bg-destructive/15 text-destructive border-destructive/30' };
    case 'in_inspection':
      return { Icon: Hourglass, label: 'In inspection now', tone: 'bg-accent/15 text-accent border-accent/30' };
    default:
      return { Icon: Hourglass, label: 'Status unknown', tone: 'bg-muted text-muted-foreground border-border' };
  }
};

const approvalClasses = (s: Approval['status']) => {
  switch (s) {
    case 'complete': return 'bg-sage/15 text-sage border-sage/30';
    case 'in_progress': return 'bg-accent/15 text-accent border-accent/30';
    case 'pending': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export type RecentSiteInspectionsProps = {
  contractorId: string;
  permits: Permit[];
  limit?: number;
};

const RecentSiteInspections = ({ contractorId, permits, limit = 3 }: RecentSiteInspectionsProps) => {
  const [results, setResults] = useState<InspectionResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Most recent N permits that actually have a folder number we can look up.
  const targetFolders = permits
    .filter(p => p.permit_number && p.address)
    .slice(0, limit)
    .map(p => p.permit_number);

  useEffect(() => {
    let cancelled = false;
    if (targetFolders.length === 0) { setLoading(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-permit-inspections', {
          body: { contractor_id: contractorId, permit_numbers: targetFolders, limit },
        });
        if (cancelled) return;
        if (error) throw error;
        setResults(data?.results ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorId, targetFolders.join('|')]);

  if (targetFolders.length === 0) return null;

  return (
    <TooltipProvider>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium">What we found at their last {targetFolders.length} jobs</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The "3-Address Strategy" — for each recent permit, we pull the live inspection record from City of San José.
              Look for stalled permits, owner-builder filings, and how far each trade has gotten through inspection.
            </p>
          </div>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Pulling inspection records from City of San José…
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            Couldn't reach the city's permit data right now: {error}
          </p>
        )}

        {!loading && results && results.length > 0 && (
          <ul className="mt-4 space-y-4">
            {results.map(r => {
              if (!r.found) {
                return (
                  <li key={r.folder_number} className="rounded-2xl border border-border/60 bg-background p-4 text-xs text-muted-foreground">
                    <p className="font-mono">{r.folder_number}</p>
                    <p className="mt-1">No detail returned by SJ Open Data — view directly on the city portal.</p>
                    <a href={r.sj_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline">
                      Open on SJPermits <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                );
              }
              const chip = lifecycleChip(r.lifecycle, r.months_since_issued);
              const Chip = chip.Icon;
              return (
                <li key={r.folder_number} className="rounded-2xl border border-border/60 bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{r.work_name || r.work_type || 'Permit'}</p>
                      {r.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {r.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.address}</span>}
                        {r.issued_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Issued {formatDate(r.issued_date)}</span>}
                        {r.final_date && <span className="inline-flex items-center gap-1 text-sage"><CheckCircle2 className="h-3 w-3" /> Finalized {formatDate(r.final_date)}</span>}
                        {formatMoney(r.valuation) && <span className="rounded-full bg-secondary px-2 py-0.5">{formatMoney(r.valuation)}</span>}
                      </div>
                    </div>
                    <a href={r.sj_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground hover:bg-secondary">
                      City record <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Lifecycle chip */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${chip.tone}`}>
                      <Chip className="h-3 w-3" /> {chip.label}
                    </span>
                    {r.owner_builder && (
                      <Tooltip delayDuration={120}>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
                            <ShieldAlert className="h-3 w-3" /> Owner-Builder permit
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                          The homeowner — not the contractor — pulled this permit as "Owner-Builder."
                          This shifts liability for code compliance and worker injury onto the homeowner.
                          Never let a contractor talk you into doing this for your own job.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Trade-by-trade approval pills */}
                  {r.approvals && r.approvals.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Inspection progress by trade
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.approvals.map((a, i) => (
                          <Tooltip key={i} delayDuration={120}>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${approvalClasses(a.status)}`}>
                                {a.status === 'complete' ? <CheckCircle2 className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                {a.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                              <strong>{a.label}:</strong> {a.raw}
                              {a.status !== 'complete' && (
                                <span className="mt-1 block text-muted-foreground">
                                  This trade still needs sign-off before the permit can be finalized.
                                </span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!loading && results && results.length === 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            No detailed inspection data available for this contractor's recent permits.
          </p>
        )}
      </section>
    </TooltipProvider>
  );
};

export default RecentSiteInspections;
