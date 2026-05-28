import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Upload, FileText, BarChart3, Sparkles, Building2, X,
  Shield, Search, CheckCircle, AlertTriangle, AlertCircle, Info, ChevronDown,
  ChevronUp, MapPin, CalendarClock, ClipboardCheck, ExternalLink, ThumbsUp,
  HelpCircle, Lock, Mail, Users, Lightbulb
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import UpgradeCard from '@/components/report/UpgradeCard';
import LockedSection from '@/components/report/LockedSection';
import { TipsContainer } from '@/components/design/ContextualTipDisplay';
import { InAppEmailComposer } from '@/components/report/InAppEmailComposer';
import { ContextualTip as TipType } from '@/types/clearcontract-intake';

// ─── Types ───────────────────────────────────────────────────────────
interface PricingResult {
  marketRange: { low: number; high: number; average: number; median: number };
  sampleSize: number;
  dataSource: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: { name: string; url?: string; weight: number; sampleSize?: number }[];
  sourceCitations?: { name: string; url?: string }[];

  extractedProposal: {
    contractorName: string;
    totalCost: number;
    spaceType: string;
    scope: string;
    zipCode: string;
    squareFootage: number | null;
    lineItems: { item: string; cost: number }[];
    summary: string;
  };
  proposalAnalysis: {
    providedCost: number;
    percentileRank: number;
    verdict: string;
    reasoning: string;
  };
  comparableProjects: {
    address: string;
    zipCode: string;
    cost: number;
    completionDate: string | null;
    daysToComplete: number | null;
    status: string;
    type: string;
    workDescription?: string;
    dwellingType?: string;
    squareFootage?: number | null;
  }[];
  componentRanges: Record<string, { low: number; high: number; average: number }>;
  haleoInsight: string;
}

interface RedFlag {
  severity: "critical" | "warning" | "notice";
  category: string;
  title: string;
  detail: string;
  evidence: string;
  whatToDo: string;
  source: string;
}

interface Insight {
  type: "positive" | "neutral" | "context";
  category: string;
  title: string;
  detail: string;
  source: string;
}

interface HaleoTip {
  id: string;
  trigger: string;
  headline: string;
  body: string;
  derivedFrom: string[];
  placement: string;
}

interface ContractResult {
  success: boolean;
  extracted: any;
  permit_intelligence: {
    permits: any[];
    stats: any;
    narrative: string;
    error: string | null;
  };
  license_verification: any;
  risk_score: {
    overall: number;
    label: string;
    summary: string;
    categories: Array<{
      name: string;
      weight: number;
      score: number;
      explanation: string;
    }>;
  };
  red_flags: RedFlag[];
  insights: Insight[];
  haleo_tips: HaleoTip[];
  questions_to_ask: string[];
  roadmap: Array<{
    stage: string;
    duration: string;
    description: string;
    inspections: number;
    critical?: boolean;
  }>;
  next_actions: Array<{
    priority: string;
    action: string;
    detail: string;
    url?: string;
    deadline: string;
  }>;
}

type Step = 'upload' | 'analyzing' | 'pricing' | 'full-report';

function fmtFull(n: number) {
  return `$${n.toLocaleString()}`;
}
function fmt(n: number) {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

export default function ProposalIntelligencePage() {
  useActivityTracker('proposal_intelligence');
  const navigate = useNavigate();
  const location = useLocation();
  const { reportId } = useParams<{ reportId?: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [contractResult, setContractResult] = useState<ContractResult | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [progressStage, setProgressStage] = useState('reading');
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<"free" | "paid">("free");
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const isLocked = !user && tier === "free";
  const [tipsOptedIn, setTipsOptedIn] = useState(false);
  const [tipsAsked, setTipsAsked] = useState(false);
  const [proposalTips, setProposalTips] = useState<TipType[]>([]);
  const [tipsDismissedToFab, setTipsDismissedToFab] = useState(false);

  // ─── Handoff from Roast ─────────────────────────────────────────
  // If the user came from /roast, we already have the file + pricing analysis.
  // Skip the upload step entirely and drop them at the pricing summary so they
  // can decide whether to unlock the full report.
  useEffect(() => {
    const state = (location.state || {}) as {
      fromRoast?: boolean;
      fileBase64?: string;
      fileName?: string;
      fileType?: string;
      pricingResult?: PricingResult;
    };
    if (!state.fromRoast || !state.pricingResult || !state.fileBase64) return;
    setPricingResult(state.pricingResult);
    setFileBase64(state.fileBase64);
    // Reconstruct a File-like object so re-analysis works.
    try {
      const bytes = Uint8Array.from(atob(state.fileBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: state.fileType || 'application/octet-stream' });
      const f = new File([blob], state.fileName || 'quote.pdf', { type: state.fileType || 'application/pdf' });
      setFile(f);
    } catch (e) {
      console.warn('Roast handoff: could not reconstruct file', e);
    }
    setStep('pricing');
    // Clear state so a refresh doesn't loop the handoff.
    window.history.replaceState({}, document.title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved report if navigating with reportId
  useEffect(() => {
    if (!reportId || !user) return;
    const loadSavedReport = async () => {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('proposal_analyses')
        .select('*')
        .eq('id', reportId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !data) {
        setError('Report not found');
        setIsLoading(false);
        return;
      }

      const row = data as any;
      setSavedAnalysisId(row.id);
      setTier(row.tier as "free" | "paid");

      if (row.pricing_data && Object.keys(row.pricing_data).length > 0) {
        setPricingResult(row.pricing_data as PricingResult);
      }

      if (row.extracted_data && Object.keys(row.extracted_data).length > 0) {
        const contract: ContractResult = {
          success: true,
          extracted: row.extracted_data,
          permit_intelligence: row.permit_data || { permits: [], stats: {}, narrative: '', error: null },
          license_verification: row.license_data || {},
          risk_score: row.risk_breakdown && row.risk_breakdown.overall ? row.risk_breakdown : {
            overall: row.risk_score || 0,
            label: '',
            summary: '',
            categories: [],
          },
          red_flags: row.extracted_data?.red_flags || [],
          insights: row.extracted_data?.insights || [],
          haleo_tips: row.extracted_data?.haleo_tips || row.extracted_data?.quinn_tips || [],
          questions_to_ask: row.extracted_data?.questions_to_ask || [],
          roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
          next_actions: Array.isArray(row.next_actions) ? row.next_actions : [],
        };
        setContractResult(contract);
      }

      setStep(row.tier === 'paid' ? 'full-report' : 'pricing');
      setIsLoading(false);
    };
    loadSavedReport();
  }, [reportId, user]);

  // Save analysis to database
  const saveAnalysis = useCallback(async (pricing: PricingResult, contract?: ContractResult) => {
    try {
      const sessionToken = savedAnalysisId || crypto.randomUUID();
      
      // Upload file to storage if user is logged in
      let filePath: string | null = null;
      if (user && file) {
        const fileExt = file.name.split('.').pop();
        const storagePath = `${user.id}/${sessionToken}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('proposals').upload(storagePath, file);
        if (!uploadError) filePath = storagePath;
      }

      const row = {
        id: sessionToken,
        session_token: sessionToken,
        user_id: user?.id || null,
        contractor_name: pricing.extractedProposal.contractorName,
        total_cost: pricing.extractedProposal.totalCost,
        space_type: pricing.extractedProposal.spaceType,
        verdict: pricing.proposalAnalysis.verdict,
        pricing_data: pricing as any,
        extracted_data: contract ? (contract as any) : {},
        file_path: filePath,
        tier: contract ? 'paid' : 'free',
        risk_score: contract?.risk_score?.overall ?? null,
        risk_breakdown: contract?.risk_score ? (contract.risk_score as any) : {},
        roadmap: contract?.roadmap ? (contract.roadmap as any) : [],
        next_actions: contract?.next_actions ? (contract.next_actions as any) : [],
        permit_data: contract?.permit_intelligence ? (contract.permit_intelligence as any) : {},
        license_data: contract?.license_verification ? (contract.license_verification as any) : {},
      };

      const { error: dbError } = await supabase.from('proposal_analyses').upsert(row as any);
      if (!dbError) setSavedAnalysisId(sessionToken);
    } catch (e) {
      console.error('Save error:', e);
    }
  }, [user, file, savedAnalysisId]);

  const handleFile = useCallback((f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      setError('File must be under 20MB');
      return;
    }
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(f.type)) {
      setError('Please upload a PDF or image of your proposal');
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!file) return;
    setStep('analyzing');
    setIsLoading(true);
    setError(null);

    try {
      // Convert file to base64
      setProgressStage('reading');
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      setFileBase64(base64);

      // Phase 1: Pricing analysis
      setProgressStage('pricing');
      const { data: pricingData, error: pricingError } = await supabase.functions.invoke('analyze-pricing', {
        body: {
          fileBase64: base64,
          fileName: file.name,
          fileType: file.type,
        },
      });

      if (pricingError) throw pricingError;
      if (pricingData?.error) throw new Error(pricingData.error);

      setPricingResult(pricingData);
      setStep('pricing');
      setIsLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Save pricing analysis
      saveAnalysis(pricingData);
    } catch (e: any) {
      console.error('Analysis error:', e);
      setError(e.message || 'Something went wrong. Please try again.');
      setStep('upload');
      setIsLoading(false);
    }
  };

  const handleUnlockFullReport = async () => {
    if (contractResult) {
      setStep('full-report');
      return;
    }

    setStep('analyzing');
    setIsLoading(true);
    setProgressStage('contract');

    try {
      const base64 = fileBase64;
      if (!base64 || !file) throw new Error('Please re-upload your proposal');

      setTimeout(() => setProgressStage('verifying'), 2000);
      setTimeout(() => setProgressStage('permits'), 5000);
      setTimeout(() => setProgressStage('scoring'), 8000);

      const { data, error: fnError } = await supabase.functions.invoke('analyze-proposal', {
        body: { file_base64: base64, file_name: file.name },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');

      setContractResult(data);
      setStep('full-report');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Update saved analysis with full report data
      if (pricingResult) saveAnalysis(pricingResult, data);
    } catch (e: any) {
      console.error('Contract analysis error:', e);
      setError(e.message || 'Something went wrong.');
      setStep('pricing');
    } finally {
      setIsLoading(false);
    }
  };

  const verdictConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    'below-market': { label: "Suspiciously cheap", color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60', dot: 'bg-amber-500' },
    fair: { label: "Priced like a grown-up", color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60', dot: 'bg-emerald-500' },
    'above-market': { label: "Bit of a stretch", color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60', dot: 'bg-amber-500' },
    'significantly-above': { label: "They saw you coming", color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200/60', dot: 'bg-red-500' },
  };


  // Generate contextual tips from red_flags, insights, and haleo_tips
  useEffect(() => {
    if (!contractResult || !tipsOptedIn) return;
    const allTips: TipType[] = [];

    // Red flags as warnings (highest priority)
    (contractResult.red_flags || []).forEach((rf, i) => {
      allTips.push({
        id: `rf-${i}`,
        title: rf.title,
        type: 'warning' as const,
        message: rf.detail,
        phase: 'visualization' as const,
        trigger: rf.category,
      });
    });

    // Positive insights as success
    (contractResult.insights || []).filter(ins => ins.type === 'positive').forEach((ins, i) => {
      allTips.push({
        id: `ins-${i}`,
        title: ins.title,
        type: 'success' as const,
        message: ins.detail,
        phase: 'visualization' as const,
        trigger: ins.category,
      });
    });

    // Haleo tips as info
    (contractResult.haleo_tips || []).forEach((qt, i) => {
      allTips.push({
        id: qt.id || `qt-${i}`,
        title: qt.headline,
        type: 'info' as const,
        message: qt.body,
        phase: 'visualization' as const,
        trigger: qt.derivedFrom?.join(', ') || 'Proposal analysis',
      });
    });

    // Limit to 5 most relevant, prioritizing warnings
    const sorted = allTips.sort((a, b) => {
      const order = { warning: 0, permit: 1, success: 2, info: 3 };
      return (order[a.type] ?? 3) - (order[b.type] ?? 3);
    });
    setProposalTips(sorted.slice(0, 5));
  }, [contractResult, tipsOptedIn]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-20 pb-16 px-4">
        <div className={cn("max-w-2xl mx-auto", tipsOptedIn && proposalTips.length > 0 && "mr-[300px]")}>
          {/* Header */}
          <div className="mb-8 text-center">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">
              {step === 'full-report' ? 'The full roast' : step === 'pricing' ? "Here's the receipts" : 'Roast your contractor quote'}
            </h1>
            <p className="text-muted-foreground">
              {step === 'upload' && "Drop the quote in. We'll check the price first — no signup, no drama, just numbers."}
              {step === 'analyzing' && 'Reading it like a hawk…'}
              {step === 'pricing' && 'Your quote vs. real permits, public cost guides, and prior Haleo proposals. Every number traces back to a source.'}
              {step === 'full-report' && 'Pricing, scope, contract risk, contractor signals, and what to do this week — all in one place.'}
            </p>

          </div>

          <AnimatePresence mode="wait">
            {/* ═══ UPLOAD ═══ */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm text-foreground leading-relaxed">
                      <span className="font-semibold">Haleo:</span> Hand me the quote. I'll check if the price is honest before we dig into the fine print.
                    </p>
                  </div>

                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    'relative border-2 border-dashed rounded-2xl p-6 md:p-10 text-center transition-all cursor-pointer',
                    isDragOver ? 'border-primary bg-primary/5 scale-[1.01]'
                      : file ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  )}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,image/jpeg,image/png,image/webp';
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleFile(f);
                    };
                    input.click();
                  }}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                        <Upload className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Drop the quote here</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF or photo. We'll do the rest.</p>
                      </div>
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <Button onClick={handleAnalyze} disabled={!file} className="w-full gap-2 py-6 text-base" size="lg">
                  <Shield className="w-4 h-4" />
                  Roast the price
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  No signup. Numbers come from real permits, public cost guides, and prior Haleo proposals.
                </p>

              </motion.div>
            )}

            {/* ═══ ANALYZING ═══ */}
            {step === 'analyzing' && (
              <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16">
                <AnalyzingPhase stage={progressStage} />
              </motion.div>
            )}

            {/* ═══ PRICING RESULTS (FREE) ═══ */}
            {step === 'pricing' && pricingResult && (
              <motion.div key="pricing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Compare with other bids — surfaces only when this analysis is saved
                    to the user's account (otherwise we'd lose it on the next upload). */}
                {user && savedAnalysisId && (
                  <Card className="border-accent/30 bg-accent-soft/40 p-4">
                    <div className="flex items-start gap-3">
                      <BarChart3 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">Got more bids? Stack them side-by-side.</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Upload up to 3 proposals and we'll show exactly what makes one stand out — permits, payment terms, scope, risk. No more spreadsheets.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Link
                          to="/proposal/compare"
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                        >
                          Compare bids <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link
                          to="/proposal"
                          onClick={() => { setStep('upload'); setFile(null); setPricingResult(null); setContractResult(null); setSavedAnalysisId(null); }}
                          className="text-center text-[11px] text-accent hover:underline"
                        >
                          + Add another bid
                        </Link>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Section 1: What Haleo Found */}
                <SectionLabel number={1} label="What they actually quoted" />
                {pricingResult.extractedProposal && (
                  <Card className="p-5 border-primary/20 bg-primary/5">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoCell label="Contractor" value={pricingResult.extractedProposal.contractorName || 'Not specified'} />
                      <InfoCell label="Total Quote" value={fmtFull(pricingResult.extractedProposal.totalCost)} />
                      <InfoCell label="Project Type" value={pricingResult.extractedProposal.spaceType} capitalize />
                      <InfoCell label="Scope" value={pricingResult.extractedProposal.scope} capitalize />
                      {pricingResult.extractedProposal.zipCode && <InfoCell label="Location" value={pricingResult.extractedProposal.zipCode} />}
                      {pricingResult.extractedProposal.squareFootage && <InfoCell label="Area" value={`${pricingResult.extractedProposal.squareFootage} sq ft`} />}
                    </div>
                  </Card>
                )}

                {/* Section 2: Is the Price Fair? — the TL;DR */}
                <SectionLabel number={2} label="Is this price honest?" />
                {pricingResult.proposalAnalysis && (
                  <Card className={cn('p-6 border', verdictConfig[pricingResult.proposalAnalysis.verdict]?.bg || 'bg-card')}>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className={cn('w-2.5 h-2.5 rounded-full', verdictConfig[pricingResult.proposalAnalysis.verdict]?.dot || 'bg-muted')} />
                      <h2 className={cn('font-serif text-xl font-semibold', verdictConfig[pricingResult.proposalAnalysis.verdict]?.color || 'text-foreground')}>
                        {verdictConfig[pricingResult.proposalAnalysis.verdict]?.label || 'Analysis complete'}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Your quote</p>
                        <p className="text-xl font-bold text-foreground">{fmtFull(pricingResult.proposalAnalysis.providedCost)}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Local fair range</p>
                        <p className="text-xl font-bold text-foreground">{fmtFull(pricingResult.marketRange.low)}–{fmtFull(pricingResult.marketRange.high)}</p>
                      </div>
                    </div>

                    {/* Range bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{fmtFull(pricingResult.marketRange.low)}</span>
                        <span>avg {fmtFull(pricingResult.marketRange.average)}</span>
                        <span>{fmtFull(pricingResult.marketRange.high)}</span>
                      </div>
                      <div className="relative h-3 bg-background/50 rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-emerald-500/20 rounded-full" style={{ width: '100%' }} />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-primary-foreground shadow-md"
                          style={{
                            left: `${Math.min(100, Math.max(0, ((pricingResult.proposalAnalysis.providedCost - pricingResult.marketRange.low) / Math.max(1, pricingResult.marketRange.high - pricingResult.marketRange.low)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {pricingResult.confidence === 'low' && (
                      <p className="mt-3 text-[11px] text-muted-foreground italic">
                        Heads up: we found limited local data for this exact scope. Treat the range as directional, not definitive.
                      </p>
                    )}
                  </Card>
                )}

                <Card className="p-4 bg-muted/30 border-dashed">
                  <div className="flex items-start gap-2 mb-2">
                    <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      {(() => {
                        const rawSrcs = (pricingResult.sources && pricingResult.sources.length > 0)
                          ? pricingResult.sources
                          : [{ name: pricingResult.dataSource, weight: 1 } as any];
                        // Strip brand names — homeowners don't recognize "HomeAdvisor, Angi, Cost vs. Value".
                        const cleanName = (raw: string) => {
                          const stripped = raw.replace(/\s*\([^)]*\)\s*/g, '').trim();
                          const n = stripped.toLowerCase();
                          if (n.includes('cost guide') || n.includes('homeadvisor') || n.includes('angi') || n.includes('cost vs'))
                            return 'Public cost guides';
                          return stripped || raw;
                        };
                        const detail = (name: string, n?: number) => {
                          if (!n) return null;
                          const lc = name.toLowerCase();
                          if (lc.includes('permit')) return `${n.toLocaleString()} nearby permits`;
                          if (lc.includes('haleo')) return `${n.toLocaleString()} prior Haleo projects`;
                          return `${n.toLocaleString()} similar projects`;
                        };
                        // Dedupe by clean name
                        const seen = new Set<string>();
                        const srcs = rawSrcs.map((s: any) => ({ name: cleanName(s.name), sampleSize: s.sampleSize }))
                          .filter((s) => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });
                        return (
                          <>
                            <div className="text-xs font-semibold text-foreground mb-1.5">
                              Fair range based on {srcs.length} source{srcs.length === 1 ? '' : 's'}:
                            </div>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {srcs.map((s, i) => {
                                const d = detail(s.name, s.sampleSize);
                                return (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="text-foreground/40">•</span>
                                    <span>{d ? <><span className="text-foreground font-medium">{d}</span> from </> : null}{s.name}</span>
                                  </li>
                                );
                              })}
                            </ul>
                            <p className="text-[11px] text-muted-foreground/80 mt-2 italic">
                              An estimate to help you negotiate — not an appraisal.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </Card>



                {/* Section 3: Haleo's Take */}
                <SectionLabel number={3} label="Haleo's hot take" />
                <HaleoInsightCard insight={pricingResult.haleoInsight} />

                {/* Section 4: One Real Comparable */}
                {pricingResult.comparableProjects.length > 0 && (
                  <>
                    <SectionLabel number={4} label="A neighbor who actually built this" />
                    <Card className="p-5">
                      <p className="text-xs text-muted-foreground mb-4">
                        Closest match from City of San José permit records — same scope, similar size, your neighborhood.
                      </p>

                      {(() => {
                        const p = pricingResult.comparableProjects[0];
                        return (
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{p.address}</p>
                                <span className="text-sm font-bold text-foreground whitespace-nowrap">{fmtFull(p.cost)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                {p.workDescription || p.type}
                                {p.squareFootage && p.squareFootage > 0 && (
                                  <span className="ml-1 text-muted-foreground/70">· {p.squareFootage.toLocaleString()} sqft</span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                  p.status === 'completed' || p.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-muted text-muted-foreground'
                                )}>{p.status}</span>
                                {p.daysToComplete && (
                                  <span className="text-[10px] text-muted-foreground">{Math.round(p.daysToComplete / 7)} weeks</span>
                                )}
                                {p.completionDate && (
                                  <span className="text-[10px] text-muted-foreground">{new Date(p.completionDate).getFullYear()}</span>
                                )}
                                {p.dwellingType && (
                                  <span className="text-[10px] text-muted-foreground/60">{p.dwellingType}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </Card>
                  </>
                )}

                {/* ═══ UPGRADE CTA — The Bridge ═══ */}
                <div className="bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] border-2 border-primary/20 rounded-2xl p-6 md:p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-serif text-xl text-foreground mb-2">
                    Pricing is one part of the picture.
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
                    The full audit checks the contractor's license with CSLB, pulls their permit history, scans the contract for missing clauses and risky terms, and lays out a realistic timeline. No new upload required.
                  </p>
                  <Button onClick={handleUnlockFullReport} className="gap-2 px-8 py-6 text-base" size="lg">
                    <Shield className="w-4 h-4" />
                    Run the full audit
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <p className="text-[10px] text-muted-foreground/60 mt-4">
                    License verification · Permit history · Contract risks · Project timeline
                  </p>
                </div>

                {/* Secondary CTAs */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 py-5"
                    size="lg"
                    onClick={() => {
                      // Seed intake with what we already know from the proposal so the
                      // contractors list filters to the right zip + project type.
                      try {
                        const ep = pricingResult.extractedProposal;
                        const raw = localStorage.getItem('haleo:intake:v2');
                        const prev = raw ? JSON.parse(raw) : {};
                        const roomMap: Record<string, string> = {
                          kitchen: 'kitchen', bathroom: 'bathroom', bath: 'bathroom',
                          living: 'living', bedroom: 'bedroom', office: 'office',
                          addition: 'addition', adu: 'addition',
                        };
                        const room = roomMap[(ep.spaceType || '').toLowerCase()] || prev.room;
                        const next = {
                          painPoints: [],
                          media: [],
                          ...prev,
                          ...(room ? { room } : {}),
                          address: {
                            ...(prev.address || {}),
                            ...(ep.zipCode ? { zip: ep.zipCode } : {}),
                          },
                        };
                        localStorage.setItem('haleo:intake:v2', JSON.stringify(next));
                      } catch { /* ignore — contractors page handles empty intake */ }
                      navigate('/contractors');
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Find permit-proven contractors
                  </Button>
                  <Button variant="ghost" onClick={() => { setPricingResult(null); setFile(null); setFileBase64(null); setStep('upload'); }} className="gap-1.5 text-muted-foreground">
                    <Upload className="w-4 h-4" />
                    Check another proposal
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ═══ FULL REPORT ═══ */}
            {step === 'full-report' && contractResult && (
              <>
                {/* Tips opt-in prompt */}
                {!tipsAsked && (contractResult.haleo_tips?.length > 0 || contractResult.red_flags?.length > 0 || contractResult.insights?.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        Want contextual tips as you review?
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Haleo found helpful insights about your proposal — red flags, good signs, and things to watch. 
                        They'll appear in a sidebar on the right — dismiss anytime.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs h-7 gap-1.5" onClick={() => { setTipsOptedIn(true); setTipsAsked(true); }}>
                          <Lightbulb className="w-3 h-3" /> Yes, show tips
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => { setTipsAsked(true); setTipsDismissedToFab(true); }}>
                          Not now
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Floating FAB for dismissed tips */}
                {tipsAsked && !tipsOptedIn && tipsDismissedToFab && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="fixed bottom-6 right-4 z-50"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setTipsOptedIn(true); setTipsDismissedToFab(false); }}
                      className="rounded-full shadow-lg gap-1.5 bg-card border-primary/30 hover:shadow-xl transition-all animate-pulse hover:animate-none"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium">Tips available</span>
                    </Button>
                  </motion.div>
                )}
                <FullReportView
                  pricingResult={pricingResult}
                  contractResult={contractResult}
                  verdictConfig={verdictConfig}
                  isLocked={isLocked}
                  tier={tier}
                  setTier={setTier}
                  savedAnalysisId={savedAnalysisId}
                  user={user}
                  onNewAnalysis={() => {
                    setPricingResult(null);
                    setContractResult(null);
                    setFile(null);
                    setFileBase64(null);
                    setSavedAnalysisId(null);
                    setStep('upload');
                  }}
                />
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Contextual tips sidebar */}
        {tipsOptedIn && proposalTips.length > 0 && (
          <TipsContainer
            tips={proposalTips}
            onDismiss={(id) => setProposalTips(prev => prev.filter(t => t.id !== id))}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────

function SectionLabel({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="font-serif italic text-2xl text-primary leading-none tabular-nums">0{number}.</span>
      <h3 className="font-serif text-lg text-foreground tracking-tight">{label}</h3>
    </div>
  );
}


function InfoCell({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("font-medium text-foreground", capitalize && "capitalize")}>{value}</p>
    </div>
  );
}

function HaleoInsightCard({ insight }: { insight: string }) {
  const sentences = (insight || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  
  const positives: string[] = [];
  const concerns: string[] = [];
  const context: string[] = [];
  
  const positivePatterns = ['below', 'lower than', 'good sign', 'fair', 'reasonable', 'competitive', 'within range', 'solid', 'strong', 'well-priced', 'well priced', 'in line', 'saves', 'saving', 'affordable', 'great price', 'good price', 'nice price'];
  const concernPatterns = ['above market', 'above average', 'higher than', 'overpriced', 'expensive', 'concern', 'risk', 'missing', 'vague', 'unclear', 'no mention', 'front-loaded', 'front loaded', 'red flag', 'careful', 'watch out', 'hidden', 'excessive', 'inflated', 'negotiate down', 'significantly above', 'too high'];
  
  // Patterns to skip entirely — greetings, project-type assertions
  const skipPatterns = ['hello', 'hi ', 'thanks for sharing', 'thank you for', 'gut rebuild', 'gut remodel', 'gut renovation', 'gut-rebuild', 'whole home gut', 'full gut', 'complete gut', 'this is a gut', 'for your gut', 'for your whole home gut'];
  
  sentences.forEach((s: string) => {
    const lower = s.toLowerCase();
    if (skipPatterns.some(p => lower.includes(p) || lower.startsWith(p))) return;
    
    const isPositive = positivePatterns.some(p => lower.includes(p));
    const isConcern = concernPatterns.some(p => lower.includes(p));
    
    // If it matches both or neither, put in context (don't force-categorize)
    if (isPositive && !isConcern) {
      positives.push(s);
    } else if (isConcern && !isPositive) {
      concerns.push(s);
    } else {
      context.push(s);
    }
  });

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Haleo's hot take</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">What jumps out — the good, the sus, and the side notes.</p>
        </div>
      </div>
      <div className="space-y-4 pl-12">
        {positives.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[hsl(var(--success))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> What checks out
            </p>
            <div className="space-y-1.5">
              {positives.map((s, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed pl-5">{s}</p>
              ))}
            </div>
          </div>
        )}
        {concerns.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[hsl(var(--warning))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Where it smells off
            </p>
            <div className="space-y-1.5">
              {concerns.map((s, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed pl-5">{s}</p>
              ))}
            </div>
          </div>
        )}
        {context.length > 0 && (
          <div>
            {(positives.length > 0 || concerns.length > 0) && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Worth knowing
              </p>
            )}

            <div className="space-y-1.5">
              {context.map((s, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed pl-5">{s}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function AnalyzingPhase({ stage }: { stage: string }) {
  const stages = [
    { id: 'reading', label: 'Reading the quote, line by line…', icon: '📄' },
    { id: 'pricing', label: 'Sniffing out the price vs. local comps…', icon: '💰' },
    { id: 'contract', label: 'Combing the contract for weasel words…', icon: '📋' },
    { id: 'verifying', label: 'Checking the license with CSLB…', icon: '🔍' },
    { id: 'permits', label: 'Digging through real permit history…', icon: '🏗️' },
    { id: 'scoring', label: 'Putting the roast together…', icon: '🧠' },
  ];

  const currentIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className="text-center">
      <h2 className="font-serif text-2xl text-foreground mb-2">Roasting your quote</h2>
      <p className="text-sm text-muted-foreground mb-8">No fluff. Just data with attitude.</p>
      <div className="max-w-sm mx-auto space-y-3">
        {stages.map((s, i) => (
          <div key={s.id} className={cn(
            "flex items-center gap-4 p-4 rounded-xl transition-all text-left",
            i < currentIndex ? "bg-[hsl(var(--success-bg))] text-foreground" : "",
            i === currentIndex ? "bg-card shadow-md text-foreground" : "",
            i > currentIndex ? "text-muted-foreground/50" : "",
          )}>
            <span className="text-2xl">{s.icon}</span>
            <span className="font-medium text-sm flex-1">{s.label}</span>
            {i < currentIndex && <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />}
            {i === currentIndex && <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-8">Usually done in 15–30 seconds.</p>
    </div>
  );
}


// ─── Full Report View ───────────────────────────────────────────────

function FullReportView({
  pricingResult, contractResult, verdictConfig, isLocked, tier, setTier, onNewAnalysis, savedAnalysisId, user
}: {
  pricingResult: PricingResult | null;
  contractResult: ContractResult;
  verdictConfig: any;
  isLocked: boolean;
  tier: string;
  setTier: (t: "free" | "paid") => void;
  onNewAnalysis: () => void;
  savedAnalysisId: string | null;
  user: any;
}) {
  const { extracted, risk_score, permit_intelligence, license_verification, roadmap, next_actions, red_flags, insights, haleo_tips, questions_to_ask } = contractResult;
  const tipForSection = (placement: string) => haleo_tips?.find(t => t.placement === placement);
  const [showEmailComposer, setShowEmailComposer] = useState(false);

  return (
    <motion.div key="full-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* ─── Section 1: Pricing Summary (from pricing phase) ─── */}
      {pricingResult?.proposalAnalysis && (
        <>
          <SectionLabel number={1} label="Pricing check" />
          <Card className={cn('p-5 border', verdictConfig[pricingResult.proposalAnalysis.verdict]?.bg || 'bg-card')}>
            <div className="flex items-center gap-3">
              <span className={cn('w-2.5 h-2.5 rounded-full', verdictConfig[pricingResult.proposalAnalysis.verdict]?.dot || 'bg-muted')} />
              <div>
                <h2 className={cn('font-serif text-lg font-semibold', verdictConfig[pricingResult.proposalAnalysis.verdict]?.color || 'text-foreground')}>
                  {verdictConfig[pricingResult.proposalAnalysis.verdict]?.label || 'Analysis complete'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {fmtFull(pricingResult.proposalAnalysis.providedCost)} vs local fair range {fmtFull(pricingResult.marketRange.low)}–{fmtFull(pricingResult.marketRange.high)}
                </p>

              </div>
            </div>
          </Card>
        </>
      )}

      {/* ─── Section 2: Contractor Trust Score ─── */}
      <SectionLabel number={2} label="Contractor Trust Score" />
      <ContractorScoreCard riskScore={risk_score} contractorName={extracted.contractor_name} redFlagCount={red_flags?.length || 0} isLocked={isLocked} />

      {/* ─── Section 3: Proposal Extraction (collapsed) ─── */}
      <SectionLabel number={3} label="What We Extracted" />
      <CollapsibleExtraction extracted={extracted} />

      {/* ─── Section 4: License + Permit Intelligence ─── */}
      <SectionLabel number={4} label="Is This Contractor Trustworthy?" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LicenseCard license={license_verification} />
        <PermitSummaryCard permits={permit_intelligence} contractorName={extracted.contractor_name} />
      </div>

      {/* ─── Section 5: Positive Signals ─── */}
      {insights && insights.filter(i => i.type === 'positive').length > 0 && (
        <>
          <SectionLabel number={5} label="Positive Signals" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.filter(i => i.type === 'positive').map((ins, i) => (
              <div key={i} className="bg-[hsl(var(--success-bg))] border border-[hsl(var(--success))]/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success))] shrink-0" />
                  <h4 className="text-xs font-medium text-foreground">{ins.title}</h4>
                </div>
                <p className="text-[11px] text-muted-foreground ml-5">{ins.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── Section 6: Issues ─── */}
      {red_flags && red_flags.length > 0 && (
        <>
          <SectionLabel number={6} label={`Issues to Address (${red_flags.length})`} />
          <div className="space-y-3">
            {red_flags.map((flag, i) => (
              <RedFlagCard key={i} flag={flag} />
            ))}
          </div>
        </>
      )}

      {/* ─── Section 7: Project Timeline ─── */}
      {roadmap && roadmap.length > 0 && (
        <>
          <SectionLabel number={7} label="Project Timeline" />
          <TimelineCard roadmap={roadmap} scope={extracted.project_scope} paymentSchedule={extracted.payment_schedule} />
        </>
      )}

      {/* ─── Section 8: Action Checklist ─── */}
      {(() => {
        // Augment questions + actions if payment schedule is missing
        const ps = extracted.payment_schedule;
        const noPaymentSchedule = !ps || ps.toLowerCase() === 'not specified' || ps.toLowerCase() === 'n/a';
        const paymentQ = 'Can we agree on a payment schedule tied to completed milestones — for example, 10% deposit, 30% at rough-in, 30% at drywall, and 30% at final walkthrough?';
        const augmentedQuestions = [...(questions_to_ask || [])];
        if (noPaymentSchedule && !augmentedQuestions.some(q => q.toLowerCase().includes('payment schedule'))) {
          augmentedQuestions.unshift(paymentQ);
        }
        const augmentedActions = [...(next_actions || [])];
        if (noPaymentSchedule && !augmentedActions.some(a => a.action?.toLowerCase().includes('payment'))) {
          augmentedActions.unshift({ priority: 'high', action: 'Request a payment schedule', detail: 'No payment schedule was found in this proposal. Ask your contractor to add milestone-based payments before signing.', deadline: 'Before signing' });
        }
        
        return (augmentedQuestions.length > 0 || augmentedActions.length > 0) ? (
          <>
            <SectionLabel number={8} label="Your Pre-Signing Checklist" />
            {augmentedQuestions.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Questions to Ask Your Contractor</h4>
                </div>
                <div className="space-y-2">
                  {augmentedQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border text-sm">
                      <span className="text-xs font-bold text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-foreground text-xs leading-relaxed">{q}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {augmentedActions.length > 0 && (
              <NextActionsCard actions={augmentedActions} />
            )}
          </>
        ) : null;
      })()}

      {/* ─── Section 9: CTAs ─── */}
      <div className="pt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button className="gap-2 py-5" size="lg" onClick={() => setShowEmailComposer(!showEmailComposer)}>
            <Mail className="w-4 h-4" />
            {showEmailComposer ? 'Close Email Draft' : 'Email Contractor'}
          </Button>
          <Link to="/coming-soon?stage=contractors">
            <Button variant="outline" className="w-full gap-2 py-5" size="lg">
              <Search className="w-4 h-4" />
              Find Vetted Contractors
            </Button>
          </Link>
          <Button variant="ghost" onClick={onNewAnalysis} className="gap-2 py-5">
            <Upload className="w-4 h-4" />
            Analyze Another Proposal
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Email your contractor with the questions and clarifications identified above
        </p>

        {/* In-App Email Composer */}
        <AnimatePresence>
          {showEmailComposer && (
            <InAppEmailComposer
              contractorName={extracted.contractor_name || ''}
              questions={questions_to_ask || []}
              paymentSchedule={extracted.payment_schedule}
              onClose={() => setShowEmailComposer(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Report saved confirmation */}
      <div className="mt-4 p-4 bg-[hsl(var(--success-bg))] border border-[hsl(var(--success))]/20 rounded-xl text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
          <p className="text-sm font-medium text-foreground">
            {savedAnalysisId ? 'This report has been saved to your account' : 'Saving your report…'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {user 
            ? <>You can review all your reports anytime from <Link to="/my-reports" className="underline text-primary font-medium">My Reports</Link>.</>
            : <>Sign in to save reports to your account and access them anytime.</>
          }
        </p>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 p-4 bg-secondary rounded-xl text-center">
        <p className="text-xs text-muted-foreground">
          This analysis is based on publicly available data and AI extraction. It is not legal or professional advice.
          Always verify critical details directly with your contractor and relevant authorities.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Sub-components for Full Report ─────────────────────────────────

function ContractorScoreCard({ riskScore, contractorName, redFlagCount, isLocked }: any) {
  const color = riskScore.overall >= 85 ? "hsl(var(--success))" : riskScore.overall >= 65 ? "hsl(var(--warning))" : "hsl(var(--danger))";
  const circumference = 2 * Math.PI * 52;
  const strokeDasharray = `${(riskScore.overall / 100) * circumference} ${circumference}`;

  return (
    <Card className="p-6 text-center">
      <div className="flex items-center justify-center gap-8">
        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8" strokeDasharray={strokeDasharray} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{riskScore.overall}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="text-left">
          <h2 className="font-serif text-xl text-foreground">{contractorName}</h2>
          <p className="text-sm font-semibold mt-1" style={{ color }}>{riskScore.label}</p>
          {redFlagCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))] text-xs font-medium">
              <AlertTriangle className="w-3 h-3" /> {redFlagCount} issue{redFlagCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{riskScore.summary}</p>
    </Card>
  );
}

function CollapsibleExtraction({ extracted }: { extracted: any }) {
  const [open, setOpen] = useState(false);
  const fields = [
    ["Contractor", extracted.contractor_name],
    ["License #", extracted.license_number],
    ["Contract Value", extracted.contract_value],
    ["Payment Schedule", extracted.payment_schedule],
    ["Timeline", extracted.timeline],
    ["Start Date", extracted.start_date],
    ["End Date", extracted.end_date],
    ["Deposit", extracted.deposit_percentage],
    ["Change Orders", extracted.change_order_policy],
    ["Warranty", extracted.warranty_terms],
    ["Scope", extracted.project_scope],
  ].filter(([, v]) => v && v !== "Not specified");

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-5 flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Extracted Proposal Details</p>
            <p className="text-xs text-muted-foreground">{fields.length} fields extracted</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-2">
          {fields.map(([label, value]) => (
            <div key={label} className="flex justify-between items-start text-sm border-b border-border/50 pb-2 last:border-0">
              <span className="text-muted-foreground text-xs shrink-0 mr-3">{label}</span>
              <span className="font-medium text-foreground text-xs text-right max-w-[65%] break-words">
                {String(value).length > 120 ? String(value).substring(0, 120) + "…" : value}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LicenseCard({ license }: { license: any }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">License (CSLB)</h4>
      </div>
      {license.status === "not_checked" ? (
        <div className="bg-[hsl(var(--warning-bg))] rounded-lg p-3 text-xs text-foreground">
          <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-[hsl(var(--warning))]" />
          No license number found in proposal — California law requires it.
        </div>
      ) : license.status === "error" || license.status === "lookup_failed" ? (
        <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 inline mr-1" />
          {license.message || "Couldn't verify automatically."}
        </div>
      ) : (
        <div className="space-y-2">
          {license.license_number && <DetailRow label="License #" value={license.license_number} />}
          {license.business_name && <DetailRow label="Business" value={license.business_name} />}
          {license.status && (
            <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
              <span className="text-muted-foreground text-xs">Status</span>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded",
                license.is_active ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]" : "bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]"
              )}>{license.status}</span>
            </div>
          )}
          {license.expire_date && <DetailRow label="Expires" value={license.expire_date} />}
          {license.workers_comp && <DetailRow label="Workers' Comp" value={license.workers_comp} />}
          {license.complaint_count > 0 && <DetailRow label="Complaints" value={`${license.complaint_count} on file`} />}
        </div>
      )}
      {license.detail_url && (
        <a href={license.detail_url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
          Verify on CSLB <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </Card>
  );
}

function PermitSummaryCard({ permits, contractorName }: { permits: any; contractorName: string }) {
  const [showPermits, setShowPermits] = useState(false);
  const stats = permits.stats;

  const trustLabel = stats?.total_permits > 10 && stats?.finaled_percentage >= 80
    ? { text: 'Strong track record', color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success-bg))]' }
    : stats?.total_permits > 3 && stats?.finaled_percentage >= 60
      ? { text: 'Moderate track record', color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning-bg))]' }
      : stats?.total_permits > 0
        ? { text: 'Limited history', color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning-bg))]' }
        : { text: 'No permit history found', color: 'text-muted-foreground', bg: 'bg-muted' };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Permit History</h4>
      </div>

      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-3", trustLabel.bg, trustLabel.color)}>
        {trustLabel.text}
      </div>

      {stats && stats.total_permits > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-background p-2.5 rounded-lg border border-border text-center">
              <div className="text-lg font-bold text-foreground">{stats.total_permits}</div>
              <div className="text-[10px] text-muted-foreground">Total Permits</div>
            </div>
            <div className="bg-background p-2.5 rounded-lg border border-border text-center">
              <div className={cn("text-lg font-bold",
                stats.finaled_percentage >= 80 ? "text-[hsl(var(--success))]" : stats.finaled_percentage >= 60 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--danger))]"
              )}>{stats.finaled_percentage}%</div>
              <div className="text-[10px] text-muted-foreground">Completed</div>
            </div>
          </div>

          {permits.permits?.length > 0 && (
            <button onClick={() => setShowPermits(!showPermits)} className="text-xs text-primary hover:underline flex items-center gap-1">
              {showPermits ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showPermits ? 'Hide' : 'View'} permits ({permits.permits.length})
            </button>
          )}
          {showPermits && (
            <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
              {permits.permits.map((p: any, i: number) => (
                <div key={i} className="text-xs bg-background p-2.5 rounded-lg border border-border">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-foreground">{p.permit_number}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                      p.status === "Finaled" ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]" : "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]"
                    )}>{p.status}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{p.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-foreground bg-[hsl(var(--warning-bg))] p-3 rounded-lg border border-[hsl(var(--warning))]/20">
          <Info className="w-3.5 h-3.5 inline mr-1 text-[hsl(var(--warning))]" />
          No permits found — they may operate under a different name or in other cities.
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/50 mt-2">Source: data.sanjoseca.gov</p>
    </Card>
  );
}

function RedFlagCard({ flag }: { flag: RedFlag }) {
  const [expanded, setExpanded] = useState(false);
  const colors = {
    critical: { bg: "bg-[hsl(var(--danger-bg))]", border: "border-[hsl(var(--danger))]/20", text: "text-[hsl(var(--danger))]", label: "Critical" },
    warning: { bg: "bg-[hsl(var(--warning-bg))]", border: "border-[hsl(var(--warning))]/20", text: "text-[hsl(var(--warning))]", label: "Warning" },
    notice: { bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", label: "Notice" },
  }[flag.severity] || { bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", label: "Info" };

  const icon = flag.severity === "critical" ? <AlertCircle className="w-4 h-4" /> : flag.severity === "warning" ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />;

  return (
    <div className={cn("rounded-xl border overflow-hidden", colors.bg, colors.border)}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 shrink-0", colors.text)}>{icon}</div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-medium text-sm text-foreground">{flag.title}</h4>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", colors.text)}>{colors.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{flag.category}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3 ml-7">
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Why it matters:</p>
            <p className="text-xs text-muted-foreground">{flag.detail}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Evidence:</p>
            <p className="text-xs text-muted-foreground italic">"{flag.evidence}"</p>
          </div>
          <div className="bg-background rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">💡 What to do:</p>
            <p className="text-xs text-muted-foreground">{flag.whatToDo}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineCard({ roadmap, scope, paymentSchedule }: { roadmap: any[]; scope: string; paymentSchedule?: string }) {
  const hasPaymentInfo = paymentSchedule && paymentSchedule.toLowerCase() !== 'not specified' && paymentSchedule.toLowerCase() !== 'n/a';
  
  // Analyze payment schedule
  const getPaymentVerdict = (schedule: string | undefined) => {
    if (!schedule || schedule.toLowerCase() === 'not specified' || schedule.toLowerCase() === 'n/a') return null;
    const lower = schedule.toLowerCase();
    const frontLoadedPatterns = ['50%', '60%', '70%', '80%', '90%', 'half up front', 'half upon', '50 percent'];
    const isFrontLoaded = frontLoadedPatterns.some(p => lower.includes(p));
    if (isFrontLoaded) {
      return { label: '⚠️ Front-Loaded — This favors the contractor', color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning-bg))]', detail: 'More than 40% before work starts puts you at risk. Typical fair schedules are 10–15% deposit, with payments tied to completed milestones.' };
    }
    return { label: '✅ Balanced — Payments tied to milestones', color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success-bg))]', detail: 'This payment schedule ties payments to completed work, which protects you.' };
  };

  const paymentVerdict = hasPaymentInfo ? getPaymentVerdict(paymentSchedule) : null;

  return (
    <Card className="p-5">
      <p className="text-xs text-muted-foreground mb-4">Based on: {scope ? scope.substring(0, 60) + (scope.length > 60 ? '…' : '') : 'your project type'}</p>
      
      {/* Payment Schedule callout — ALWAYS show */}
      <div className={cn(
        "rounded-xl p-4 mb-5 border",
        hasPaymentInfo
          ? cn(paymentVerdict?.bg, paymentVerdict?.color === 'text-[hsl(var(--warning))]' ? 'border-[hsl(var(--warning))]/20' : 'border-[hsl(var(--success))]/20')
          : 'bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning))]/20'
      )}>
        <h4 className="text-base font-bold text-foreground mb-2">💰 Payment Schedule</h4>
        {hasPaymentInfo ? (
          <>
            <p className="text-sm text-foreground font-medium mb-2 leading-relaxed">{paymentSchedule}</p>
            {paymentVerdict && (
              <>
                <p className={cn("text-sm font-semibold mt-2", paymentVerdict.color)}>{paymentVerdict.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{paymentVerdict.detail}</p>
              </>
            )}
          </>
        ) : (
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--warning))]">⚠️ No payment schedule found in this proposal</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              This is a red flag. A good proposal should clearly state when payments are due and tie them to project milestones. 
              Before signing, ask: "Can we agree on a payment schedule tied to completed work — like 10% deposit, 30% at rough-in, 30% at drywall, and 30% at final walkthrough?"
            </p>
          </div>
        )}
      </div>

      {/* Timeline phases */}
      <h4 className="text-sm font-semibold text-foreground mb-3">📅 Project Phases</h4>
      <div className="relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        <div className="space-y-3">
          {roadmap.map((stage, i) => (
            <div key={stage.stage} className="flex items-start gap-3 relative">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10",
                stage.critical ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-foreground">{stage.stage}</span>
                  <span className="text-[10px] text-muted-foreground">{stage.duration}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stage.description}</p>
                {stage.inspections > 0 && (
                  <span className="text-[10px] text-primary mt-0.5 inline-block">{stage.inspections} inspection{stage.inspections > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function NextActionsCard({ actions }: { actions: any[] }) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...actions].sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2));
  const priorityStyles: Record<string, string> = {
    high: "bg-[hsl(var(--danger-bg))] border-[hsl(var(--danger))]/20",
    medium: "bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning))]/20",
    low: "bg-secondary border-border",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Next Actions</h4>
      </div>
      <div className="space-y-2">
        {sorted.map((action, i) => (
          <div key={i} className={cn("p-3 rounded-lg border text-xs", priorityStyles[action.priority] || priorityStyles.low)}>
            <div className="flex justify-between items-start mb-1">
              <span className="font-medium text-foreground">{action.action}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                action.priority === "high" ? "text-[hsl(var(--danger))]" : action.priority === "medium" ? "text-[hsl(var(--warning))]" : "text-muted-foreground"
              )}>{action.priority}</span>
            </div>
            <p className="text-muted-foreground">{action.detail}</p>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-muted-foreground/70">{action.deadline}</span>
              {action.url && (
                <a href={action.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  Open <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-sm border-b border-border/50 pb-2 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-foreground text-xs text-right max-w-[60%]">{value}</span>
    </div>
  );
}
