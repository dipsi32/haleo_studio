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
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EditBriefDrawer from "@/components/EditBriefDrawer";
import { ROOM_LABELS, useIntake, type MediaAsset, type IntakeData } from "@/lib/intake";
import DetailedSpaceAnalysis from "@/components/intake/DetailedSpaceAnalysis";
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
  const [open, setOpen] = useState<MediaAsset | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const homeowner = useMemo(() => buildHomeownerLayer(data), [data]);
  const contractorLines = useMemo(() => buildContractorLayer(data), [data]);
  const tradeGroups = useMemo(() => groupContractorLinesByTrade(contractorLines), [contractorLines]);
  const permit = useMemo(() => buildPermitFlag(data), [data]);
  const sections = useMemo(() => buildAnalysisSections(data), [data]);
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

      <main className="container max-w-4xl py-10 md:py-14">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{projectTitle.sub}</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
            {projectTitle.title}
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Everything a contractor needs to bid — at a glance, with the details one tap away.
          </p>
          <div className="mt-5">
            <Button size="sm" className="rounded-full" disabled={!approved}>
              <Send className="h-4 w-4" />
              {approved ? "Share with contractor" : "Approve below to share"}
            </Button>
          </div>
        </motion.div>

        {/* ───── Readiness action bar — distinct from the brief, framed as YOUR action ───── */}
        <ReadinessBar readiness={readiness} onAdd={() => setEditOpen(true)} />

        {/* ═════════ THE 1-PAGER ═════════ */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
        >
          {/* Document header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-6 py-4 md:px-10">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium leading-tight">Project brief</p>
                <p className="text-xs text-muted-foreground">
                  {data.address?.city && !data.address.skipped ? `${data.address.city} · ` : ""}
                  Prepared by Haleo
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${approved ? "bg-sage-soft text-sage" : "bg-accent-soft text-accent"}`}>
              {approved ? <><Lock className="h-3 w-3" /> Approved by homeowner</> : <><AlertCircle className="h-3 w-3" /> Draft — pending approval</>}
            </span>
          </div>

          {/* 1. AT-A-GLANCE */}
          <section className="border-b border-border px-6 py-7 md:px-10 md:py-9">
            <SectionHeading no="01" title="At a glance" />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {data.room && <Pill>{ROOM_LABELS[data.room]}</Pill>}
              {data.scope && (
                <Pill>
                  <Sparkles className="h-3 w-3" />
                  {data.scope === "refresh" ? "Design refresh" : data.scope === "remodel" ? "Full remodel" : data.scope === "reconfigure" ? "Reconfigure" : "Add space"}
                </Pill>
              )}
              <Pill>
                <DollarSign className="h-3 w-3" />
                {budgetLabel}
              </Pill>
              <Pill>
                <Calendar className="h-3 w-3" />
                {timelineLabel}
              </Pill>
              <Pill>
                <ShieldCheck className="h-3 w-3" />
                {permit.likely ? "Permit likely" : "Likely permit-exempt"}
              </Pill>
            </div>
          </section>

          {/* 2. THE VISION (homeowner's voice) */}
          <section className="border-b border-border px-6 py-7 md:px-10 md:py-9">
            <SectionHeading no="02" title="The vision — in their words" />
            <blockquote className="mt-4 border-l-2 border-accent pl-5">
              <p className="font-display text-2xl font-light italic leading-snug text-foreground/90 md:text-3xl">
                "{homeowner}"
              </p>
            </blockquote>
            {data.notes && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary/40 p-4">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p className="text-sm leading-relaxed text-foreground/80">{data.notes}</p>
              </div>
            )}
            <AnnotationBlock
              sectionId="vision"
              value={annotations.vision}
              onSave={saveAnnotation}
              locked={approved}
            />
          </section>

          {/* 3. WHAT THEY SHARED — the visual evidence, big and prominent */}
          {(spaceMedia.length > 0 || data.measurements) && (
            <section className="border-b border-border px-6 py-7 md:px-10 md:py-9">
              <SectionHeading no="03" title="What they shared" subtitle="The space, in their hands. Click any thumbnail to enlarge." />
              {spaceMedia.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {spaceMedia.map((m) => (
                    <MediaTile key={m.id} m={m} onOpen={setOpen} />
                  ))}
                </div>
              )}
              {(data.measurements || data.dimensions) && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <Ruler className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-medium">Measurements</p>
                    <p className="text-xs leading-relaxed text-foreground/70">
                      {data.dimensions
                        ? `${data.dimensions.length ?? "?"} × ${data.dimensions.width ?? "?"} ${data.dimensions.unit}${data.dimensions.height ? ` · ${data.dimensions.height} ${data.dimensions.unit} ceiling` : ""}`
                        : data.measurements}
                    </p>
                  </div>
                </div>
              )}
              <AnnotationBlock
                sectionId="evidence"
                value={annotations.evidence}
                onSave={saveAnnotation}
                locked={approved}
              />
            </section>
          )}

          {/* 4. INSPIRATION */}
          {inspirationMedia.length > 0 && (
            <section className="border-b border-border px-6 py-7 md:px-10 md:py-9">
              <SectionHeading no="04" title="Inspiration" subtitle="The look they're chasing." />
              <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {inspirationMedia.map((m) => (
                  <MediaTile key={m.id} m={m} onOpen={setOpen} />
                ))}
              </div>
              <AnnotationBlock
                sectionId="inspiration"
                value={annotations.inspiration}
                onSave={saveAnnotation}
                locked={approved}
              />
            </section>
          )}

          {/* 5. THE TRANSLATION (scope of work, grouped by trade like a real SOW) */}
          <section className="border-b border-border bg-secondary/20 px-6 py-7 md:px-10 md:py-9">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading no="05" title="Scope of work" subtitle="Grouped by trade. Every line tagged so nothing is fabricated." />
              <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground sm:block">For the contractor</span>
            </div>

            {/* Legend up-front so the chips below make sense */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-foreground/60">
              <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-sage" /> From the homeowner</span>
              <span className="inline-flex items-center gap-1"><AlertCircle className="h-3 w-3 text-accent" /> Inferred — verify on site</span>
              <span className="inline-flex items-center gap-1"><HelpCircle className="h-3 w-3 text-foreground/50" /> Open question</span>
            </div>

            <div className="mt-5 space-y-3">
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
          </section>

          {/* 6. PERMIT FLAG */}
          <section className="border-b border-border px-6 py-7 md:px-10 md:py-9">
            <SectionHeading no="06" title="Permit & jurisdiction" />
            <div className="mt-4 flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${permit.likely ? "bg-accent-soft text-accent" : "bg-sage-soft text-sage"}`}>
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-base font-medium">
                  {permit.likely ? "Permit likely required" : "Probably permit-exempt"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{permit.reason}</p>
              </div>
            </div>
            <AnnotationBlock
              sectionId="permit"
              value={annotations.permit}
              onSave={saveAnnotation}
              locked={approved}
            />
          </section>

          {/* 7. CONTRACTOR'S DEEP READ — collapsed by default to keep the 1-pager scannable */}
          <section className="px-6 py-7 md:px-10 md:py-9">
            <button
              onClick={() => setShowAnalysis((v) => !v)}
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={showAnalysis}
            >
              <div>
                <SectionHeading no="07" title="Deep read for the contractor" subtitle="Structure, finishes, constraints, opportunities, code — the way a GC actually scans a project." />
              </div>
              <ChevronDown className={`h-5 w-5 shrink-0 text-foreground/50 transition-transform ${showAnalysis ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {showAnalysis && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-5">
                    <DetailedSpaceAnalysis sections={sections} />
                  </div>
                  <AnnotationBlock
                    sectionId="analysis"
                    value={annotations.analysis}
                    onSave={saveAnnotation}
                    locked={approved}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Document footer — approve & lock */}
          <div className="flex flex-col gap-4 border-t border-border bg-secondary/30 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${approved ? "bg-sage text-background" : "bg-accent text-accent-foreground"}`}>
                {approved ? <Lock className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </div>
              <div>
                <p className="font-display text-sm font-medium">
                  {approved ? "Brief approved" : "Approve before sending"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {approved
                    ? "Locked. Unlock above to make edits."
                    : "Read every line, edit anything you want, then approve."}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setApproved((v) => !v)}
              variant={approved ? "outline" : "default"}
              className="rounded-full"
            >
              {approved ? <><Pencil className="h-3.5 w-3.5" /> Unlock to edit</> : <><Lock className="h-3.5 w-3.5" /> Approve & lock</>}
            </Button>
          </div>
        </motion.article>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 grid gap-3 sm:grid-cols-3"
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

// ───── Section heading (numbered, document-style) ─────
const SectionHeading = ({ no, title, subtitle }: { no: string; title: string; subtitle?: string }) => (
  <div>
    <p className="font-mono text-[10px] tracking-[0.2em] text-accent">{no}</p>
    <p className="mt-1 font-display text-xl font-medium leading-tight text-foreground md:text-2xl">{title}</p>
    {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
  </div>
);

// ───── Brief Readiness — slim ACTION bar (not a card competing with the brief) ─────
// Visual language: horizontal, low-chrome, looks like a toolbar/affordance, not a document.
const TIER_META: Record<BriefReadiness["level"], { label: string; nextAt: number | null; nextLabel: string | null; toneCls: string }> = {
  draft: { label: "Draft", nextAt: 50, nextLabel: "Shareable", toneCls: "text-foreground/70" },
  shareable: { label: "Shareable", nextAt: 75, nextLabel: "Biddable", toneCls: "text-accent" },
  biddable: { label: "Biddable", nextAt: null, nextLabel: null, toneCls: "text-sage" },
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
  const topMissing = [...readiness.missing].sort((a, b) => b.weight - a.weight)[0];
  const pointsToNext = tier.nextAt != null ? Math.max(0, tier.nextAt - readiness.score) : 0;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 rounded-2xl border border-dashed border-foreground/15 bg-background/60 p-4"
      aria-label="Brief readiness — your action area"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* Status */}
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-foreground/5">
            <Sparkles className={`h-3.5 w-3.5 ${tier.toneCls}`} />
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Brief readiness</p>
            <p className="text-sm font-medium">
              <span className={tier.toneCls}>{tier.label}</span>
              <span className="text-muted-foreground"> · {readiness.score}/100</span>
            </p>
          </div>
        </div>

        {/* Track */}
        <div className="min-w-[140px] flex-1">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${readiness.score}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
            <span className="absolute top-0 h-full w-px bg-background" style={{ left: "50%" }} aria-hidden />
            <span className="absolute top-0 h-full w-px bg-background" style={{ left: "75%" }} aria-hidden />
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Draft</span>
            <span>Shareable</span>
            <span>Biddable</span>
          </div>
        </div>

        {/* CTA */}
        {topMissing ? (
          <Button
            onClick={onAdd}
            size="sm"
            className="shrink-0 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" />
            Add {topMissing.label.toLowerCase()}
            {tier.nextLabel && <span className="ml-1 text-[10px] opacity-80">+{topMissing.weight} → {tier.nextLabel}</span>}
          </Button>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-xs font-medium text-sage">
            <Check className="h-3.5 w-3.5" /> Fully bid-ready
          </span>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-smooth hover:text-foreground"
        >
          {expanded ? "Hide" : "What counts?"}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 grid gap-1 overflow-hidden border-t border-foreground/10 pt-3 sm:grid-cols-2"
          >
            {[
              ...readiness.have.map((h) => ({ ...h, have: true, nudge: "" })),
              ...readiness.missing.map((m) => ({ ...m, have: false })),
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2 px-1 py-1 text-xs">
                {item.have ? (
                  <Check className="h-3 w-3 shrink-0 text-sage" />
                ) : (
                  <span className="grid h-3 w-3 shrink-0 place-items-center rounded-full border border-foreground/30" />
                )}
                <span className={`min-w-0 truncate ${item.have ? "text-foreground/80" : "text-foreground/55"}`}>
                  {item.label}
                </span>
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">+{item.weight}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};

export default BriefResult;
