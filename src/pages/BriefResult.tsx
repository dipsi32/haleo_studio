import { useMemo, useState } from "react";
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
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ROOM_LABELS, useIntake, hasKind, type IntakeData, type MediaAsset } from "@/lib/intake";

const fmtMoney = (v?: number) => (v == null ? "" : v >= 500 ? "$500K+" : `$${v}K`);

const buildHomeownerLayer = (d: IntakeData): string => {
  const room = d.room ? ROOM_LABELS[d.room].toLowerCase() : "space";
  const pains = d.painPoints.slice(0, 3).map((p) => p.toLowerCase());
  const vibes = d.vibes.slice(0, 2).map((v) => v.toLowerCase());

  const painsLine =
    pains.length > 0
      ? `It's ${pains.join(", ").replace(/, ([^,]*)$/, " and $1")}.`
      : "It just hasn't worked the way we live.";
  const vibeLine =
    vibes.length > 0
      ? `We want it to feel ${vibes.join(" and ")} — somewhere we actually want to spend time.`
      : "We want it to feel like ours, finally.";

  const opener =
    d.room === "addition"
      ? "We're adding on to our home."
      : d.room === "full-home"
        ? "We're remodeling our whole home."
        : `We're remodeling the ${room}.`;

  return `${opener} ${painsLine} ${vibeLine}`;
};

const buildContractorLayer = (d: IntakeData): string[] => {
  const lines: string[] = [];
  if (d.room === "kitchen") {
    lines.push("Full kitchen gut renovation. Removal of non-load-bearing partition between kitchen and dining (verify framing).");
    if (d.painPoints.includes("No island")) lines.push("New island addition with plumbing rough-in and electrical for prep zone.");
    if (d.painPoints.includes("Too dark") || d.painPoints.includes("Poor lighting"))
      lines.push("Recessed lighting redesign — estimated 12–15 cans across 2–3 zones, dimmer-controlled.");
    if (d.painPoints.includes("Dated cabinets") || d.painPoints.includes("No storage"))
      lines.push("Full cabinet replacement; countertop template post-install (stone or quartz TBD).");
    if (d.painPoints.includes("Appliances need upgrading"))
      lines.push("Appliance upgrade: 36\" range, built-in refrigerator, panel-ready dishwasher.");
  } else if (d.room === "bathroom") {
    lines.push("Full bathroom gut renovation. New waterproofing membrane, tile setting, fixture rough-ins.");
    if (d.painPoints.includes("Tiny shower") || d.painPoints.includes("No bathtub"))
      lines.push("Reconfigure wet area: enlarge shower footprint and/or add freestanding tub w/ supply lines.");
    if (d.painPoints.includes("Single vanity")) lines.push("Double vanity install — verify min 60\" width, dual P-traps, GFCI to code.");
    if (d.painPoints.includes("Bad ventilation")) lines.push("New 110+ CFM ducted exhaust fan, humidity-sensing.");
  } else if (d.room === "addition") {
    lines.push(
      `New ${d.additionType ?? "structure"} addition, approximately ${d.additionSize ?? "TBD"} sq ft, on ${
        d.additionLocation ?? "site"
      } elevation.`,
    );
    lines.push("Foundation, framing, roof tie-in, MEP rough-in, insulation, and finishes — full scope.");
    lines.push("Structural and energy compliance (Title 24) calcs required at permit submission.");
  } else if (d.room === "full-home") {
    lines.push("Whole-home renovation. Phased approach recommended to maintain habitability.");
    lines.push("Full MEP review, insulation upgrade, finish replacement throughout.");
  } else {
    lines.push(`Full ${d.room ?? "room"} renovation. Surface and finish replacement, electrical and lighting upgrades as scoped.`);
  }
  if (d.painPoints.includes("Bad flow") || d.painPoints.includes("Layout doesn't work"))
    lines.push("Layout reconfiguration — confirm load paths, headers may be required.");
  return lines;
};

const buildPermitFlag = (d: IntakeData): { likely: boolean; reason: string } => {
  const heavy =
    d.room === "addition" ||
    d.room === "full-home" ||
    d.painPoints.includes("Layout doesn't work") ||
    d.painPoints.includes("Bad flow") ||
    d.painPoints.includes("No island");
  return heavy
    ? { likely: true, reason: "Structural or MEP changes typically require San Jose permits." }
    : { likely: false, reason: "Mostly cosmetic — likely permit-exempt, but always verify with your contractor." };
};

const buildSpaceAnalysis = (d: IntakeData): string[] => {
  const notes: string[] = [];
  const room = d.room ? ROOM_LABELS[d.room].toLowerCase() : "space";

  if (hasKind(d, "video")) {
    notes.push(
      `Walkthrough video gives your contractor a real read on flow, ceiling height, and natural light in the ${room} — far more useful than a static photo.`,
    );
  }
  if (hasKind(d, "photo")) {
    const n = d.media.filter((m) => m.kind === "photo").length;
    notes.push(
      `${n} reference photo${n > 1 ? "s" : ""} pin down the exact finishes and trouble spots you flagged — no guessing on materials or condition.`,
    );
  }
  if (hasKind(d, "floorplan")) {
    notes.push(
      `Floor plan lets us validate dimensions against the scope. Layout changes can be priced confidently.`,
    );
  }
  if (d.measurements && d.measurements.trim().length > 0) {
    notes.push(
      `Your measurements ("${d.measurements.trim().slice(0, 120)}${d.measurements.length > 120 ? "…" : ""}") anchor the brief in real dimensions, even without a formal plan.`,
    );
  }

  if (d.painPoints.includes("Too dark") || d.painPoints.includes("Poor lighting") || d.painPoints.includes("No natural light")) {
    notes.push("Lighting is a recurring concern — expect any fair bid to include a lighting plan, not just a fixture count.");
  }
  if (d.painPoints.includes("Cramped") || d.painPoints.includes("Layout doesn't work") || d.painPoints.includes("Bad flow")) {
    notes.push("Layout pain points usually mean wall removal or relocation — confirm a structural review is in scope.");
  }
  if (d.painPoints.includes("No storage") || d.painPoints.includes("Not enough storage") || d.painPoints.includes("No closet space")) {
    notes.push("Storage is called out — built-ins and millwork should be itemized separately from cabinetry, not bundled.");
  }

  if (notes.length === 0) {
    notes.push("Add a quick walkthrough video or a few photos and we'll sharpen this analysis with specific observations.");
  }
  return notes.slice(0, 4);
};

// Haleo Confidence — what makes THIS brief strong, in vision-doc voice.
const buildConfidence = (d: IntakeData): { score: number; reasons: string[] } => {
  let score = 40;
  const reasons: string[] = [];
  if (d.room) {
    score += 10;
    reasons.push("Scope is room-specific");
  }
  if (hasKind(d, "video")) {
    score += 18;
    reasons.push("Walkthrough video on file");
  }
  if (hasKind(d, "photo")) {
    score += 8;
    reasons.push("Reference photos attached");
  }
  if (hasKind(d, "floorplan")) {
    score += 10;
    reasons.push("Floor plan validates dimensions");
  }
  if (d.measurements && d.measurements.trim().length > 0) {
    score += 6;
    reasons.push("Rough measurements captured");
  }
  if (d.painPoints.length >= 3) {
    score += 6;
    reasons.push("Pain points clearly named");
  }
  if (d.vibes.length >= 2) {
    score += 6;
    reasons.push("Vibe direction is concrete");
  }
  if (!d.budgetSkipped && d.budgetMin) {
    score += 6;
    reasons.push("Budget range set");
  }
  if (d.timeline) {
    score += 4;
    reasons.push("Timeline anchored");
  }
  return { score: Math.min(98, score), reasons: reasons.slice(0, 5) };
};

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground/80">{children}</span>
);

// ───── Media gallery (real thumbnails) ─────
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
  // floorplan
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

const BriefResult = () => {
  const { data } = useIntake();
  const [showContractor, setShowContractor] = useState(false);
  const [open, setOpen] = useState<MediaAsset | null>(null);

  const homeowner = useMemo(() => buildHomeownerLayer(data), [data]);
  const contractor = useMemo(() => buildContractorLayer(data), [data]);
  const permit = useMemo(() => buildPermitFlag(data), [data]);
  const analysis = useMemo(() => buildSpaceAnalysis(data), [data]);
  const confidence = useMemo(() => buildConfidence(data), [data]);

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
          : "Exploring";

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link to="/brief" className="text-sm text-muted-foreground transition-smooth hover:text-foreground">
            Edit brief
          </Link>
        </div>
      </header>

      <main className="container max-w-4xl py-12 md:py-20">
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

        {/* Brief card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
        >
          <div className="grid items-center gap-3 border-b border-border bg-secondary/30 px-6 py-4 sm:grid-cols-[1fr_auto] md:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium">Your brief</p>
                <p className="text-xs text-muted-foreground">Both layers below — toggle the lens.</p>
              </div>
            </div>
            <button
              onClick={() => setShowContractor((v) => !v)}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-smooth hover:bg-accent"
            >
              {showContractor ? "Show how you said it" : "See how contractors read this"}
              <ChevronRight
                className={`h-4 w-4 transition-smooth ${showContractor ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
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

            <div className="relative bg-secondary/40 p-6 md:p-10">
              <p className="text-[11px] uppercase tracking-wider text-accent">For your contractor</p>
              <AnimatePresence mode="wait">
                {showContractor ? (
                  <motion.ul
                    key="reveal"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-3 space-y-3"
                  >
                    {contractor.map((line, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="flex items-start gap-3 font-mono text-[13px] leading-relaxed text-foreground/85"
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {line}
                      </motion.li>
                    ))}
                  </motion.ul>
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
                      <p className="font-display text-base font-medium">
                        Reveal the contractor translation
                      </p>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        The same vision, in language they can bid on.
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

        {/* Haleo Confidence strip */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 overflow-hidden rounded-3xl border border-border bg-foreground p-6 text-background md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex items-center gap-5">
              <div className="relative grid h-20 w-20 place-items-center rounded-full border border-background/20">
                <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="hsl(var(--background) / 0.2)" strokeWidth="4" fill="none" />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="hsl(var(--accent))"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - confidence.score / 100) }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  />
                </svg>
                <span className="font-display text-2xl font-medium tabular-nums">{confidence.score}</span>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Haleo Confidence</p>
                <p className="mt-1 font-display text-xl font-light leading-snug">
                  Strong enough for contractors to bid on the same scope.
                </p>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {confidence.reasons.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-background/85">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Space snapshot — REAL thumbnails of everything shared */}
        {(spaceMedia.length > 0 || data.measurements) && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium">Space snapshot</p>
                <p className="text-xs text-muted-foreground">Everything you shared, attached to the brief.</p>
              </div>
            </div>

            {spaceMedia.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spaceMedia.map((m) => (
                  <MediaTile key={m.id} m={m} onOpen={setOpen} />
                ))}
              </div>
            )}

            {data.measurements && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Ruler className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-medium">Measurements</p>
                  <p className="text-xs text-foreground/70">{data.measurements}</p>
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Inspiration gallery */}
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

        {/* Space analysis */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 rounded-3xl border border-border bg-secondary/30 p-6 md:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-base font-medium">Space analysis</p>
              <p className="text-xs text-muted-foreground">What your media tells us before any contractor walks in.</p>
            </div>
          </div>
          <ul className="mt-6 space-y-3">
            {analysis.map((line, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {line}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 grid gap-3 sm:grid-cols-3"
        >
          <Button size="lg" className="rounded-full" disabled>
            <Send className="h-4 w-4" />
            Send to contractor
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" disabled>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" asChild>
            <Link to="/brief">
              <Edit3 className="h-4 w-4" />
              Edit brief
            </Link>
          </Button>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sending and PDF export come online when Lovable Cloud is enabled.
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
    </div>
  );
};

export default BriefResult;
