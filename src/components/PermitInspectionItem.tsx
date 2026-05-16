// One permit row in the "Recent permit history" list with an on-demand
// "Check inspection record" button. Pulls live SJ inspection data per address,
// one at a time, so the homeowner can drill into anything that looks off.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Hammer, MapPin, Calendar, ExternalLink, CheckCircle2, Loader2,
  AlertTriangle, Hourglass, ShieldAlert, Search, ChevronDown, ChevronUp,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Permit } from "@/lib/contractors";

type Approval = { code: string; label: string; status: 'complete' | 'in_progress' | 'pending' | 'unknown'; raw: string };
type Lifecycle = 'closed' | 'in_inspection' | 'stalled' | 'expired_open' | 'trades_passed' | 'unknown';

type InspectionResult = {
  folder_number: string;
  found: boolean;
  // Both links are address/folder-specific — see edge fn fetch-permit-inspections.
  open_data_url?: string;     // Stable deep-link into SJ open-data record
  accela_search_url?: string; // Google search scoped to Accela for final status
  address?: string | null;
  work_name?: string | null;
  valuation?: number | null;
  issued_date?: string | null;
  final_date?: string | null;
  months_since_issued?: number | null;
  lifecycle?: Lifecycle;
  owner_builder?: boolean;
  approvals?: Approval[];
};

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// Important data caveat: SJ Open Data's Active / Under-Inspection / Expired
// feeds DO NOT contain finalized permits — once a permit is finaled it drops
// out of all three feeds. That means FINALDATE is effectively always null in
// what we can see, so we can never positively assert "finaled" from this
// data. We CAN say: "the city still lists this as open" or "open and stalled
// past N months" or "trade inspections all signed off — confirm final on city
// record." We must never imply a permit isn't finaled when the truth is just
// "open data doesn't say."
const lifecycleChip = (lc?: Lifecycle, months?: number | null) => {
  switch (lc) {
    case 'closed':
      return {
        Icon: CheckCircle2,
        label: 'Final inspection passed',
        explanation: 'The city signed off on this job. No outstanding inspections.',
        tone: 'bg-sage/15 text-sage border-sage/30',
      };
    case 'stalled':
      return {
        Icon: AlertTriangle,
        label: `Open ${months ?? '?'}+ months on city's open list`,
        explanation: 'This permit has been on the city\'s active/under-inspection list for well over a year. That usually means it was either abandoned without a final, OR it was finaled but the city\'s open-data feed hasn\'t caught up.',
        tone: 'bg-accent/15 text-accent border-accent/30',
      };
    case 'expired_open':
      return {
        Icon: ShieldAlert,
        label: 'Expired without final inspection',
        explanation: 'The permit expired and the city never finalized the work. This can create resale/insurance problems for the homeowner.',
        tone: 'bg-destructive/15 text-destructive border-destructive/30',
      };
    case 'in_inspection':
      return {
        Icon: Hourglass,
        label: 'Listed as open on city\'s active permits',
        explanation: 'The city\'s open-data feed still lists this as an active/under-inspection permit. Either inspections are genuinely still in progress, or the permit was finaled but hasn\'t cleared the open list yet.',
        tone: 'bg-accent/15 text-accent border-accent/30',
      };
    case 'trades_passed':
      return {
        Icon: CheckCircle2,
        label: 'All trade inspections passed',
        explanation: 'Every trade inspection (building, electrical, plumbing, mechanical) on file with the city is marked Complete. The open-data feed doesn\'t publish the final sign-off date, so we can\'t confirm the permit is fully closed — only that every individual trade has passed.',
        tone: 'bg-sage/15 text-sage border-sage/30',
      };
    default:
      return {
        Icon: Hourglass,
        label: 'Status unknown',
        explanation: 'The city portal didn\'t return a clear status for this permit.',
        tone: 'bg-muted text-muted-foreground border-border',
      };
  }
};

const approvalClasses = (s: Approval['status']) => {
  switch (s) {
    case 'complete': return 'bg-sage/15 text-sage border-sage/30';
    case 'in_progress': return 'bg-accent/15 text-accent border-accent/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export const PermitInspectionItem = ({ permit, contractorId }: { permit: Permit; contractorId: string }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);

  const canCheck = !!permit.permit_number;

  const handleCheck = async () => {
    // Toggle behavior: if we already have data, just collapse/expand.
    if (result || error) {
      setOpen(o => !o);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('fetch-permit-inspections', {
        body: { contractor_id: contractorId, permit_numbers: [permit.permit_number], limit: 1 },
      });
      if (fnErr) throw fnErr;
      const r = (data?.results ?? [])[0] as InspectionResult | undefined;
      setResult(r ?? { folder_number: permit.permit_number, found: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Promote "all trades passed but no final yet" to its own friendlier state —
  // SJ marks the permit as still under inspection until the contractor calls
  // in the final, so the raw lifecycle would otherwise read "Active."
  const allTradesPassed =
    !!result?.approvals?.length && result.approvals.every(a => a.status === 'complete');
  const effectiveLifecycle: Lifecycle | 'trades_passed' =
    result?.found && result.lifecycle === 'in_inspection' && allTradesPassed && !result.final_date
      ? 'trades_passed'
      : (result?.lifecycle ?? 'unknown');
  const chip = result?.found ? lifecycleChip(effectiveLifecycle, result.months_since_issued) : null;
  const Chip = chip?.Icon;


  return (
    <li className="rounded-2xl border border-border/60 bg-background p-3">
      <div className="flex items-start gap-3">
        <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{permit.work_type ?? "Permit"}</p>
          {permit.description && <p className="mt-0.5 text-xs text-muted-foreground">{permit.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {permit.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {permit.address}</span>}
            {permit.issued_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(permit.issued_date)}</span>}
            {permit.status && <span className="rounded-full bg-secondary px-2 py-0.5">{permit.status}</span>}
            {permit.permit_number && <span className="font-mono opacity-70">#{permit.permit_number}</span>}
          </div>

          {canCheck && (
            <button
              type="button"
              onClick={handleCheck}
              disabled={loading}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Checking City of San José…</>
              ) : result || error ? (
                open
                  ? <><ChevronUp className="h-3 w-3" /> Hide inspection record</>
                  : <><ChevronDown className="h-3 w-3" /> Show inspection record</>
              ) : (
                <><Search className="h-3 w-3" /> Check inspection record</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Inspection detail panel */}
      {open && !loading && (error || result) && (
        <div className="mt-3 rounded-xl border border-border/60 bg-card p-3">
          {error && (
            <p className="text-xs text-destructive">Couldn't reach SJ Open Data: {error}</p>
          )}
          {result && !result.found && (
            <div className="text-xs text-muted-foreground">
              <p>The City of San José open-data feeds (Active / Under Inspection / Expired) don't currently list this permit. Most often that means it was finaled and dropped off the open list — confirm on the city portal:</p>
              {result.accela_search_url && (
                <a href={result.accela_search_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground hover:bg-secondary">
                  Search permit #{result.folder_number} on city portal <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          {result && result.found && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {chip && Chip && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${chip.tone}`}>
                    <Chip className="h-3 w-3" /> {chip.label}
                  </span>
                )}
                {result.owner_builder && (
                  <Tooltip delayDuration={120}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
                        <ShieldAlert className="h-3 w-3" /> Owner-Builder permit
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      The homeowner — not the contractor — pulled this permit as "Owner-Builder,"
                      shifting liability for code compliance and worker injury onto the homeowner.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Plain-English explanation of the lifecycle chip */}
              {chip?.explanation && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{chip.explanation}</p>
              )}

              {/* Trade-by-trade approvals OR a clear "not published" message */}
              <div className="mt-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Inspection progress by trade
                </p>
                {result.approvals && result.approvals.length > 0 ? (
                  <>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {result.approvals.map((a, i) => (
                        <Tooltip key={i} delayDuration={120}>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${approvalClasses(a.status)}`}>
                              {a.status === 'complete' ? <CheckCircle2 className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                              {a.label} · {a.status === 'complete' ? 'Passed' : a.status === 'in_progress' ? 'In progress' : a.status === 'pending' ? 'Not started' : a.raw}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            <strong>{a.label} inspection:</strong> {a.raw}
                            {a.status !== 'complete' && (
                              <span className="mt-1 block text-muted-foreground">
                                Still needs sign-off before the permit can be finalized.
                              </span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    {/* The "all trades passed, no final" case is now surfaced by the
                        'trades_passed' lifecycle chip + its explanation above. */}
                  </>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    The city hasn't published a per-trade breakdown for this permit.
                  </p>
                )}
              </div>

              {/* Two clearly-labeled, address-specific links so the homeowner
                  can verify everything themselves. Open Data = the exact row
                  we just read. Accela search = the human-friendly portal that
                  shows real final-inspection status. */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {result.open_data_url && (
                  <a
                    href={result.open_data_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary"
                  >
                    View this permit on SJ Open Data <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {result.accela_search_url && (
                  <a
                    href={result.accela_search_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary"
                  >
                    Check final-inspection status on city portal <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
};

export default PermitInspectionItem;
