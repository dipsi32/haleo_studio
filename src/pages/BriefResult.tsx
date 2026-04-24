import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  FileText,
  ChevronRight,
  Video,
  Map,
  Ruler,
  Camera,
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
  Plus,
  X,
  MessageSquarePlus,
  Eye,
  Hammer,
  Quote,
  Home as HomeIcon,
  Image as ImageIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import EditBriefDrawer from "@/components/EditBriefDrawer";
import { ROOM_LABELS, useIntake, type MediaAsset, type IntakeData } from "@/lib/intake";
import DetailedSpaceAnalysis from "@/components/intake/DetailedSpaceAnalysis";
import { useSpaceAnalysis } from "@/lib/spaceAnalysis";
import {
  buildHomeownerLayer,
  buildContractorLayer,
  buildPermitFlag,
  buildAnalysisSections,
  buildReadiness,
  buildProjectTitle,
  groupContractorLinesByTrade,
  type ContractorLine,
  type BriefReadiness,
  type TradeGroup,
} from "@/lib/brief";

const fmtMoney = (v?: number) => (v == null ? "" : v >= 500 ? "$500K+" : `$${v}K`);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground/80">
    {children}
  </span>
);

// ───── Media tile ─────
const MediaTile = ({ m, onOpen }: { m: MediaAsset; onOpen: (m: MediaAsset) => void }) => {
  const Badge = ({ icon: Icon, label }: { icon: typeof Camera; label: string }) => (
    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80 backdrop-blur">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );

  if (m.kind === "photo" || m.kind === "inspiration") {
    return (
      <button
        onClick={() => onOpen(m)}
        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
      >
        {m.url ? (
          <img src={m.url} alt={m.name} className="h-full w-full object-cover transition-smooth group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-card text-foreground/30">
            <Camera className="h-8 w-8" />
          </div>
        )}
        <Badge icon={m.kind === "photo" ? Camera : Sparkles} label={m.kind === "photo" ? "Photo" : "Inspo"} />
      </button>
    );
  }
  if (m.kind === "video") {
    return (
      <button
        onClick={() => onOpen(m)}
        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-foreground/90 shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
      >
        {m.url ? (
          <video src={m.url} className="h-full w-full object-cover opacity-90" muted playsInline />
        ) : (
          <div className="h-full w-full bg-foreground/80" />
        )}
        <div className="absolute inset-0 grid place-items-center bg-foreground/20">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-background/90 text-foreground shadow-lift transition-smooth group-hover:scale-110">
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </div>
        <Badge icon={Video} label="Walkthrough" />
      </button>
    );
  }
  // floorplan
  const isImage = m.mime?.startsWith("image/");
  return (
    <button
      onClick={() => onOpen(m)}
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
    >
      {isImage && m.url ? (
        <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-card text-foreground/40">
          <Map className="h-10 w-10" />
        </div>
      )}
      <Badge icon={Map} label="Floor plan" />
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

// ───── Annotation affordance ─────
// Sits on every section. Lets the homeowner add a margin note the contractor sees.
const AnnotationBlock = ({
  sectionId,
  value,
  onSave,
  locked,
}: {
  sectionId: string;
  value?: string;
  onSave: (id: string, text: string) => void;
  locked: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => setDraft(value ?? ""), [value]);

  if (value && !open) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/40 p-3">
        <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Your note</p>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground/85">{value}</p>
        </div>
        {!locked && (
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-accent underline-offset-4 hover:underline"
          >
            Edit
          </button>
        )}
      </div>
    );
  }

  if (open) {
    return (
      <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft/30 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Add a note for your contractor</p>
          <button onClick={() => { setOpen(false); setDraft(value ?? ""); }} aria-label="Close">
            <X className="h-3.5 w-3.5 text-foreground/50 hover:text-foreground" />
          </button>
        </div>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="e.g. The lighting matters most to me here…"
          className="mt-2 rounded-lg bg-background text-sm"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setDraft(value ?? ""); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSave(sectionId, draft.trim());
              setOpen(false);
            }}
          >
            Save note
          </Button>
        </div>
      </div>
    );
  }

  if (locked) return null;

  return (
    <button
      onClick={() => setOpen(true)}
      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/55 transition-smooth hover:text-accent"
    >
      <MessageSquarePlus className="h-3.5 w-3.5" />
      Add a note for your contractor
    </button>
  );
};

// ───── Page ─────
const BriefResult = () => {
  const { data, update, addMedia, removeMedia, togglePill } = useIntake();
  const navigate = useNavigate();
  const [open, setOpen] = useState<MediaAsset | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addressPromptOpen, setAddressPromptOpen] = useState(false);

  const homeowner = useMemo(() => buildHomeownerLayer(data), [data]);
  const contractorLines = useMemo(() => buildContractorLayer(data), [data]);
  const tradeGroups = useMemo(() => groupContractorLinesByTrade(contractorLines), [contractorLines]);
  const permit = useMemo(() => buildPermitFlag(data), [data]);
  const heuristicSections = useMemo(() => buildAnalysisSections(data), [data]);

  // If the user already approved Haleo's read on the intake screen and the media
  // hasn't changed since, reuse that snapshot — don't re-run analysis or wait again.
  const currentMediaKey = useMemo(
    () =>
      data.media
        .filter((m) => m.kind === "photo" || m.kind === "floorplan" || m.kind === "video")
        .map((m) => m.id)
        .sort()
        .join(","),
    [data.media],
  );
  const approvedKey = (data.approvedAnalysis?.mediaIds ?? []).slice().sort().join(",");
  const useApproved = Boolean(data.approvedAnalysis && approvedKey === currentMediaKey);

  // Feed the hook an empty media set when we already have an approved snapshot,
  // so it short-circuits to "idle" and never re-uploads or re-invokes the model.
  const hookIntake = useApproved ? { ...data, media: [] } : data;
  const { status: liveStatus, analysis: liveAnalysis, error: analysisError } = useSpaceAnalysis(hookIntake);

  const analysisStatus = useApproved ? ("ready" as const) : liveStatus;
  const analysis = useApproved
    ? { summary: data.approvedAnalysis!.summary, sections: data.approvedAnalysis!.sections }
    : liveAnalysis;

  // Prefer AI-grounded sections when ready; fall back to heuristic in the meantime.
  const sections = analysis?.sections?.length ? analysis.sections : heuristicSections;
  const readiness = useMemo(() => buildReadiness(data), [data]);
  const projectTitle = useMemo(() => buildProjectTitle(data), [data]);

  useEffect(() => {
    setApproved(false);
    setLineEdits({});
  }, [contractorLines]);

  const spaceMedia = data.media.filter((m) => m.kind !== "inspiration");
  const inspirationMedia = data.media.filter((m) => m.kind === "inspiration");
  const annotations = data.annotations ?? {};
  const saveAnnotation = (id: string, text: string) => {
    const next = { ...annotations };
    if (text) next[id] = text;
    else delete next[id];
    update({ annotations: next });
  };

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

  // Address is required to pull permit + neighborhood intel for contractors.
  // If the homeowner skipped or never entered it, prompt before sending.
  const hasAddress = Boolean(data.address?.city && !data.address?.skipped);
  const handleApproveAndSend = () => {
    if (!hasAddress) {
      setAddressPromptOpen(true);
      return;
    }
    setApproved(true);
    navigate("/contractors");
  };

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

      <main className="container max-w-5xl py-8 md:py-12">
        {/* ────────── HERO — quick, warm, oriented ────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{projectTitle.sub}</p>
          <h1 className="mt-3 font-display text-3xl font-light leading-tight text-balance md:text-4xl">
            {projectTitle.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Here's everything in one place. Skim it, tweak anything, then share.
          </p>
        </motion.div>

        {/* ────────── AT-A-GLANCE STRIP — the only summary you need ────────── */}
        <ExecSummary
          data={data}
          budgetLabel={budgetLabel}
          timelineLabel={timelineLabel}
          permit={permit}
          spaceMediaCount={spaceMedia.length}
          inspirationCount={inspirationMedia.length}
          tradeCount={tradeGroups.length}
          approved={approved}
          onApprove={() => setApproved((v) => !v)}
          onEdit={() => setEditOpen(true)}
        />

        {/* Friendly readiness — tucked under summary */}
        <ReadinessBar readiness={readiness} onAdd={() => setEditOpen(true)} />

        {/* ────────── TWO CLEAR LAYERS ──────────
            LAYER 1 → "What you shared" (homeowner intake — vision, space, inspiration)
            LAYER 2 → "What contractors see" (scope of work + permit) */}
        <div className="mt-10 grid gap-6 md:grid-cols-[200px_1fr] md:gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sticky two-tab nav */}
          <BriefTOC
            sections={[
              { id: "yours", no: "01", label: "What you shared", icon: HomeIcon, meta: `${spaceMedia.length + inspirationMedia.length} file${spaceMedia.length + inspirationMedia.length === 1 ? "" : "s"}` },
              { id: "contractor", no: "02", label: "For your contractor", icon: Hammer, meta: `${tradeGroups.length} trade${tradeGroups.length === 1 ? "" : "s"}` },
            ]}
          />

          {/* Right column: the actual brief */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
          >
            {/* ════════════ LAYER 1: WHAT YOU SHARED ════════════ */}
            <section id="brief-yours" className="scroll-mt-24">
              <LayerHeader
                eyebrow="What you shared"
                title="Your project, in your words"
                sub="Everything you told us during intake — collected in one place."
              />

              {/* Vision — warm callout, not a giant pull-quote */}
              <div className="border-b border-border px-6 py-6 md:px-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">In your words</p>
                <div className="mt-3 rounded-2xl border-l-2 border-accent bg-accent-soft/30 px-5 py-4">
                  <p className="font-display text-base leading-relaxed text-foreground/90 md:text-lg">
                    "{homeowner}"
                  </p>
                </div>
                {data.notes && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p className="text-sm leading-relaxed text-foreground/80">{data.notes}</p>
                  </div>
                )}
              </div>

              {/* Photos / video / measurements */}
              {(spaceMedia.length > 0 || data.measurements || data.dimensions) && (
                <div className="border-b border-border px-6 py-6 md:px-10">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-base font-medium">Photos &amp; walkthrough</p>
                    {spaceMedia.length > 0 && (
                      <span className="text-xs text-muted-foreground">{spaceMedia.length} file{spaceMedia.length > 1 ? "s" : ""} · tap to enlarge</span>
                    )}
                  </div>
                  {spaceMedia.length > 0 && (
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                      {spaceMedia.map((m) => (
                        <MediaTile key={m.id} m={m} onOpen={setOpen} />
                      ))}
                    </div>
                  )}
                  {(data.measurements || data.dimensions) && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-foreground/75">
                      <Ruler className="h-3.5 w-3.5 text-accent" />
                      {data.dimensions
                        ? `${data.dimensions.length ?? "?"} × ${data.dimensions.width ?? "?"} ${data.dimensions.unit}${data.dimensions.height ? ` · ${data.dimensions.height} ${data.dimensions.unit} ceiling` : ""}`
                        : data.measurements}
                    </div>
                  )}
                </div>
              )}

              {/* Inspiration */}
              {inspirationMedia.length > 0 && (
                <div className="border-b border-border px-6 py-6 md:px-10">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-base font-medium">The look you're after</p>
                    <span className="text-xs text-muted-foreground">{inspirationMedia.length} ref{inspirationMedia.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
                    {inspirationMedia.map((m) => (
                      <MediaTile key={m.id} m={m} onOpen={setOpen} />
                    ))}
                  </div>
                </div>
              )}

              {/* Project details — compact key/value */}
              <div className="px-6 py-6 md:px-10">
                <p className="font-display text-base font-medium">Project details</p>
                <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <KV label="Room" value={data.room ? ROOM_LABELS[data.room] : "—"} />
                  <KV label="Project type" value={
                    data.scope === "refresh" ? "Design refresh"
                    : data.scope === "remodel" ? "Full remodel"
                    : data.scope === "reconfigure" ? "Reconfigure"
                    : data.scope === "structural" ? "Add space"
                    : "—"
                  } />
                  <KV label="Budget" value={budgetLabel} />
                  <KV label="Timeline" value={timelineLabel} />
                  <KV
                    label="Address"
                    value={
                      data.address?.skipped || !data.address?.city
                        ? "Not shared"
                        : [data.address.city, data.address.state].filter(Boolean).join(", ")
                    }
                  />
                  <KV
                    label="Things bugging you"
                    value={data.painPoints.length > 0 ? data.painPoints.join(" · ") : "—"}
                  />
                </dl>
                <AnnotationBlock
                  sectionId="vision"
                  value={annotations.vision}
                  onSave={saveAnnotation}
                  locked={approved}
                />
              </div>
            </section>

            {/* ════════════ LAYER 2: FOR YOUR CONTRACTOR ════════════ */}
            <section id="brief-contractor" className="scroll-mt-24 border-t-8 border-secondary/60 bg-secondary/15">
              <LayerHeader
                eyebrow="For your contractor"
                title="What they need to bid"
                sub="Scope of work grouped by trade, plus permit signals — every line tagged so nothing is fabricated."
              />

              {/* Scope of work */}
              <div className="border-b border-border px-6 py-6 md:px-10">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-display text-base font-medium">Scope of work</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-foreground/60">
                    <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-sage" /> From you</span>
                    <span className="inline-flex items-center gap-1"><AlertCircle className="h-3 w-3 text-accent" /> Verify on site</span>
                    <span className="inline-flex items-center gap-1"><HelpCircle className="h-3 w-3 text-foreground/50" /> Open question</span>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {tradeGroups.map((group) => (
                    <TradeGroupCard
                      key={group.trade}
                      group={group}
                      startIndex={contractorLines.indexOf(group.lines[0])}
                      contractorLines={contractorLines}
                      approved={approved}
                      editingIdx={editingIdx}
                      setEditingIdx={setEditingIdx}
                      lineEdits={lineEdits}
                      setLineEdits={setLineEdits}
                    />
                  ))}
                </div>
                <AnnotationBlock
                  sectionId="scope"
                  value={annotations.scope}
                  onSave={saveAnnotation}
                  locked={approved}
                />
              </div>

              {/* Permit */}
              <div className="border-b border-border px-6 py-6 md:px-10">
                <p className="font-display text-base font-medium">Permit &amp; jurisdiction</p>
                <div className="mt-3 flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${permit.likely ? "bg-accent-soft text-accent" : "bg-sage-soft text-sage"}`}>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {permit.likely ? "Permit likely required" : "Probably permit-exempt"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{permit.reason}</p>
                  </div>
                </div>
                <AnnotationBlock
                  sectionId="permit"
                  value={annotations.permit}
                  onSave={saveAnnotation}
                  locked={approved}
                />
              </div>

            </section>

          </motion.article>
        </div>

        {/* Actions — one primary path, one quiet escape hatch */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <Button
            size="lg"
            className="rounded-full sm:flex-1"
            onClick={handleApproveAndSend}
          >
            {approved ? <ShieldCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            Approve and send to contractors
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full sm:w-auto"
            onClick={() => setEditOpen(true)}
          >
            <Edit3 className="h-4 w-4" />
            Edit brief
          </Button>
        </motion.div>

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
      <AddressPromptDialog
        open={addressPromptOpen}
        initial={data.address}
        onClose={() => setAddressPromptOpen(false)}
        onSave={(addr) => {
          update({ address: { ...addr, skipped: false } });
          setAddressPromptOpen(false);
          setApproved(true);
          navigate("/contractors");
        }}
        onSkip={() => {
          update({ address: { ...(data.address ?? {}), skipped: true } });
          setAddressPromptOpen(false);
          setApproved(true);
          navigate("/contractors");
        }}
      />
    </div>
  );
};

// ───── Section heading (numbered, document-style) ─────
const SectionHeading = ({
  no,
  title,
  subtitle,
  icon: Icon,
  meta,
}: {
  no: string;
  title: string;
  subtitle?: string;
  icon?: typeof FileText;
  meta?: string;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="font-mono text-[10px] tracking-[0.2em] text-accent">{no}</p>
      <div className="mt-1 flex items-center gap-2">
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <p className="font-display text-xl font-medium leading-tight text-foreground md:text-2xl">{title}</p>
      </div>
      {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
    {meta && (
      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/65">
        {meta}
      </span>
    )}
  </div>
);

// ───── Quiet at-a-glance strip ─────
// Five facts a contractor (or you) needs in 3 seconds. No "Executive summary" label,
// no duplicate stats, no jargon — just the essentials in plain language.
const ExecSummary = ({
  data,
  budgetLabel,
  timelineLabel,
  permit,
  spaceMediaCount,
  inspirationCount,
  tradeCount,
  approved,
  onApprove,
  onEdit,
}: {
  data: IntakeData;
  budgetLabel: string;
  timelineLabel: string;
  permit: { likely: boolean; reason: string };
  spaceMediaCount: number;
  inspirationCount: number;
  tradeCount: number;
  approved: boolean;
  onApprove: () => void;
  onEdit: () => void;
}) => {
  const room = data.room ? ROOM_LABELS[data.room] : "Project";
  const scopeLabel =
    data.scope === "refresh"
      ? "Design refresh"
      : data.scope === "remodel"
        ? "Full remodel"
        : data.scope === "reconfigure"
          ? "Reconfigure"
          : data.scope === "structural"
            ? "Add space"
            : "Scope TBD";

  const Fact = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: typeof FileText;
    label: string;
    value: string;
  }) => (
    <div className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );

  const filesValue =
    spaceMediaCount + inspirationCount === 0
      ? "None yet"
      : `${spaceMediaCount} space${inspirationCount ? `, ${inspirationCount} inspo` : ""}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
      aria-label="At a glance"
    >
      {/* One-line headline */}
      <div className="border-b border-border/70 px-5 py-4 md:px-6">
        <p className="font-display text-base font-medium leading-snug text-foreground md:text-lg">
          {scopeLabel} · {room.toLowerCase()}
          {data.address?.city && !data.address.skipped && (
            <span className="text-muted-foreground"> · {data.address.city}</span>
          )}
        </p>
      </div>

      {/* Five quiet facts in a row */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 py-4 sm:grid-cols-3 md:grid-cols-5 md:px-6">
        <Fact icon={DollarSign} label="Budget" value={budgetLabel} />
        <Fact icon={Calendar} label="Timeline" value={timelineLabel} />
        <Fact icon={ShieldCheck} label="Permit" value={permit.likely ? "Likely" : "Exempt"} />
        <Fact icon={Hammer} label="Trades" value={`${tradeCount}`} />
        <Fact icon={ImageIcon} label="Files" value={filesValue} />
      </div>
    </motion.section>
  );
};

// ───── Layer header — warm intro to each top-level group ─────
const LayerHeader = ({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) => (
  <header className="border-b border-border bg-secondary/30 px-6 py-5 md:px-10">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
    <p className="mt-1.5 font-display text-xl font-medium leading-tight text-foreground md:text-2xl">
      {title}
    </p>
    <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
  </header>
);

// ───── Compact key/value row ─────
const KV = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm leading-snug text-foreground">{value}</dd>
  </div>
);

// ───── Brief table of contents — the feedforward nav ─────
// Sticky on desktop, horizontal scroll on mobile. Tells the user what's coming
// before they scroll, with live counts/state next to each section.
type TOCItem = {
  id: string;
  no: string;
  label: string;
  icon: typeof FileText;
  meta?: string;
};

const BriefTOC = ({ sections }: { sections: TOCItem[] }) => {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  // Track which section is in view as the user scrolls.
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sections.forEach((s) => {
      const el = document.getElementById(`brief-${s.id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(s.id);
        },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  const handleClick = (id: string) => {
    document.getElementById(`brief-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label="Brief sections" className="md:sticky md:top-24 md:self-start">
      {/* Mobile: horizontal pill scroll */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {sections.map((s) => {
          const isActive = active === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => handleClick(s.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth ${
                isActive
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card text-foreground/70"
              }`}
            >
              <Icon className="h-3 w-3" />
              {s.label}
              {s.meta && <span className="opacity-70">· {s.meta}</span>}
            </button>
          );
        })}
      </div>

      {/* Desktop: vertical TOC */}
      <div className="hidden rounded-2xl border border-border bg-card/70 p-3 shadow-soft md:block">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          On this page
        </p>
        <ul className="space-y-0.5">
          {sections.map((s) => {
            const isActive = active === s.id;
            const Icon = s.icon;
            return (
              <li key={s.id}>
                <button
                  onClick={() => handleClick(s.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-smooth ${
                    isActive ? "bg-accent-soft" : "hover:bg-secondary/60"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-smooth ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-foreground/60 group-hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground">{s.no}</p>
                    <p className={`truncate text-[13px] font-medium ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                      {s.label}
                    </p>
                  </div>
                  {s.meta && (
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {s.meta}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

// ───── Trade group — collapsible scope-of-work block, like a real GC bid sheet ─────
const TradeGroupCard = ({
  group,
  contractorLines,
  approved,
  editingIdx,
  setEditingIdx,
  lineEdits,
  setLineEdits,
}: {
  group: TradeGroup;
  startIndex: number; // unused, kept for caller symmetry
  contractorLines: ContractorLine[];
  approved: boolean;
  editingIdx: number | null;
  setEditingIdx: (n: number | null) => void;
  lineEdits: Record<number, string>;
  setLineEdits: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}) => {
  // Default open for trades that carry real scope; collapsed for "context".
  const [open, setOpen] = useState(group.trade !== "context");
  const count = group.lines.length;
  const grounded = group.lines.filter((l) => l.basis === "grounded").length;
  const inferred = group.lines.filter((l) => l.basis === "inferred").length;
  const questions = group.lines.filter((l) => l.basis === "question").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-smooth hover:bg-secondary/40"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold tabular-nums text-accent">
            {count}
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold leading-tight text-foreground">
              {group.meta.label}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{group.meta.blurb}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/55 sm:inline-flex">
            {grounded > 0 && <span className="inline-flex items-center gap-0.5"><Check className="h-3 w-3 text-sage" />{grounded}</span>}
            {inferred > 0 && <span className="inline-flex items-center gap-0.5"><AlertCircle className="h-3 w-3 text-accent" />{inferred}</span>}
            {questions > 0 && <span className="inline-flex items-center gap-0.5"><HelpCircle className="h-3 w-3 text-foreground/50" />{questions}</span>}
          </span>
          <ChevronDown className={`h-4 w-4 text-foreground/50 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border"
          >
            {group.lines.map((line) => {
              const i = contractorLines.indexOf(line);
              const text = lineEdits[i] ?? line.text;
              return (
                <li key={i} className="group border-b border-border/60 px-4 py-3 last:border-b-0">
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
                      value={text}
                      onChange={(e) => setLineEdits((s) => ({ ...s, [i]: e.target.value }))}
                      onBlur={() => setEditingIdx(null)}
                      rows={2}
                      className="mt-2 rounded-lg bg-background font-mono text-[13px]"
                    />
                  ) : (
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{text}</p>
                  )}
                  {line.source && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Source: {line.source}
                    </p>
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

// ───── How complete is your brief — friendly checklist + one clear next step ─────
// Visual language: warm, conversational, low-chrome. Talks to the user like a
// helpful guide, not a form. Score numbers are de-emphasized in favor of plain
// language ("Just getting started" / "Good to share" / "Ready for contractors").
const TIER_META: Record<
  BriefReadiness["level"],
  { label: string; sub: string; nextLabel: string | null; toneCls: string; dotCls: string }
> = {
  draft: {
    label: "Just getting started",
    sub: "A few more details and your brief really starts working for you.",
    nextLabel: "Good to share",
    toneCls: "text-foreground",
    dotCls: "bg-foreground/30",
  },
  shareable: {
    label: "Good to share",
    sub: "Solid enough to start a conversation. A little more and contractors can bid confidently.",
    nextLabel: "Ready for contractors",
    toneCls: "text-accent",
    dotCls: "bg-accent",
  },
  biddable: {
    label: "Ready for contractors",
    sub: "There's enough here for a contractor to quote with confidence.",
    nextLabel: null,
    toneCls: "text-sage",
    dotCls: "bg-sage",
  },
};

const ReadinessBar = ({
  readiness,
  onAdd,
}: {
  readiness: BriefReadiness;
  onAdd: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_META[readiness.level];
  // Suggest the highest-impact missing item first.
  const topMissing = [...readiness.missing].sort((a, b) => b.weight - a.weight)[0];
  const totalChecks = readiness.have.length + readiness.missing.length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/80 shadow-soft"
      aria-label="How complete your brief is"
    >
      {/* Header — plain language, no jargon */}
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-6 md:p-6">
        <div className="flex items-start gap-3 md:max-w-sm">
          <span
            className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tier.dotCls}`}
            aria-hidden
          />
          <div className="leading-snug">
            <p className={`font-display text-lg font-medium ${tier.toneCls}`}>
              {tier.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{tier.sub}</p>
          </div>
        </div>

        {/* Progress — soft, not a graded report card */}
        <div className="flex-1 md:max-w-md">
          <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{readiness.have.length}</span> of {totalChecks} added
            </span>
            {tier.nextLabel && (
              <span>
                Next up: <span className="text-foreground">{tier.nextLabel}</span>
              </span>
            )}
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/8">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${readiness.score}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>
        </div>

        {/* CTA — one suggestion at a time */}
        <div className="md:ml-auto">
          {topMissing ? (
            <Button
              onClick={onAdd}
              size="sm"
              className="w-full rounded-full md:w-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Add {topMissing.label.toLowerCase()}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-xs font-medium text-sage">
              <Check className="h-3.5 w-3.5" /> Nothing left to add
            </span>
          )}
        </div>
      </div>

      {/* Subtle reveal — the full checklist for those who want it */}
      <div className="border-t border-border/60">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-xs font-medium text-muted-foreground transition-smooth hover:bg-foreground/5 hover:text-foreground md:px-6"
          aria-expanded={expanded}
        >
          <span>{expanded ? "Hide the full checklist" : "See everything we look at"}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid gap-6 px-5 pb-5 pt-1 md:grid-cols-2 md:px-6 md:pb-6">
                {/* Already in your brief */}
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Already in your brief
                  </p>
                  {readiness.have.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing yet — pick something on the right to start.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {readiness.have.map((h) => (
                        <li key={h.label} className="flex items-start gap-2 text-sm text-foreground/85">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                          <span>{h.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Things that would help */}
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Things that would help
                  </p>
                  {readiness.missing.length === 0 ? (
                    <p className="text-sm text-sage">All set — nothing else needed.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {[...readiness.missing]
                        .sort((a, b) => b.weight - a.weight)
                        .map((m) => (
                          <li key={m.label} className="flex items-start gap-2 text-sm">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60"
                              aria-hidden
                            />
                            <div className="leading-snug">
                              <p className="text-foreground/90">{m.label}</p>
                              <p className="text-xs text-muted-foreground">{m.nudge}</p>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};

export default BriefResult;
