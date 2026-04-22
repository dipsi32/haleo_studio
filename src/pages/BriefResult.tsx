import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Download,
  Edit3,
  Send,
  ShieldCheck,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  FileText,
  ChevronRight,
  Video,
  Map,
  Ruler,
  Camera,
  Eye,
  Lightbulb,
  Sparkles,
  Play,
  StickyNote,
  Lock,
  Check,
  HelpCircle,
  Pencil,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EditBriefDrawer from "@/components/EditBriefDrawer";
import { ROOM_LABELS, useIntake, type MediaAsset } from "@/lib/intake";
import {
  buildHomeownerLayer,
  buildContractorLayer,
  buildPermitFlag,
  buildSpaceAnalysis,
  buildReadiness,
  readinessCopy,
  type ContractorLine,
  type SpaceAnalysisBlock,
} from "@/lib/brief";

const fmtMoney = (v?: number) => (v == null ? "" : v >= 500 ? "$500K+" : `$${v}K`);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground/80">
    {children}
  </span>
);

// ───── Media gallery ─────
const MediaTile = ({ m, onOpen }: { m: MediaAsset; onOpen: (m: MediaAsset) => void }) => {
  if (m.kind === "photo" || m.kind === "inspiration") {
    return (
      <button
        onClick={() => onOpen(m)}
        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
      >
        <img src={m.url} alt={m.name} className="h-full w-full object-cover transition-smooth group-hover:scale-[1.03]" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80 backdrop-blur">
          {m.kind === "photo" ? <Camera className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {m.kind === "photo" ? "Photo" : "Inspo"}
        </span>
      </button>
    );
  }
  if (m.kind === "video") {
    return (
      <button
        onClick={() => onOpen(m)}
        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-foreground/90 shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
      >
        <video src={m.url} className="h-full w-full object-cover opacity-90" muted playsInline />
        <div className="absolute inset-0 grid place-items-center bg-foreground/20">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-background/90 text-foreground shadow-lift transition-smooth group-hover:scale-110">
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </div>
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80 backdrop-blur">
          <Video className="h-3 w-3" /> Walkthrough
        </span>
      </button>
    );
  }
  const isImage = m.mime?.startsWith("image/");
  return (
    <button
      onClick={() => onOpen(m)}
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
    >
      {isImage ? (
        <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-card">
          <Map className="h-10 w-10 text-foreground/40" />
        </div>
      )}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80 backdrop-blur">
        <Map className="h-3 w-3" /> Floor plan
      </span>
    </button>
  );
};

const MediaLightbox = ({ asset, onClose }: { asset: MediaAsset | null; onClose: () => void }) => (
  <AnimatePresence>
    {asset && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-6 backdrop-blur"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-lift"
        >
          {asset.kind === "video" ? (
            <video src={asset.url} controls autoPlay className="max-h-[88vh] w-full bg-black" />
          ) : asset.mime?.startsWith("image/") || asset.kind === "photo" || asset.kind === "inspiration" ? (
            <img src={asset.url} alt={asset.name} className="max-h-[88vh] w-full object-contain" />
          ) : (
            <iframe src={asset.url} title={asset.name} className="h-[80vh] w-full" />
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ───── Basis chip on contractor lines ─────
const BasisChip = ({ basis }: { basis: ContractorLine["basis"] }) => {
  const cfg =
    basis === "grounded"
      ? { label: "From you", icon: Check, cls: "bg-sage-soft text-sage" }
      : basis === "inferred"
        ? { label: "Inferred", icon: AlertCircle, cls: "bg-accent-soft text-accent" }
        : { label: "Open question", icon: HelpCircle, cls: "bg-secondary text-foreground/70" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

// ───── Per-asset analysis card ─────
const AnalysisCard = ({ block }: { block: SpaceAnalysisBlock }) => {
  const ICONS: Record<SpaceAnalysisBlock["scope"], typeof Video> = {
    video: Video,
    photo: Camera,
    floorplan: Map,
    measurements: Ruler,
    general: Lightbulb,
  };
  const Icon = ICONS[block.scope];
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <header className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-medium leading-tight">{block.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{block.body}</p>
        </div>
      </header>
      {block.observations && block.observations.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">What a contractor sees</p>
          <ul className="mt-2 space-y-1.5">
            {block.observations.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/85">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-sage" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
      {block.unknowns && block.unknowns.length > 0 && (
        <div className="mt-4 rounded-xl bg-secondary/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">What we can't tell yet</p>
          <ul className="mt-2 space-y-1.5">
            {block.unknowns.map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/75">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/50" />
                {u}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
};

// ───── Page ─────
const BriefResult = () => {
  const { data, update, addMedia, removeMedia, togglePill } = useIntake();
  const [showContractor, setShowContractor] = useState(false);
  const [open, setOpen] = useState<MediaAsset | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  // Per-line edits to the contractor translation, keyed by index
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const homeowner = useMemo(() => buildHomeownerLayer(data), [data]);
  const contractorLines = useMemo(() => buildContractorLayer(data), [data]);
  const permit = useMemo(() => buildPermitFlag(data), [data]);
  const analysis = useMemo(() => buildSpaceAnalysis(data), [data]);
  const readiness = useMemo(() => buildReadiness(data), [data]);
  const readinessText = readinessCopy(readiness.level);

  // Reset approval whenever the underlying brief changes
  useEffect(() => {
    setApproved(false);
    setLineEdits({});
  }, [contractorLines]);

  const spaceMedia = data.media.filter((m) => m.kind !== "inspiration");
  const inspirationMedia = data.media.filter((m) => m.kind === "inspiration");

  const budgetLabel = data.budgetSkipped
    ? "Not shared"
    : data.budgetMin != null
      ? `${fmtMoney(data.budgetMin)} – ${fmtMoney(data.budgetMax)}`
      : "—";

  const timelineLabel =
    data.timeline === "asap"
      ? "Ready to start"
      : data.timeline === "1-3"
        ? "1–3 months"
        : data.timeline === "3-6"
          ? "3–6 months"
          : data.timeline === "exploring"
            ? "Exploring"
            : "—";

  const lineText = (i: number) => lineEdits[i] ?? contractorLines[i].text;

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground/80 transition-smooth hover:border-accent hover:text-foreground"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit brief
          </button>
        </div>
      </header>

      <main className="container max-w-4xl py-12 md:py-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Your project brief</p>
          <h1 className="mt-3 font-display text-5xl font-light leading-tight text-balance md:text-6xl">
            We translated your <em className="italic text-accent">vision.</em>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Here's your project — in your words, and in language any contractor can bid on.
          </p>
        </motion.div>

        {/* Quick facts */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          {data.room && <Pill>{ROOM_LABELS[data.room]}</Pill>}
          <Pill>
            <DollarSign className="mr-1 inline h-3 w-3" />
            {budgetLabel}
          </Pill>
          <Pill>
            <Calendar className="mr-1 inline h-3 w-3" />
            {timelineLabel}
          </Pill>
          <Pill>
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            {permit.likely ? "Permit likely required" : "Probably permit-exempt"}
          </Pill>
        </motion.div>

        {/* ───── Brief Readiness ───── */}
        <ReadinessCard
          readiness={readiness}
          headline={readinessText.headline}
          sub={readinessText.sub}
          onAdd={() => setEditOpen(true)}
        />

        {/* ───── Brief card with two layers ───── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
        >
          <div className="grid items-center gap-3 border-b border-border bg-secondary/30 px-6 py-4 sm:grid-cols-[1fr_auto] md:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium">Your brief</p>
                <p className="text-xs text-muted-foreground">
                  {showContractor ? "The contractor view — every line tagged for honesty." : "Your words. Toggle to see what a contractor reads."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowContractor((v) => !v)}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-smooth hover:bg-accent"
            >
              {showContractor ? "Show how you said it" : "See contractor view"}
              <ChevronRight className={`h-4 w-4 transition-smooth ${showContractor ? "rotate-180" : ""}`} />
            </button>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            {/* Homeowner column */}
            <div className="border-b border-border p-6 md:border-b-0 md:border-r md:p-10">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">In your words</p>
              <p className="mt-3 font-display text-2xl font-light leading-snug text-foreground/90">
                "{homeowner}"
              </p>
              {data.notes && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-secondary/50 p-4">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-sm leading-relaxed text-foreground/80">{data.notes}</p>
                </div>
              )}
            </div>

            {/* Contractor column */}
            <div className="relative bg-secondary/40 p-6 md:p-10">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-accent">For your contractor</p>
                {showContractor && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${approved ? "bg-sage-soft text-sage" : "bg-accent-soft text-accent"}`}>
                    {approved ? <><Lock className="h-3 w-3" /> Approved</> : <><AlertCircle className="h-3 w-3" /> Draft</>}
                  </span>
                )}
              </div>
              <AnimatePresence mode="wait">
                {showContractor ? (
                  <motion.div
                    key="reveal"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-3 space-y-2"
                  >
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Each line is tagged so you can see what's grounded in what you shared, what we inferred for you, and what's still an open question. Edit anything before you approve.
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {contractorLines.map((line, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: i * 0.04 }}
                          className="group rounded-xl border border-border bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <BasisChip basis={line.basis} />
                            {!approved && (
                              <button
                                onClick={() => setEditingIdx(editingIdx === i ? null : i)}
                                className="opacity-0 transition-smooth hover:text-accent group-hover:opacity-100"
                                aria-label="Edit line"
                              >
                                <Pencil className="h-3.5 w-3.5 text-foreground/50" />
                              </button>
                            )}
                          </div>
                          {editingIdx === i ? (
                            <Textarea
                              autoFocus
                              value={lineText(i)}
                              onChange={(e) => setLineEdits((s) => ({ ...s, [i]: e.target.value }))}
                              onBlur={() => setEditingIdx(null)}
                              rows={2}
                              className="mt-2 rounded-lg bg-background font-mono text-[13px]"
                            />
                          ) : (
                            <p className="mt-1.5 font-mono text-[13px] leading-relaxed text-foreground/90">
                              {lineText(i)}
                            </p>
                          )}
                          {line.source && (
                            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Source: {line.source}
                            </p>
                          )}
                        </motion.li>
                      ))}
                    </ul>

                    {/* Approval bar */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-foreground/5 p-3">
                      <div className="flex items-center gap-3 text-xs text-foreground/70">
                        <div className="flex items-center gap-1.5"><Check className="h-3 w-3 text-sage" /> From you</div>
                        <div className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3 text-accent" /> Inferred</div>
                        <div className="flex items-center gap-1.5"><HelpCircle className="h-3 w-3 text-foreground/60" /> Open</div>
                      </div>
                      <Button
                        onClick={() => setApproved((v) => !v)}
                        size="sm"
                        variant={approved ? "outline" : "default"}
                        className="rounded-full"
                      >
                        {approved ? <><Pencil className="h-3.5 w-3.5" /> Unlock to edit</> : <><Lock className="h-3.5 w-3.5" /> Approve & lock</>}
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 grid place-items-center"
                  >
                    <button
                      onClick={() => setShowContractor(true)}
                      className="group flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-card/40 px-8 py-10 text-center transition-smooth hover:border-accent hover:bg-card"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground transition-smooth group-hover:scale-110">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      <p className="font-display text-base font-medium">Reveal the contractor translation</p>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        The same vision, in language they can bid on — with sources you can verify.
                      </p>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Permit row */}
          <div className="flex items-start gap-3 border-t border-border bg-card px-6 py-6 md:px-10 md:py-7">
            <div className={`grid h-9 w-9 place-items-center rounded-full ${permit.likely ? "bg-accent-soft text-accent" : "bg-sage-soft text-sage"}`}>
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-medium">
                {permit.likely ? "Permit likely required" : "Probably permit-exempt"}
              </p>
              <p className="text-xs text-muted-foreground">{permit.reason}</p>
            </div>
          </div>
        </motion.section>

        {/* ───── Space snapshot ───── */}
        {(spaceMedia.length > 0 || data.measurements || data.notes) && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-display text-base font-medium">Space snapshot</p>
                  <p className="text-xs text-muted-foreground">Everything you've shared, attached to the brief.</p>
                </div>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                className="text-xs font-medium text-accent underline-offset-4 hover:underline"
              >
                Add more
              </button>
            </div>

            {spaceMedia.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spaceMedia.map((m) => (
                  <MediaTile key={m.id} m={m} onOpen={setOpen} />
                ))}
              </div>
            )}

            {(data.measurements || data.notes) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.measurements && (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Ruler className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-medium">Measurements</p>
                      <p className="text-xs leading-relaxed text-foreground/70">{data.measurements}</p>
                    </div>
                  </div>
                )}
                {data.notes && (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                      <StickyNote className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-medium">Rough notes</p>
                      <p className="text-xs leading-relaxed text-foreground/70">{data.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        )}

        {/* ───── Inspiration ───── */}
        {(inspirationMedia.length > 0 || data.inspirationLink) && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium">Inspiration</p>
                <p className="text-xs text-muted-foreground">The look you're chasing.</p>
              </div>
            </div>
            {inspirationMedia.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {inspirationMedia.map((m) => (
                  <MediaTile key={m.id} m={m} onOpen={setOpen} />
                ))}
              </div>
            )}
            {data.inspirationLink && (
              <p className="mt-4 truncate text-xs text-muted-foreground">
                Link: <span className="text-foreground/80">{data.inspirationLink}</span>
              </p>
            )}
          </motion.section>
        )}

        {/* ───── Space analysis (per-asset) ───── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-base font-medium">Space analysis</p>
              <p className="text-xs text-muted-foreground">
                A read of each thing you shared — through the contractor's lens, before they walk in.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {analysis.map((b) => (
              <AnalysisCard key={b.id} block={b} />
            ))}
          </div>
        </motion.section>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 grid gap-3 sm:grid-cols-3"
        >
          <Button size="lg" className="rounded-full" disabled={!approved}>
            <Send className="h-4 w-4" />
            {approved ? "Send to contractor" : "Approve to send"}
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" disabled={!approved}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
            <Edit3 className="h-4 w-4" />
            Edit brief
          </Button>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {approved
            ? "Sending and PDF export come online when Lovable Cloud is enabled."
            : "Reveal the contractor view above and approve it before sending."}
        </p>

        {/* Next step */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 rounded-3xl bg-foreground p-8 text-background md:p-12"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Next step</p>
          <h2 className="mt-3 font-display text-3xl font-light leading-tight md:text-4xl">
            Got proposals back? <em className="italic text-accent">Run the audit.</em>
          </h2>
          <p className="mt-4 max-w-lg text-sm text-background/70">
            We'll cross-check every line item against San Jose permit data and tell you exactly
            where the numbers stand — before you sign anything.
          </p>
          <Link
            to="/audit"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-smooth hover:bg-accent/90"
          >
            Start a forensic audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.section>
      </main>

      <MediaLightbox asset={open} onClose={() => setOpen(null)} />
      <EditBriefDrawer
        open={editOpen}
        data={data}
        onClose={() => setEditOpen(false)}
        onPatch={update}
        onAddMedia={addMedia}
        onRemoveMedia={removeMedia}
        onTogglePill={togglePill}
      />
    </div>
  );
};

// Tiny inline plus icon — kept here to avoid pulling another lucide import twice.
const Plus_Icon = () => (
  <svg viewBox="0 0 24 24" className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground/40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default BriefResult;
