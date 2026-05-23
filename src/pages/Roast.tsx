import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Flame, Share2, Download, Twitter, Facebook, Link2, Sparkles, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RoastResult {
  score: number;
  tier: { label: string; color: string; emoji: string };
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
    wtf: { bg: "bg-red-100", text: "text-red-700", label: "WTF" },
  } as Record<string, { bg: string; text: string; label: string }>)[v] || { bg: "bg-muted", text: "text-foreground", label: "—" };

export default function Roast() {
  const [stage, setStage] = useState<"upload" | "loading" | "result">("upload");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = [
    "Squinting at your quote…",
    "Cross-checking with HomeAdvisor + Angi…",
    "Pulling local permit comps…",
    "Running the numbers…",
    "Composing your roast…",
  ];

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Too big", description: "Keep it under 20 MB.", variant: "destructive" });
      return;
    }
    setStage("loading");
    const phaseInterval = setInterval(() => {
      setLoadingPhase((p) => (p + 1) % loadingMessages.length);
    }, 2200);

    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("roast-proposal", {
        body: { fileBase64, fileName: file.name, fileType: file.type },
      });
      if (error || !data || data.error) throw new Error(data?.error || error?.message || "Roast failed");
      clearInterval(phaseInterval);
      setResult(data);
      setStage("result");
    } catch (e: any) {
      clearInterval(phaseInterval);
      toast({ title: "Couldn't roast it", description: e.message || "Try a clearer screenshot.", variant: "destructive" });
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
    const text = result.roast.shareCaption + " — try it free on Haleo:";
    if (where === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
    } else if (where === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`, "_blank");
    } else if (where === "copy") {
      navigator.clipboard.writeText(`${text} ${shareUrl}`);
      toast({ title: "Copied!", description: "Paste it wherever your paranoid friends hang out." });
    } else if (where === "native" && navigator.share) {
      navigator.share({ title: "Remodel Roast", text, url: shareUrl }).catch(() => {});
    }
  };

  const reset = () => {
    setResult(null);
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
        <div className="text-xs text-foreground/50">Anonymous · No login · No contractor names stored</div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <AnimatePresence mode="wait">
          {stage === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full mb-4">
                  <Flame className="w-3.5 h-3.5" /> REMODEL ROAST · BETA
                </div>
                <h1 className="text-5xl sm:text-6xl font-serif tracking-tight text-foreground mb-3">
                  Am I getting <span className="italic">ripped off?</span>
                </h1>
                <p className="text-lg text-foreground/70 max-w-xl mx-auto">
                  Upload your contractor's quote or estimate. Haleo returns a brutally honest, color-coded score and a line-by-line breakdown of where the markup is hiding.
                  Free, anonymous, and weirdly fun.
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
                <p className="text-lg font-semibold text-foreground mb-1">Upload your quote here</p>
                <p className="text-sm text-foreground/60">Screenshot, photo, or PDF · Up to 20 MB</p>
                <Button className="mt-6 bg-foreground hover:bg-foreground/90 text-background rounded-full px-6">
                  Choose a file
                </Button>
                <p className="text-[11px] text-foreground/50 mt-5 max-w-sm mx-auto">
                  Black out the contractor name if you want. We don't store it.
                  We do save anonymized prices to keep getting smarter.
                </p>
              </Card>

              {/* How it works */}
              <div className="grid sm:grid-cols-3 gap-4 mt-10 text-sm">
                {[
                  { n: "1", t: "Upload the quote", d: "Photo or PDF, doesn't matter." },
                  { n: "2", t: "Haleo does the math", d: "Cost guides + permits + our corpus." },
                  { n: "3", t: "Share the roast", d: "Your paranoid friends will thank you." },
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
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mb-6 shadow-xl shadow-orange-200"
              >
                <Flame className="w-10 h-10 text-white" />
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
              <p className="text-xs text-foreground/50 mt-2">Usually 20–40 seconds.</p>
            </motion.div>
          )}

          {stage === "result" && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Big Score Card — the share centerpiece */}
              <Card className={`relative overflow-hidden rounded-3xl border-0 shadow-2xl p-8 sm:p-10 text-white bg-gradient-to-br ${tierGradient(result.tier.color)}`}>
                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-widest opacity-90 mb-2">Remodel Roast Score</p>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-7xl sm:text-8xl font-serif font-bold leading-none">{result.score}</span>
                    <span className="text-xl opacity-90">/ 100</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-serif mb-4">{result.tier.label}</p>
                  <p className="text-base sm:text-lg leading-snug max-w-xl opacity-95 italic">"{result.roast.headline}"</p>
                  <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" /> haleo.studio/roast
                  </div>
                </div>
                {/* decorative blob */}
                <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              </Card>

              {/* The actual roast */}
              <Card className="p-6 sm:p-8 rounded-3xl bg-white/80 backdrop-blur">
                <p className="text-lg sm:text-xl font-serif text-foreground leading-relaxed">
                  {result.roast.oneLiner}
                </p>
                <div className="mt-4 pt-4 border-t border-foreground/10 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Your quote</p>
                    <p className="text-base font-semibold text-foreground">{fmt(result.summary.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Market avg</p>
                    <p className="text-base font-semibold text-foreground">{fmt(result.summary.marketAverage)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Vs. market</p>
                    <p className="text-base font-semibold text-foreground">{result.summary.ratio}%</p>
                  </div>
                </div>
              </Card>

              {/* Line-item burns */}
              {result.roast.lineRoasts && result.roast.lineRoasts.length > 0 && (
                <Card className="p-6 sm:p-8 rounded-3xl bg-white/80 backdrop-blur">
                  <h3 className="font-serif text-xl text-foreground mb-4">Line-by-line</h3>
                  <div className="space-y-4">
                    {result.roast.lineRoasts.map((lr, i) => {
                      const v = verdictBadge(lr.verdict);
                      return (
                        <div key={i} className="border-l-2 border-foreground/10 pl-4">
                          <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
                            <p className="font-semibold text-foreground text-sm">{lr.item}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground/70">{fmt(lr.cost)}</span>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${v.bg} ${v.text}`}>{v.label}</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/70 italic">"{lr.burn}"</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Advice */}
              <Card className="p-6 rounded-3xl bg-foreground text-background">
                <p className="text-xs uppercase tracking-widest opacity-60 mb-2">What to do tomorrow</p>
                <p className="text-base sm:text-lg font-serif leading-snug">{result.roast.advice}</p>
              </Card>

              {/* Share row */}
              <Card className="p-6 rounded-3xl bg-white/80 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-foreground/50 mb-3 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" /> Share the roast
                </p>
                <div className="flex flex-wrap gap-2">
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
                <p className="text-[11px] text-foreground/50 mt-3 italic">
                  "{result.roast.shareCaption}"
                </p>
              </Card>

              {/* CTA + reset */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button asChild className="rounded-full flex-1 bg-foreground hover:bg-foreground/90 text-background">
                  <Link to="/brief">Get a real brief for your project →</Link>
                </Button>
                <Button variant="outline" onClick={reset} className="rounded-full">
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Roast another
                </Button>
              </div>

              {result.confidence && (
                <p className="text-[11px] text-foreground/50 text-center">
                  Confidence: <span className="font-medium">{result.confidence}</span> · Based on public cost guides + local permit data{result.summary.zipCode ? ` for ${result.summary.zipCode}` : ""}.
                  Roasts are for entertainment — get a real brief before you sign.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
