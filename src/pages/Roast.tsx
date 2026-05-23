import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Share2, Twitter, Facebook, Link2, ArrowLeft, RotateCcw,
  ArrowRight, CheckCircle2, Database, FileText, MapPin, BarChart3, Download,
} from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";


interface RoastResult {
  score: number;
  tier: { label: string; color: string };
  roast: {
    headline: string;
    oneLiner: string;
    lineRoasts: { item: string; cost: number; burn: string; verdict: "fair" | "high" | "low" | "wtf" }[];
    shareCaption: string;
    advice: string;
  };
  summary: {
    contractor: string;
    spaceType: string;
    scope: string;
    total: number;
    marketLow: number;
    marketHigh: number;
    marketAverage: number;
    ratio: number;
    percentileRank: number;
    zipCode: string;
  };
  lineItems: { item: string; cost: number }[];
  sources?: { name: string; weight: number; sampleSize?: number }[];
  comparableProjects?: { address: string; zipCode: string; cost: number; type: string; workDescription?: string }[];
  pricing?: any; // full pricing payload for the audit handoff
  confidence?: "high" | "medium" | "low";
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

const tierGradient = (color: string) =>
  ({
    emerald: "from-emerald-500 via-emerald-400 to-teal-300",
    lime: "from-lime-500 via-emerald-400 to-yellow-300",
    amber: "from-amber-400 via-yellow-400 to-orange-300",
    orange: "from-orange-500 via-amber-400 to-yellow-300",
    red: "from-red-600 via-rose-500 to-orange-400",
  } as Record<string, string>)[color] || "from-amber-400 to-orange-400";

const verdictBadge = (v: string) =>
  ({
    fair: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Fair" },
    low: { bg: "bg-teal-100", text: "text-teal-700", label: "Below market" },
    high: { bg: "bg-amber-100", text: "text-amber-700", label: "High" },
    wtf: { bg: "bg-red-100", text: "text-red-700", label: "Way over" },
  } as Record<string, { bg: string; text: string; label: string }>)[v] || { bg: "bg-muted", text: "text-foreground", label: "—" };

const sourceIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("permit")) return MapPin;
  if (n.includes("haleo")) return Database;
  return FileText;
};

// Strip brand names ("HomeAdvisor, Angi, Cost vs. Value") from source labels —
// homeowners don't recognize them and they read as noise.
const cleanSourceName = (name: string): string => {
  const stripped = name.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const n = stripped.toLowerCase();
  if (n.includes("cost guide") || n.includes("homeadvisor") || n.includes("angi") || n.includes("cost vs"))
    return "Public cost guides";
  return stripped || name;
};

// Plain-English count phrase for each source.
const sourceDetail = (cleanName: string, sampleSize?: number): string | null => {
  if (!sampleSize) return null;
  const n = cleanName.toLowerCase();
  if (n.includes("permit")) return `${sampleSize.toLocaleString()} nearby permits`;
  if (n.includes("haleo")) return `${sampleSize.toLocaleString()} prior Haleo projects`;
  return `${sampleSize.toLocaleString()} similar projects`;
};

export default function Roast() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"upload" | "loading" | "result">("upload");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBase64Cache, setFileBase64Cache] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = [
    "Reading the quote.",
    "Pulling local cost guides.",
    "Checking permit comps in your zip.",
    "Lining it up against prior Haleo proposals.",
    "Doing the Math",
  ];

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Too big", description: "Keep it under 20 MB.", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
    setStage("loading");
    const phaseInterval = setInterval(() => {
      setLoadingPhase((p) => (p + 1) % loadingMessages.length);
    }, 2200);

    try {
      const fileBase64 = await fileToBase64(file);
      setFileBase64Cache(fileBase64);
      const { data, error } = await supabase.functions.invoke("roast-proposal", {
        body: { fileBase64, fileName: file.name, fileType: file.type },
      });
      if (error || !data || data.error) throw new Error(data?.error || error?.message || "Roast failed");
      clearInterval(phaseInterval);
      setResult(data);
      setStage("result");
    } catch (e: any) {
      clearInterval(phaseInterval);
      toast({ title: "Couldn't read it", description: e.message || "Try a clearer screenshot.", variant: "destructive" });
      setStage("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/roast` : "";

  const share = (where: "twitter" | "facebook" | "copy" | "native") => {
    if (!result) return;
    const text = result.roast.shareCaption + " — checked on Haleo:";
    if (where === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
    } else if (where === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`, "_blank");
    } else if (where === "copy") {
      navigator.clipboard.writeText(`${text} ${shareUrl}`);
      toast({ title: "Copied", description: "Link is on your clipboard." });
    } else if (where === "native" && navigator.share) {
      navigator.share({ title: "Haleo quote check", text, url: shareUrl }).catch(() => {});
    }
  };

  const shareCardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const downloadShareCard = async () => {
    if (!shareCardRef.current || !result) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `haleo-score-${result.score}.png`;
      a.click();
      toast({ title: "Downloaded", description: "Your scorecard is saved." });
    } catch (e) {
      toast({ title: "Couldn't generate image", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };




  const goToFullAudit = () => {
    if (!result || !uploadedFile || !fileBase64Cache) {
      navigate("/proposal");
      return;
    }
    navigate("/proposal", {
      state: {
        fromRoast: true,
        fileName: uploadedFile.name,
        fileType: uploadedFile.type,
        fileBase64: fileBase64Cache,
        pricingResult: result.pricing,
        roastSummary: { score: result.score, tier: result.tier },
      },
    });
  };

  const reset = () => {
    setResult(null);
    setUploadedFile(null);
    setFileBase64Cache(null);
    setStage("upload");
    setLoadingPhase(0);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between">
        <Link to="/" className="text-sm text-foreground/70 hover:text-foreground flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Haleo
        </Link>
        <div className="text-xs text-foreground/50">Free. No signup. Real local data.</div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <AnimatePresence mode="wait">
          {stage === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-10">
                <h1 className="text-5xl sm:text-6xl font-serif tracking-tight text-foreground mb-3 leading-[1.05]">
                  Got a quote? <span className="italic">Get it roasted.</span>
                </h1>
                <p className="text-lg text-foreground/70 max-w-xl mx-auto">
                  Drop it in. Haleo checks every line against local cost guides, permit comps, and prior Haleo proposals, then tells you straight where you stand. No drama, just the numbers.
                </p>
              </div>

              <Card
                className="border-2 border-dashed border-orange-300/60 bg-white/70 backdrop-blur p-10 sm:p-14 text-center hover:border-orange-400 transition cursor-pointer rounded-3xl"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center mb-5 shadow-lg shadow-orange-200">
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-1">Drop your quote here</p>
                <p className="text-sm text-foreground/60">Screenshot, photo, or PDF. Up to 20 MB.</p>
                <Button className="mt-6 bg-foreground hover:bg-foreground/90 text-background rounded-full px-6">
                  Choose a file
                </Button>
                <p className="text-[11px] text-foreground/50 mt-5 max-w-sm mx-auto">
                  Black out the contractor name if you want. We don't keep it. We do save anonymized prices so the next check gets sharper.
                </p>
              </Card>

              {/* How it works — plain English */}
              <div className="grid sm:grid-cols-3 gap-4 mt-10 text-sm">
                {[
                  { n: "1", t: "Upload the quote", d: "Photo or PDF, any format." },
                  { n: "2", t: "Haleo does the math", d: "Cost guides, local permits, our corpus." },
                  { n: "3", t: "See where you stand", d: "Fair range, line-by-line, what to do next." },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">{s.n}</div>
                    <div>
                      <p className="font-semibold text-foreground">{s.t}</p>
                      <p className="text-foreground/60 text-xs">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {stage === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-24">
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mb-6 shadow-xl shadow-orange-200"
              >
                <BarChart3 className="w-9 h-9 text-white" />
              </motion.div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingPhase}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-lg font-serif text-foreground"
                >
                  {loadingMessages[loadingPhase]}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs text-foreground/50 mt-2">This takes about 30 seconds.</p>
            </motion.div>
          )}

          {stage === "result" && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Score card */}
              <Card className={`relative overflow-hidden rounded-3xl border-0 shadow-2xl p-8 sm:p-10 text-white bg-gradient-to-br ${tierGradient(result.tier.color)}`}>
                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-widest opacity-90 mb-2">Haleo quote score</p>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-7xl sm:text-8xl font-serif font-bold leading-none">{result.score}</span>
                    <span className="text-xl opacity-90">/ 100</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-serif mb-3">{result.tier.label}</p>
                  <p className="text-base sm:text-lg leading-snug max-w-xl opacity-95">{result.roast.headline}</p>
                  <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-medium">
                    haleo.studio/roast
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              </Card>

              {/* Evidence trio + number line */}
              <Card className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Your quote</p>
                    <p className="text-lg font-semibold text-foreground">{fmt(result.summary.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Local fair range</p>
                    <p className="text-lg font-semibold text-foreground">{fmt(result.summary.marketLow)}–{fmt(result.summary.marketHigh)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Where you land</p>
                    <p className="text-lg font-semibold text-foreground">{result.summary.percentileRank}th %</p>
                  </div>
                </div>

                {/* Number line */}
                <div className="mt-6">
                  <div className="relative h-2 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="absolute inset-y-0 left-[15%] right-[15%] bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-400 opacity-70" />
                    {(() => {
                      const lo = result.summary.marketLow;
                      const hi = result.summary.marketHigh;
                      const span = Math.max(hi - lo, 1);
                      const min = lo - span * 0.4;
                      const max = hi + span * 0.4;
                      const pct = Math.max(2, Math.min(98, ((result.summary.total - min) / (max - min)) * 100));
                      return (
                        <div
                          className="absolute -top-1.5 -ml-2 w-4 h-5 rounded-sm bg-foreground shadow-md"
                          style={{ left: `${pct}%` }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-foreground/50">
                    <span>Below market</span>
                    <span>Fair range</span>
                    <span>Above market</span>
                  </div>
                </div>

                <p className="mt-5 text-sm text-foreground/75 leading-relaxed">
                  {result.roast.oneLiner}
                </p>
              </Card>

              {/* How Haleo got this number — the evidence block */}
              <Card className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur">
                <h3 className="font-serif text-xl text-foreground mb-4">How Haleo got this number</h3>

                {result.sources && result.sources.length > 0 ? (
                  <>
                    <p className="text-sm text-foreground/70 mb-3">
                      Fair range based on {result.sources.length} source{result.sources.length === 1 ? "" : "s"}:
                    </p>
                    <ul className="space-y-2 text-sm">
                      {result.sources.map((s, i) => {
                        const cleanName = cleanSourceName(s.name);
                        const Icon = sourceIcon(cleanName);
                        const detail = sourceDetail(cleanName, s.sampleSize);
                        return (
                          <li key={i} className="flex items-start gap-3">
                            <Icon className="w-4 h-4 mt-0.5 text-foreground/60 shrink-0" />
                            <span className="text-foreground/85">
                              {detail ? <><span className="font-medium text-foreground">{detail}</span> from </> : null}
                              {cleanName}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-foreground/60">Pulled from public cost guides and recent local permits.</p>
                )}

                {result.comparableProjects && result.comparableProjects.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-foreground/10">
                    <p className="text-[11px] uppercase tracking-wide text-foreground/50 mb-2">Nearby permit comps</p>
                    <div className="space-y-2">
                      {result.comparableProjects.slice(0, 3).map((c, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                          <div className="text-foreground/80 truncate">
                            {c.address} <span className="text-foreground/50">· {c.type}</span>
                          </div>
                          <div className="font-medium text-foreground tabular-nums">{fmt(c.cost)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-5 text-[11px] text-foreground/50 leading-relaxed">
                  This is an estimate, not an appraisal. Always confirm with at least two bids before you sign.
                </p>
              </Card>

              {/* Line-by-line */}
              {result.roast.lineRoasts && result.roast.lineRoasts.length > 0 && (
                <Card className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur">
                  <h3 className="font-serif text-xl text-foreground mb-4">Line by line</h3>
                  <div className="space-y-4">
                    {result.roast.lineRoasts.map((lr, i) => {
                      const v = verdictBadge(lr.verdict);
                      return (
                        <div key={i} className="border-l-2 border-foreground/10 pl-4">
                          <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
                            <p className="font-semibold text-foreground text-sm">{lr.item}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground/70 tabular-nums">{fmt(lr.cost)}</span>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${v.bg} ${v.text}`}>{v.label}</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/70">{lr.burn}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* What to do next */}
              <Card className="p-6 rounded-3xl bg-foreground text-background">
                <p className="text-xs uppercase tracking-widest opacity-60 mb-2">What to do next</p>
                <p className="text-base sm:text-lg font-serif leading-snug">{result.roast.advice}</p>
              </Card>

              {/* Primary CTA: flow into full audit */}
              <Card className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-foreground to-foreground/90 text-background">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-serif text-xl mb-1">Want the deeper read?</p>
                    <p className="text-sm opacity-80 leading-snug">
                      The full audit digs into scope gaps, contract risk, license signals, and the line items most likely to bite you later. Same file, no re-upload.
                    </p>
                  </div>
                  <Button
                    onClick={goToFullAudit}
                    className="rounded-full bg-background text-foreground hover:bg-background/90 px-5"
                  >
                    Run the full audit <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </Card>

              {/* Share */}
              <Card className="p-6 rounded-3xl bg-white/85 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-foreground/50 mb-3 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" /> Share this check
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={downloadShareCard}
                    disabled={downloading}
                    className="rounded-full bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {downloading ? "Generating…" : "Download scorecard"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => share("twitter")} className="rounded-full">
                    <Twitter className="w-4 h-4 mr-1.5" /> Twitter / X
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => share("facebook")} className="rounded-full">
                    <Facebook className="w-4 h-4 mr-1.5" /> Facebook
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => share("copy")} className="rounded-full">
                    <Link2 className="w-4 h-4 mr-1.5" /> Copy link
                  </Button>
                  {typeof navigator !== "undefined" && (navigator as any).share && (
                    <Button variant="outline" size="sm" onClick={() => share("native")} className="rounded-full">
                      <Share2 className="w-4 h-4 mr-1.5" /> More
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-foreground/50 mt-3">{result.roast.shareCaption}</p>
              </Card>

              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={reset} className="rounded-full">
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Check another quote
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Offscreen polished share scorecard (1200×630) for PNG export */}
      {result && (
        <div style={{ position: "fixed", top: 0, left: -10000, pointerEvents: "none", zIndex: -1 }}>
          <div
            ref={shareCardRef}
            style={{
              width: 1200,
              height: 630,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 64,
              fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              color: "#ffffff",
              background:
                ({
                  emerald: "linear-gradient(135deg,#059669,#10b981 45%,#5eead4)",
                  lime: "linear-gradient(135deg,#65a30d,#34d399 45%,#fde047)",
                  amber: "linear-gradient(135deg,#f59e0b,#fbbf24 45%,#fdba74)",
                  orange: "linear-gradient(135deg,#f97316,#fbbf24 45%,#fde047)",
                  red: "linear-gradient(135deg,#dc2626,#f43f5e 50%,#fb923c)",
                } as Record<string, string>)[result.tier.color] ||
                "linear-gradient(135deg,#fbbf24,#fb923c)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", opacity: 0.9, fontWeight: 600 }}>
                Haleo · Quote Score
              </div>
              <div
                style={{
                  fontSize: 18,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(8px)",
                  fontWeight: 500,
                }}
              >
                haleo.studio/roast
              </div>
            </div>

            <div>
              <div style={{ fontSize: 18, letterSpacing: 3, textTransform: "uppercase", opacity: 0.85, marginBottom: 12, fontWeight: 600 }}>
                {result.tier.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 18 }}>
                <span style={{ fontSize: 240, fontWeight: 800, lineHeight: 0.85, letterSpacing: -8, fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  {result.score}
                </span>
                <span style={{ fontSize: 48, opacity: 0.85, fontWeight: 500 }}>/ 100</span>
              </div>
              {(() => {
                const diff = result.summary.total - result.summary.marketAverage;
                const pct = Math.round(Math.abs(diff) / Math.max(1, result.summary.marketAverage) * 100);
                const within = result.summary.total >= result.summary.marketLow && result.summary.total <= result.summary.marketHigh;
                const line = within
                  ? `Within the local fair range for this scope`
                  : diff > 0
                    ? `About ${fmt(Math.abs(diff))} (${pct}%) above the local average`
                    : `About ${fmt(Math.abs(diff))} (${pct}%) below the local average`;
                return (
                  <div style={{ fontSize: 38, lineHeight: 1.2, fontWeight: 500, maxWidth: 980 }}>
                    {line}.
                  </div>
                );
              })()}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 28,
                borderTop: "1px solid rgba(255,255,255,0.25)",
                fontSize: 20,
              }}
            >
              <div style={{ display: "flex", gap: 48 }}>
                <div>
                  <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", opacity: 0.75 }}>Your quote</div>
                  <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{fmt(result.summary.total)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", opacity: 0.75 }}>Local fair range</div>
                  <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>
                    {fmt(result.summary.marketLow)}–{fmt(result.summary.marketHigh)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 16, opacity: 0.85, textAlign: "right" }}>
                Check yours free →<br />haleo.studio
              </div>
            </div>
          </div>
        </div>
      )}
    </main>

  );
}
