import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Share2, Twitter, Facebook, Link2, ArrowLeft, RotateCcw,
  ArrowRight, CheckCircle2, Database, FileText, MapPin, BarChart3, Download,
  ChevronDown, Flame, Mail, MessageCircle, Send, Linkedin, Copy,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";



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
  const [showSources, setShowSources] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [funMessageIndex, setFunMessageIndex] = useState(0);
  const funShareMessages = [
    "If this helped, would you pass it on? I'm one person trying to get this in front of homeowners before they sign.",
    "No ad budget here — just hoping word of mouth does the work. Sharing genuinely helps.",
    "If a friend is renovating, send it their way. That's the whole growth strategy, honestly.",
    "Built this solo. A share to one person who needs it means more than you'd think.",
  ];

  useEffect(() => {
    if (stage !== "result") return;
    const interval = setInterval(() => {
      setFunMessageIndex((i) => (i + 1) % funShareMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [stage]);

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

  const share = (where: "twitter" | "facebook" | "linkedin" | "whatsapp" | "telegram" | "reddit" | "email" | "copy" | "native") => {
    if (!result) return;
    const text = result.roast.shareCaption + " — checked on Haleo";
    const url = shareUrl;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);

    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
      email: `mailto:?subject=${encodeURIComponent("I checked my contractor quote on Haleo")}&body=${encodedText}%0A%0A${encodedUrl}`,
    };

    if (where === "copy") {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: "Copied!", description: "Link ready to paste. Go make some noise." });
    } else if (where === "native" && (navigator as any).share) {
      (navigator as any).share({ title: "Haleo quote check", text, url }).catch(() => {});
    } else if (links[where]) {
      window.open(links[where], "_blank", "noopener,noreferrer");
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
      a.download = `haleo-takeaway-${result.score}.png`;
      a.click();
      toast({ title: "Saved", description: "Your takeaway card is on your device." });

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
    <main className="min-h-screen bg-background">
      <SiteHeader />

      <AnimatePresence mode="wait">
        {stage === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Marketing hero — the screen homeowners land on */}
            <section className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[80%] bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,0.18),transparent_55%)]" />
              <div className="container mx-auto max-w-5xl px-5 sm:px-6 pt-24 md:pt-32 pb-10 md:pb-14">
                <div className="grid items-center gap-10 md:gap-12 md:grid-cols-[1.1fr_1fr]">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3.5 py-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700 mb-6 whitespace-nowrap">
                      <Flame className="w-3.5 h-3.5 shrink-0" /> Free · No signup · 30 seconds
                    </div>
                    <h1 className="font-serif text-[2.1rem] md:text-[3.4rem] font-medium leading-[1.02] tracking-tight text-foreground">
                      Got a quote? <span className="italic">Get it roasted.</span>
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
                      Drop in your contractor's estimate. We line it up against real local costs and prior proposals, then tell you straight where you stand.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-lg shadow-orange-200/50 hover:bg-foreground/90 transition"
                      >
                        Roast my quote <ArrowRight className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-muted-foreground">No login. Just answers.</span>
                    </div>
                  </motion.div>

                  {/* Sample verdict card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20, rotate: -2 }}
                    animate={{ opacity: 1, y: 0, rotate: -2 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                    className="relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-200 to-rose-200 blur-3xl opacity-60 -z-10" />
                    <div className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-7 text-white shadow-2xl">
                      <p className="text-[10px] uppercase tracking-widest opacity-90">Remodel Roast</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-6xl font-serif font-bold leading-none">34</span>
                        <span className="text-sm opacity-90">/ 100</span>
                      </div>
                      <p className="mt-2 text-xl font-serif">Yikes Territory</p>
                      <p className="mt-3 text-sm italic leading-snug opacity-95">
                        "$12,000 for a backsplash? Are they tiling it with 24k gold?"
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded-full bg-white/20">Cabinets · HIGH</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/20">Labor · FAIR</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <p className="mt-10 text-center text-[13.5px] text-muted-foreground">
                  No quote yet?{" "}
                  <Link to="/brief" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Find your contractor →
                  </Link>
                </p>
              </div>
            </section>

            {/* Upload card */}
            <div className="max-w-3xl mx-auto px-5 sm:px-6 pb-12 md:pb-20">
              <Card
                className="border-2 border-dashed border-orange-300/60 bg-white/70 backdrop-blur p-6 md:p-10 sm:p-14 text-center hover:border-orange-400 transition cursor-pointer rounded-3xl"
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
                <div className="mt-5 mx-auto max-w-sm rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Your privacy</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-foreground/80">
                    Black out the contractor name if you want — we don't keep it. We only save anonymized prices, so the next homeowner's check gets sharper.
                  </p>
                </div>
              </Card>

              {/* How it works — plain English */}
              <div className="grid sm:grid-cols-3 gap-4 mt-10 text-sm">
                {[
                  { n: "1", t: "Upload the quote", d: "Photo or PDF, any format." },
                  { n: "2", t: "Haleo does the math", d: "Public cost guides, local permit records, and our own database of past audits." },
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
            </div>
          </motion.div>
        )}

        {stage === "loading" && (
          <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-24 md:pt-28 pb-12 md:pb-20">
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-14 md:py-24">
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
          </div>
        )}

        {stage === "result" && result && (
          <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-24 md:pt-28 pb-12 md:pb-20">
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Verdict card — lead with the call, not a numeric score */}
              <Card className={`relative overflow-hidden rounded-3xl border-0 shadow-2xl p-7 sm:p-9 md:p-10 text-white bg-gradient-to-br ${tierGradient(result.tier.color)}`}>
                <div className="relative z-10 flex flex-col gap-4">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
                    The verdict
                  </span>
                  <div>
                    <p className="font-serif text-[2.5rem] sm:text-5xl font-semibold leading-[1.02] tracking-tight">
                      {result.tier.label}.
                    </p>
                    <p className="mt-3 text-[15px] sm:text-lg leading-snug max-w-xl opacity-95 text-pretty">
                      {result.roast.headline}
                    </p>
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              </Card>



              {/* Where your quote lands — the intuitive bar */}
              <Card className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-foreground/50 mb-5">Where your quote lands</p>

                {(() => {
                  const lo = result.summary.marketLow;
                  const hi = result.summary.marketHigh;
                  const total = result.summary.total;
                  const span = Math.max(hi - lo, 1);
                  const min = lo - span * 0.5;
                  const max = hi + span * 0.5;
                  const fullSpan = max - min;
                  const fairLeft = ((lo - min) / fullSpan) * 100;
                  const fairRight = ((hi - min) / fullSpan) * 100;
                  const quotePct = Math.max(1, Math.min(99, ((total - min) / fullSpan) * 100));
                  const within = total >= lo && total <= hi;
                  const above = total > hi;
                  const labelLeft = Math.max(10, Math.min(90, quotePct));
                  const anchorTranslate = quotePct < 12 ? "0%" : quotePct > 88 ? "-100%" : "-50%";

                  return (
                    <>
                      <div className="relative pt-14 pb-12">
                        {/* Quote marker label */}
                        <div
                          className="absolute top-0"
                          style={{ left: `${labelLeft}%`, transform: `translateX(${anchorTranslate})` }}
                        >
                          <div className="flex flex-col items-center">
                            <div className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold shadow-md whitespace-nowrap">
                              Your quote · {fmt(total)}
                            </div>
                            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-foreground" />
                          </div>
                        </div>

                        {/* The bar */}
                        <div className="relative h-10 rounded-xl bg-rose-100 overflow-hidden">
                          <div className="absolute inset-y-0 bg-sky-100" style={{ left: 0, width: `${fairLeft}%` }} />
                          <div className="absolute inset-y-0 bg-emerald-200" style={{ left: `${fairLeft}%`, width: `${fairRight - fairLeft}%` }} />
                          <div className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${fairLeft}%` }} />
                          <div className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${fairRight}%` }} />
                          {/* Quote pin overlay */}
                          <div
                            className="absolute inset-y-[-6px] w-[3px] bg-foreground rounded-full shadow"
                            style={{ left: `calc(${quotePct}% - 1.5px)` }}
                          />
                        </div>

                        {/* Zone labels */}
                        <div className="relative mt-2 h-4 text-[11px] text-foreground/60">
                          <div className="absolute text-center" style={{ left: 0, width: `${fairLeft}%` }}>Below market</div>
                          <div className="absolute text-center font-semibold text-emerald-700" style={{ left: `${fairLeft}%`, width: `${fairRight - fairLeft}%` }}>Fair range</div>
                          <div className="absolute text-center" style={{ left: `${fairRight}%`, width: `${100 - fairRight}%` }}>Above market</div>
                        </div>

                        {/* Fair range bounds */}
                        <div className="relative mt-4 h-4 text-[11px] text-foreground/70 font-medium tabular-nums">
                          <div className="absolute" style={{ left: `${fairLeft}%`, transform: "translateX(-50%)" }}>{fmt(lo)}</div>
                          <div className="absolute" style={{ left: `${fairRight}%`, transform: "translateX(-50%)" }}>{fmt(hi)}</div>
                        </div>
                      </div>

                      <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${within ? "bg-emerald-50 text-emerald-800" : above ? "bg-rose-50 text-rose-800" : "bg-sky-50 text-sky-800"}`}>
                        {within
                          ? `Your ${fmt(total)} quote sits inside the local fair range of ${fmt(lo)}–${fmt(hi)}.`
                          : above
                            ? `Your quote is ${fmt(total - hi)} above the top of the local fair range (${fmt(lo)}–${fmt(hi)}).`
                            : `Your quote is ${fmt(lo - total)} below the bottom of the local fair range (${fmt(lo)}–${fmt(hi)}).`}
                      </div>
                    </>
                  );
                })()}

                <p className="mt-5 text-sm text-foreground/75 leading-relaxed">
                  {result.roast.oneLiner}
                </p>
              </Card>

              {/* How Haleo got this number — collapsed by default */}
              <Card className="p-0 rounded-3xl bg-white/85 backdrop-blur overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSources((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 px-6 sm:px-8 py-5 text-left"
                >
                  <h3 className="font-serif text-lg text-foreground">How Haleo got this number</h3>
                  <motion.div
                    animate={{ rotate: showSources ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-foreground/60" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {showSources && (
                    <motion.div
                      key="sources"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-1 space-y-5">
                        {result.sources && result.sources.length > 0 ? (
                          <div>
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
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/60">Pulled from public cost guides and recent local permits.</p>
                        )}

                        {result.comparableProjects && result.comparableProjects.length > 0 && (
                          <div className="pt-5 border-t border-foreground/10">
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

                        <p className="text-[11px] text-foreground/50 leading-relaxed">
                          This is an estimate, not an appraisal. Always confirm with at least two bids before you sign.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

              {/* What to do next — warm advice card */}
              <Card className="relative overflow-hidden p-6 sm:p-7 rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-xl" aria-hidden>
                    💡
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-amber-700 mb-1.5">
                      What to do next
                    </p>
                    <p className="text-base sm:text-lg font-serif leading-snug text-foreground">
                      {result.roast.advice}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Deeper read — full audit handoff, soft not loud */}
              <Card className="p-6 sm:p-7 rounded-3xl border border-foreground/10 bg-white/85 backdrop-blur">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="shrink-0 w-10 h-10 rounded-2xl bg-foreground/5 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-serif text-xl text-foreground mb-1">Want the deeper read?</p>
                    <p className="text-sm text-foreground/65 leading-snug">
                      The full audit goes into scope gaps, contract risk, license signals, and the line items most likely to bite you later. Same file, no re-upload.
                    </p>
                  </div>
                  <Button
                    onClick={goToFullAudit}
                    className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-5"
                  >
                    Run the full audit <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </Card>

              {/* Share — honest founder ask, then options */}
              <TooltipProvider>
                <Card className="relative overflow-hidden p-6 sm:p-7 rounded-3xl border border-foreground/5 bg-white/85 backdrop-blur">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="shrink-0 w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center text-base" aria-hidden>
                      🫶
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-foreground/50 mb-1">
                        A small ask
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={funMessageIndex}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.3 }}
                          className="text-sm sm:text-[15px] text-foreground/80 leading-snug"
                        >
                          {funShareMessages[funMessageIndex]}
                        </motion.p>
                      </AnimatePresence>
                      <p className="mt-1.5 text-xs text-foreground/45">— the founder, building this solo</p>
                    </div>
                  </div>

                  {/* Social grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
                    {[
                      { key: "twitter", label: "X / Twitter", icon: Twitter, color: "bg-neutral-900 text-white hover:bg-neutral-800" },
                      { key: "facebook", label: "Facebook", icon: Facebook, color: "bg-[#1877F2] text-white hover:bg-[#166fe5]" },
                      { key: "linkedin", label: "LinkedIn", icon: Linkedin, color: "bg-[#0A66C2] text-white hover:bg-[#0957a8]" },
                      { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-[#25D366] text-white hover:bg-[#20bd5a]" },
                      { key: "telegram", label: "Telegram", icon: Send, color: "bg-[#229ED9] text-white hover:bg-[#1e8dc2]" },
                      { key: "reddit", label: "Reddit", icon: null, color: "bg-[#FF4500] text-white hover:bg-[#e63e00]", svg: (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-6.986 4.87-3.856 0-6.986-2.176-6.986-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 5.5 10.754c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.106-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.25 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                      ) },
                      { key: "email", label: "Email", icon: Mail, color: "bg-foreground/90 text-background hover:bg-foreground/80" },
                    ].map((s) => (
                      <Tooltip key={s.key}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => share(s.key as any)}
                            className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 ${s.color}`}
                            aria-label={s.label}
                          >
                            {s.svg ? s.svg : <s.icon className="w-4 h-4" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {s.label}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {typeof navigator !== "undefined" && (navigator as any).share && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => share("native")}
                            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-muted text-foreground hover:bg-muted/80 transition-all duration-200 hover:scale-105 active:scale-95"
                            aria-label="More options"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          More options
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Secondary row: copy link + save card, quiet utility */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-foreground/5 mt-1">
                    <button
                      onClick={() => share("copy")}
                      className="mt-3 flex items-center gap-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 px-3.5 py-2 text-xs font-medium text-foreground/75 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </button>
                    <button
                      onClick={downloadShareCard}
                      disabled={downloading}
                      className="mt-3 flex items-center gap-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 px-3.5 py-2 text-xs font-medium text-foreground/75 transition-colors disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloading ? "Saving…" : "Save image card"}
                    </button>
                  </div>
                </Card>
              </TooltipProvider>

              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={reset} className="rounded-full">
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Check another quote
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Offscreen takeaway scorecard — the "golden nugget" PNG download.
          One self-contained card: verdict, range bar, top line-item burns,
          advice, sources, footer. Sized 1200×1600 for crisp social/save use. */}
      {result && (() => {
        const lo = result.summary.marketLow;
        const hi = result.summary.marketHigh;
        const total = result.summary.total;
        const within = total >= lo && total <= hi;
        const diff = total - result.summary.marketAverage;
        const verdictBlurb = within
          ? "Priced fair for this scope"
          : diff > 0
            ? `${fmt(Math.abs(diff))} over the local average`
            : `${fmt(Math.abs(diff))} under the local average`;
        const span = Math.max(hi - lo, 1);
        const minB = lo - span * 0.5;
        const maxB = hi + span * 0.5;
        const fullSpan = maxB - minB;
        const fairLeftPct = ((lo - minB) / fullSpan) * 100;
        const fairRightPct = ((hi - minB) / fullSpan) * 100;
        const quotePct = Math.max(2, Math.min(98, ((total - minB) / fullSpan) * 100));
        const topRoasts = (result.roast.lineRoasts || []).slice(0, 4);
        const tierBg = ({
          emerald: "linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%)",
          lime: "linear-gradient(135deg,#365314 0%,#4d7c0f 60%,#65a30d 100%)",
          amber: "linear-gradient(135deg,#78350f 0%,#92400e 55%,#b45309 100%)",
          orange: "linear-gradient(135deg,#7c2d12 0%,#9a3412 55%,#c2410c 100%)",
          red: "linear-gradient(135deg,#7f1d1d 0%,#991b1b 55%,#b91c1c 100%)",
        } as Record<string, string>)[result.tier.color] || "linear-gradient(135deg,#78350f,#b45309)";

        return (
          <div style={{ position: "fixed", top: 0, left: -10000, pointerEvents: "none", zIndex: -1 }}>
            <div
              ref={shareCardRef}
              style={{
                width: 1200,
                padding: 28,
                background: tierBg,
                fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              }}
            >
              {/* Inner "card" with golden border */}
              <div
                style={{
                  background: "#FFFBF2",
                  border: "2px solid #F5C36A",
                  borderRadius: 32,
                  padding: 56,
                  boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
                  color: "#1a1a1a",
                  display: "flex",
                  flexDirection: "column",
                  gap: 36,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: "linear-gradient(135deg,#F59E0B,#F97316)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 800, fontSize: 22, fontFamily: "Georgia, serif",
                    }}>h</div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Haleo · Quote Scorecard</div>
                  </div>
                  <div style={{ fontSize: 16, color: "#6b7280", textTransform: "capitalize" }}>
                    {result.summary.spaceType} {result.summary.scope}
                    {result.summary.zipCode ? ` · ${result.summary.zipCode}` : ""}
                  </div>
                </div>

                {/* THE NUGGET — verdict block */}
                <div style={{
                  background: tierBg,
                  borderRadius: 24,
                  padding: "44px 48px",
                  color: "#fff",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <div style={{ fontSize: 14, letterSpacing: 4, textTransform: "uppercase", opacity: 0.85, marginBottom: 14, fontWeight: 600 }}>
                    The verdict
                  </div>
                  <div style={{ fontSize: 84, lineHeight: 1, fontWeight: 800, letterSpacing: -2, fontFamily: "Georgia, 'Times New Roman', serif", marginBottom: 18 }}>
                    {result.tier.label}.
                  </div>
                  <div style={{ fontSize: 28, lineHeight: 1.25, fontWeight: 500, opacity: 0.95, maxWidth: 920 }}>
                    {verdictBlurb}.
                  </div>
                </div>

                {/* Where the quote lands — visual bar */}
                <div>
                  <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "#6b7280", marginBottom: 18, fontWeight: 600 }}>
                    Where your quote lands
                  </div>
                  <div style={{ position: "relative", paddingTop: 56, paddingBottom: 44 }}>
                    {/* Quote label */}
                    <div style={{
                      position: "absolute", top: 0,
                      left: `${quotePct}%`,
                      transform: quotePct < 12 ? "translateX(0)" : quotePct > 88 ? "translateX(-100%)" : "translateX(-50%)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                    }}>
                      <div style={{
                        background: "#1a1a1a", color: "#fff",
                        padding: "8px 14px", borderRadius: 10,
                        fontSize: 18, fontWeight: 700, whiteSpace: "nowrap",
                      }}>
                        Your quote · {fmt(total)}
                      </div>
                      <div style={{
                        width: 0, height: 0,
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        borderTop: "8px solid #1a1a1a",
                      }} />
                    </div>
                    {/* The bar */}
                    <div style={{ position: "relative", height: 44, borderRadius: 14, background: "#FECACA", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${fairLeftPct}%`, background: "#E0F2FE" }} />
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${fairLeftPct}%`, width: `${fairRightPct - fairLeftPct}%`, background: "#BBF7D0" }} />
                      <div style={{ position: "absolute", top: -6, bottom: -6, left: `calc(${quotePct}% - 2px)`, width: 4, background: "#1a1a1a", borderRadius: 3 }} />
                    </div>
                    {/* Range labels */}
                    <div style={{ position: "relative", marginTop: 10, height: 18, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
                      <div style={{ position: "absolute", left: `${fairLeftPct}%`, transform: "translateX(-50%)" }}>{fmt(lo)}</div>
                      <div style={{ position: "absolute", left: `${fairRightPct}%`, transform: "translateX(-50%)" }}>{fmt(hi)}</div>
                    </div>
                  </div>
                </div>

                {/* Line-by-line burns */}
                {topRoasts.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "#6b7280", marginBottom: 16, fontWeight: 600 }}>
                      Line by line
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {topRoasts.map((lr, i) => {
                        const v = verdictBadge(lr.verdict);
                        const badgeBg = ({ fair: "#D1FAE5", low: "#CCFBF1", high: "#FEF3C7", wtf: "#FEE2E2" } as Record<string,string>)[lr.verdict] || "#F3F4F6";
                        const badgeFg = ({ fair: "#065F46", low: "#115E59", high: "#92400E", wtf: "#991B1B" } as Record<string,string>)[lr.verdict] || "#374151";
                        return (
                          <div key={i} style={{ borderLeft: "3px solid #F5C36A", paddingLeft: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{lr.item}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 16, color: "#4b5563", fontVariantNumeric: "tabular-nums" }}>{fmt(lr.cost)}</span>
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, padding: "3px 10px", borderRadius: 999, background: badgeBg, color: badgeFg }}>
                                  {v.label}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 16, color: "#4b5563", lineHeight: 1.4 }}>{lr.burn}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Golden advice strip — the takeaway */}
                <div style={{
                  background: "linear-gradient(135deg,#FEF3C7 0%,#FDE68A 100%)",
                  border: "1px solid #F5C36A",
                  borderRadius: 20,
                  padding: "24px 28px",
                  display: "flex",
                  gap: 18,
                  alignItems: "flex-start",
                }}>
                  <div style={{ fontSize: 28, lineHeight: 1 }}>💡</div>
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#92400E", marginBottom: 6, fontWeight: 700 }}>
                      What to do next
                    </div>
                    <div style={{ fontSize: 20, lineHeight: 1.4, color: "#1a1a1a", fontWeight: 500, fontFamily: "Georgia, serif" }}>
                      {result.roast.advice}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingTop: 24, borderTop: "1px solid #E5E7EB",
                  fontSize: 14, color: "#6b7280",
                }}>
                  <div style={{ display: "flex", gap: 32 }}>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9CA3AF", fontWeight: 600 }}>Your quote</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginTop: 2 }}>{fmt(total)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9CA3AF", fontWeight: 600 }}>Local fair range</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginTop: 2 }}>{fmt(lo)}–{fmt(hi)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 600 }}>
                    Roast yours free →<br />
                    <span style={{ color: "#1a1a1a" }}>haleo.studio</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </main>

  );
}

