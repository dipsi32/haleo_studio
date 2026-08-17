import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { saveDraft } from "@/lib/userProjects";
import { track } from "@/lib/analytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Bath,
  Sofa,
  BedDouble,
  Briefcase,
  Home,
  Layers,
  Sparkles,
  Video,
  Camera,
  Map,
  ArrowRight,
  Check,
  X,
  Plus,
  StickyNote,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import IntakeShell from "@/components/IntakeShell";
import PillGroup from "@/components/PillGroup";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import AddressStep from "@/components/intake/AddressStep";
import ScopeBudgetStep from "@/components/intake/ScopeBudgetStep";
import DimensionsInput from "@/components/intake/DimensionsInput";
import ConfirmReadScreen from "@/components/intake/ConfirmReadScreen";
import AdditionFlow from "@/components/intake/AdditionFlow";
import VoiceTextField from "@/components/intake/VoiceTextField";
import { detectProject } from "@/lib/projectDetect";
import {
  ROOM_LABELS,
  PAIN_BY_ROOM,
  painOptionsFor,
  PROJECT_GOALS,
  GOAL_LABELS,
  primaryRoom,
  type ProjectGoal,
  filesToAssets,
  hasKind,
  type Room,
  type AdditionType,
  type AdditionLocation,
  type Timeline,
  type MediaAsset,
  type Dimensions,
  type Address,
  type ScopeTier,
  useIntake,
} from "@/lib/intake";

const ROOM_ICONS: Record<Room, typeof ChefHat> = {
  kitchen: ChefHat,
  bathroom: Bath,
  living: Sofa,
  bedroom: BedDouble,
  office: Briefcase,
  addition: Layers,
  "full-home": Home,
  other: Sparkles,
};

// Five felt-steps. Step 3 ("What Haleo sees") is auto-skipped when there's
// no analyzable media — keeping the flow short for users who skip uploads.
const TOTAL = 5;

const STEP_LABELS = [
  "Your project",
  "Inside look",
  "What Haleo sees",
  "Address",
  "Scope & budget",
];

const ScreenTitle = ({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) => (
  <div className="text-center">
    {eyebrow && (
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
    )}
    <h1 className="mt-3 font-display text-2xl font-light leading-tight text-balance md:text-3xl">
      {title}
    </h1>
    {sub && <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">{sub}</p>}
  </div>
);

const SkipButton = ({ onClick, label = "Skip — I'll add this later" }: { onClick: () => void; label?: string }) => (
  <button
    onClick={onClick}
    className="text-sm text-muted-foreground underline-offset-4 transition-smooth hover:text-foreground hover:underline"
  >
    {label}
  </button>
);

// ───── Feedforward: where you are, how much is left ─────
// Compact, calm, mobile-first. One clear label for the current step,
// a segmented bar that shows progress at a glance, and a quiet "x left" meter.
const StepDots = ({ step }: { step: number }) => {
  const total = STEP_LABELS.length;
  const current = Math.max(1, Math.min(total, step));
  const remaining = total - current;
  const currentLabel = STEP_LABELS[current - 1];

  return (
    <div className="mx-auto max-w-md">
      {/* Top row: where am I */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            Step {current} of {total}
          </p>
          <p className="mt-1 truncate font-display text-base font-medium text-foreground">
            {currentLabel}
          </p>
        </div>
        <p className="shrink-0 text-[11px] font-medium text-muted-foreground">
          {remaining === 0 ? "Last step" : `${remaining} to go`}
        </p>
      </div>

      {/* Segmented progress — five quiet bars, the active one breathes */}
      <div className="mt-3 flex items-center gap-1.5" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${current} of ${total}: ${currentLabel}`}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const isDone = current > n;
          const isActive = current === n;
          return (
            <span key={label} className="relative flex-1 overflow-hidden rounded-full bg-border/70" style={{ height: 4 }}>
              <motion.span
                aria-hidden
                initial={false}
                animate={{
                  width: isDone || isActive ? "100%" : "0%",
                  opacity: isDone ? 1 : isActive ? 0.95 : 0,
                }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: isDone ? i * 0.04 : 0 }}
                className={`absolute inset-y-0 left-0 rounded-full ${isDone ? "bg-accent" : "bg-foreground"}`}
              />
              {isActive && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground/40"
                  initial={{ width: "0%" }}
                  animate={{ width: ["0%", "100%"] }}
                  transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ───── Screen 1: The project — one question, one answer ─────
// Say it (or type it) in your own words. We read it back as chips you can
// correct. The full list is one tap away for anyone who prefers to browse.
const ROOM_CHOICES: Room[] = ["kitchen", "bathroom", "living", "bedroom", "office"];

const ProjectScreen = ({
  rooms,
  goals,
  note,
  onToggleRoom,
  onToggleGoal,
  onNote,
  onContinue,
}: {
  rooms: Room[];
  goals: ProjectGoal[];
  note: string;
  onToggleRoom: (r: Room) => void;
  onToggleGoal: (g: ProjectGoal) => void;
  onNote: (v: string) => void;
  onContinue: () => void;
}) => {
  const [browsing, setBrowsing] = useState(false);
  const picked = rooms.length + goals.length;
  const canContinue = picked > 0 || note.trim().length > 5;

  // Read the sentence back as suggestions — one tap to confirm, never forced.
  const detected = detectProject(note);
  const suggestedRooms = detected.rooms.filter((r) => !rooms.includes(r));
  const suggestedGoals = detected.goals.filter((g) => !goals.includes(g));
  const hasSuggestions = suggestedRooms.length + suggestedGoals.length > 0;

  const Chip = ({
    label,
    active,
    onClick,
    suggestion,
  }: {
    label: string;
    active?: boolean;
    onClick: () => void;
    suggestion?: boolean;
  }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-smooth ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : suggestion
            ? "border-dashed border-accent/60 bg-accent-soft/40 text-foreground hover:bg-accent-soft"
            : "border-border bg-card text-foreground hover:border-accent/50"
      }`}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : suggestion ? <Plus className="h-3.5 w-3.5 text-accent" /> : null}
      {label}
    </button>
  );

  return (
    <div className="space-y-8 pb-28">
      <StepDots step={1} />
      <ScreenTitle
        title="What do you need done?"
        sub="One sentence is enough. We'll figure out the rest."
      />

      <div className="mx-auto max-w-lg">
        <VoiceTextField
          value={note}
          onChange={onNote}
          autoFocus
          placeholder="e.g. Remove and fill in two in-ground pools, permitted."
        />
      </div>

      {/* What we heard */}
      <AnimatePresence initial={false}>
        {(picked > 0 || hasSuggestions) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-auto max-w-lg"
          >
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
              {picked > 0 ? "Your project" : "Sounds like"}
            </p>
            <div className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <Chip key={r} label={ROOM_LABELS[r]} active onClick={() => onToggleRoom(r)} />
              ))}
              {goals.map((g) => (
                <Chip key={g} label={GOAL_LABELS[g]} active onClick={() => onToggleGoal(g)} />
              ))}
              {suggestedRooms.map((r) => (
                <Chip key={`s-${r}`} label={ROOM_LABELS[r]} suggestion onClick={() => onToggleRoom(r)} />
              ))}
              {suggestedGoals.map((g) => (
                <Chip key={`s-${g}`} label={GOAL_LABELS[g]} suggestion onClick={() => onToggleGoal(g)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escape hatch for browsers, collapsed by default */}
      <div className="mx-auto max-w-lg text-center">
        {!browsing ? (
          <button
            onClick={() => setBrowsing(true)}
            className="text-sm text-muted-foreground underline-offset-4 transition-smooth hover:text-foreground hover:underline"
          >
            Rather pick from a list?
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 text-left"
          >
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                Rooms
              </p>
              <div className="flex flex-wrap gap-2">
                {ROOM_CHOICES.map((r) => (
                  <Chip key={r} label={ROOM_LABELS[r]} active={rooms.includes(r)} onClick={() => onToggleRoom(r)} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                Everything else
              </p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_GOALS.map((g) => (
                  <Chip key={g.value} label={g.label} active={goals.includes(g.value)} onClick={() => onToggleGoal(g.value)} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Sticky commit bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {canContinue ? "Looks good — next up, a quick look inside." : "Tell us in a sentence to continue"}
          </p>
          <Button onClick={onContinue} disabled={!canContinue} className="rounded-full px-6">
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};


// ───── Screen 2: Inside look — media + measurements + pain (calmer copy) ─────
const InsideLookScreen = ({
  room,
  goals,
  selected,
  onTogglePain,
  onAddMedia,
  onRemoveMedia,
  media,
  notes,
  dimensions,
  onUpdate,
  onContinue,
  intake,
}: {
  room: Exclude<Room, "addition">;
  goals: ProjectGoal[];
  selected: string[];
  onTogglePain: (v: string) => void;
  onAddMedia: (a: MediaAsset[]) => void;
  onRemoveMedia: (id: string) => void;
  media: MediaAsset[];
  notes?: string;
  dimensions?: Dimensions;
  onUpdate: (p: Partial<import("@/lib/intake").IntakeData>) => void;
  onContinue: () => void;
  intake: import("@/lib/intake").IntakeData;
}) => {
  const videoRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);
  const [extras, setExtras] = useState(
    Boolean(notes || dimensions?.length || dimensions?.width || dimensions?.height),
  );

  const options = painOptionsFor(room, goals).map((p) => ({ value: p, label: p }));

  const captures: {
    kind: MediaAsset["kind"];
    icon: typeof Video;
    label: string;
    hint: string;
    accept: string;
    multiple?: boolean;
    ref: React.RefObject<HTMLInputElement>;
    best?: boolean;
  }[] = [
    {
      kind: "video",
      icon: Video,
      label: "Walkthrough video",
      hint: "Best — a slow 30s pan · up to 90s, 150 MB",
      accept: "video/*",
      ref: videoRef,
      best: true,
    },
    { kind: "photo", icon: Camera, label: "A few photos", hint: "Snap the trouble spots", accept: "image/*", multiple: true, ref: photosRef },
    { kind: "floorplan", icon: Map, label: "Floor plan", hint: "Sketch, PDF, or photo", accept: "image/*,application/pdf", ref: planRef },
  ];

  const handleFiles = (kind: MediaAsset["kind"]) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const assets = await filesToAssets(e.target.files, kind);
    onAddMedia(assets);
    e.target.value = "";
  };

  return (
    <div className="space-y-12">
      <StepDots step={2} />
      <ScreenTitle
        title="Take us inside — only what you're comfortable sharing."
        sub="A short walkthrough or a couple of photos goes a long way. Haleo will read what you share on the next screen."
      />

      {/* Capture grid — real file inputs */}
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {captures.map((c) => {
            const count = media.filter((m) => m.kind === c.kind).length;
            const Icon = c.icon;
            return (
              <div key={c.kind} className="relative">
                <input
                  ref={c.ref}
                  type="file"
                  accept={c.accept}
                  multiple={c.multiple}
                  onChange={handleFiles(c.kind)}
                  className="hidden"
                />
                <button
                  onClick={() => c.ref.current?.click()}
                  className={`group relative flex w-full flex-col items-start gap-3 rounded-2xl border-2 border-dashed bg-card/60 p-5 text-left transition-smooth hover:-translate-y-0.5 hover:border-accent/60 hover:bg-card hover:shadow-lift ${
                    count > 0 ? "border-accent bg-accent-soft/30" : "border-border"
                  }`}
                >
                  {c.best && count === 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      Best
                    </span>
                  )}
                  {count > 0 && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                      <Check className="h-3 w-3" /> {count}
                    </span>
                  )}
                  <div className={`grid h-10 w-10 place-items-center rounded-full transition-smooth ${count > 0 ? "bg-accent text-accent-foreground" : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-accent-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-display text-base font-medium leading-tight">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                </button>
              </div>
            );
          })}
        </div>

        {/* Thumbnails */}
        {media.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex flex-wrap gap-2"
          >
            {media.map((m) => (
              <div
                key={m.id}
                className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-border bg-card p-1.5 pr-3 shadow-soft"
              >
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-secondary">
                  {m.kind === "photo" || m.kind === "inspiration" ? (
                    <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                  ) : m.kind === "video" ? (
                    <Video className="h-4 w-4 text-foreground/60" />
                  ) : (
                    <Map className="h-4 w-4 text-foreground/60" />
                  )}
                </div>
                <span className="max-w-[140px] truncate text-xs text-foreground/80">{m.name}</span>
                <button
                  onClick={() => onRemoveMedia(m.id)}
                  className="ml-1 grid h-5 w-5 place-items-center rounded-full bg-secondary text-foreground/50 transition-smooth hover:bg-destructive hover:text-destructive-foreground"
                  aria-label={`Remove ${m.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {/* Read happens on Step 3. We just hint at it here. */}

        {/* Inline secondary affordance: notes + structured dimensions */}
        {!extras ? (
          <button
            onClick={() => setExtras(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground transition-smooth hover:border-accent/50 hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Or jot rough notes / measurements
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="flex items-center gap-2 font-display text-sm font-medium">
                <StickyNote className="h-4 w-4 text-accent" /> Rough notes
              </label>
              <Textarea
                value={notes ?? ""}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                rows={3}
                placeholder="Anything else worth knowing — quirks, neighbors, what you've already tried…"
                className="mt-2 rounded-xl border-border bg-background text-sm"
              />
            </div>
            <DimensionsInput value={dimensions} onChange={(d) => onUpdate({ dimensions: d })} />
          </motion.div>
        )}
      </div>

      {/* Pain pills */}
      <div>
        <p className="text-center font-display text-2xl font-light text-foreground/90">
          What's bugging you about it?
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Tap as many as ring true. This is for your eyes only first.
        </p>
        <div className="mt-6">
          <PillGroup options={options} selected={selected} onToggle={onTogglePain} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button onClick={onContinue} size="lg" className="rounded-full px-8" disabled={selected.length === 0 && media.length === 0 && !notes && !dimensions?.length}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
        <SkipButton onClick={onContinue} />
      </div>
    </div>
  );
};

// ───── Screen 2 (Addition variant) — three quick taps, auto-advancing ─────
const AdditionScreen = ({
  data,
  onChange,
  onContinue,
}: {
  data: { additionType?: AdditionType; additionSize?: number; additionLocation?: AdditionLocation };
  onChange: (p: Partial<typeof data>) => void;
  onContinue: () => void;
}) => {
  const [sub, setSub] = useState<"type" | "size" | "where">(() => {
    if (!data.additionType) return "type";
    if (!data.additionSize) return "size";
    return "where";
  });

  const types: { value: AdditionType; label: string }[] = [
    { value: "bedroom", label: "New bedroom" },
    { value: "bathroom", label: "New bathroom" },
    { value: "living", label: "New living space" },
    { value: "floor", label: "New floor / storey" },
  ];
  const wheres: { value: AdditionLocation; label: string }[] = [
    { value: "rear", label: "Rear" },
    { value: "side", label: "Side" },
    { value: "above", label: "Above existing" },
    { value: "unsure", label: "Not sure yet" },
  ];

  if (sub === "type") {
    return (
      <div className="space-y-10">
        <StepDots step={2} />
        <ScreenTitle eyebrow="Addition · 1 of 3" title="What are you adding?" />
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                onChange({ additionType: t.value });
                setSub("size");
              }}
              className={`rounded-2xl border bg-card p-6 text-left font-display text-lg font-medium shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift ${
                data.additionType === t.value ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (sub === "size") {
    const size = data.additionSize ?? 300;
    return (
      <div className="space-y-10">
        <StepDots step={2} />
        <ScreenTitle eyebrow="Addition · 2 of 3" title="How big?" sub="Roughly. We'll pin it down with your contractor." />
        <div className="mx-auto max-w-xl space-y-8 rounded-3xl border border-border bg-card p-6 md:p-8 shadow-soft">
          <p className="text-center font-display text-5xl font-medium">
            {size >= 1000 ? "1,000+" : size}
            <span className="ml-2 text-base text-muted-foreground">sq ft</span>
          </p>
          <Slider
            value={[size]}
            min={100}
            max={1000}
            step={50}
            onValueChange={(v) => onChange({ additionSize: v[0] })}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>100</span>
            <span>1,000+</span>
          </div>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => setSub("where")} size="lg" className="rounded-full px-8">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <StepDots step={2} />
      <ScreenTitle eyebrow="Addition · 3 of 3" title="Where?" />
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
        {wheres.map((w) => (
          <button
            key={w.value}
            onClick={() => {
              onChange({ additionLocation: w.value });
              setTimeout(onContinue, 250);
            }}
            className={`rounded-2xl border bg-card p-6 text-left font-display text-lg font-medium shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift ${
              data.additionLocation === w.value ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ───── Screen 3: Address ─────
const AddressScreen = ({
  address,
  onSave,
  onSkip,
  onContinue,
}: {
  address?: Address;
  onSave: (a: Address) => void;
  onSkip: () => void;
  onContinue: () => void;
}) => {
  return (
    <div className="space-y-10">
      <StepDots step={4} />
      <ScreenTitle
        title="Where's the project?"
        sub="The address unlocks real permit history and neighborhood cost intel for your brief."
      />
      <AddressStep
        value={address}
        onSave={onSave}
        onSkip={onSkip}
        onContinue={onContinue}
      />
    </div>
  );
};

// ───── Screen 4: Scope + Budget + Timeline ─────
const ScopeAndBudgetScreen = ({
  scope,
  onScopeChange,
  min,
  max,
  budgetSkipped,
  onBudgetChange,
  onSkipBudget,
  onPickTimeline,
  selectedTimeline,
  address,
  hideScope,
}: {
  scope?: ScopeTier;
  onScopeChange: (s: ScopeTier) => void;
  min?: number;
  max?: number;
  budgetSkipped: boolean;
  onBudgetChange: (m: number, x: number) => void;
  onSkipBudget: () => void;
  onPickTimeline: (t: Timeline) => void;
  selectedTimeline?: Timeline;
  address?: Address;
  hideScope?: boolean;
}) => (
  <div className="space-y-10">
    <StepDots step={5} />
    <ScreenTitle
      title={hideScope ? "Budget and timing." : "Scope, budget, and timing."}
      sub={
        hideScope
          ? "Budget is optional — share if you have one in mind."
          : "Pick the type of project that fits. Budget is optional — share if you have one in mind."
      }
    />
    <ScopeBudgetStep
      scope={scope}
      onScopeChange={onScopeChange}
      budgetMin={min}
      budgetMax={max}
      budgetSkipped={budgetSkipped}
      onBudgetChange={onBudgetChange}
      onSkipBudget={onSkipBudget}
      selectedTimeline={selectedTimeline}
      onPickTimeline={onPickTimeline}
      address={address}
      hideScope={hideScope}
    />
  </div>
);

// ───── Loading ─────
const LoadingPage = () => {
  const lines = [
    "Translating your vision...",
    "Checking permit records...",
    "Pulling your brief together...",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="mt-8 font-display text-2xl font-light text-foreground/80"
          >
            {lines[i]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};

// ───── Main page ─────
const Brief = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, update, togglePill, addMedia, removeMedia, reset } = useIntake();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const projectIdRef = useRef<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem("haleo:active_project_id") : null,
  );

  // Fresh room: nuke ALL prior intake state (measurements, media, scope, etc.)
  // BEFORE the first paint so we never reuse another room's selections.
  // Pattern: ?fresh=1 from Account → "Start a new room".
  const didFresh = useRef(false);
  if (params.get("fresh") === "1" && !didFresh.current) {
    didFresh.current = true;
    reset();
    sessionStorage.removeItem("haleo:active_project_id");
    projectIdRef.current = null;
    // Strip the flag so a refresh doesn't keep wiping the user's progress.
    const next = new URLSearchParams(params);
    next.delete("fresh");
    setParams(next, { replace: true });
  }

  // Auto-save the user's draft as they progress (debounced). Only kicks in
  // once they've picked a room — no point persisting empty shells.
  useEffect(() => {
    if (!data.room) return;
    const t = setTimeout(() => {
      saveDraft(data, projectIdRef.current ?? undefined)
        .then((row) => {
          projectIdRef.current = row.id;
          sessionStorage.setItem("haleo:active_project_id", row.id);
        })
        .catch(() => {/* not signed in or RLS — ignore silently */});
    }, 800);
    return () => clearTimeout(t);
  }, [data]);

  // Analytics: brief_started on mount, brief_step_completed on advance,
  // brief_abandoned if the user leaves before submitting.
  const submittedRef = useRef(false);
  const stepReachedRef = useRef(1);
  useEffect(() => {
    track("brief_started");
    return () => {
      if (!submittedRef.current) {
        track("brief_abandoned", { last_step: stepReachedRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (step > stepReachedRef.current) {
      stepReachedRef.current = step;
      track("brief_step_completed", { step });
    }
  }, [step]);

  const isAddition = data.room === "addition";

  // Auto-skip Step 3 (Haleo's read) in either direction when there's no
  // analyzable media OR when the route doesn't surface media (Addition).
  // Without this, users who skip uploads would land on a stalled "reading…" screen.
  const hasAnalyzableMedia = data.media.some(
    (m) => m.kind === "photo" || m.kind === "floorplan" || m.kind === "video",
  );
  const shouldShowConfirmRead = hasAnalyzableMedia;

  const next = () =>
    setStep((s) => {
      const n = s + 1;
      if (n === 3 && !shouldShowConfirmRead) return 4;
      return n;
    });
  const back = () =>
    setStep((s) => {
      const n = Math.max(1, s - 1);
      if (n === 3 && !shouldShowConfirmRead) return 2;
      return n;
    });

  const submit = () => {
    setSubmitting(true);
    submittedRef.current = true;
    track("brief_completed", { room: data.room, has_address: Boolean(data.address) });
    setTimeout(() => navigate("/brief/result"), 2400);
  };

  if (submitting) return <LoadingPage />;

  return (
    <IntakeShell step={step} total={TOTAL} onBack={back}>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <ProjectScreen
            key="project"
            rooms={data.rooms ?? []}
            goals={data.goals ?? []}
            note={data.goalNote ?? ""}
            onToggleRoom={(r) => {
              const cur = data.rooms ?? [];
              const nextRooms = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
              update({
                rooms: nextRooms,
                room: primaryRoom(nextRooms, data.goals ?? []),
                painPoints: [],
              });
            }}
            onToggleGoal={(g) => {
              const cur = data.goals ?? [];
              const nextGoals = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g];
              update({
                goals: nextGoals,
                room: primaryRoom(data.rooms ?? [], nextGoals),
                painPoints: [],
              });
            }}
            onNote={(v) => update({ goalNote: v })}
            onContinue={() => {
              update({ room: primaryRoom(data.rooms ?? [], data.goals ?? []) });
              setStep(2);
            }}
          />
        )}
        {step === 2 && !isAddition && (
          <InsideLookScreen
            key="inside-look"
            room={data.room as Exclude<Room, "addition">}
            goals={data.goals ?? []}
            selected={data.painPoints}
            onTogglePain={(v) => togglePill("painPoints", v)}
            media={data.media.filter((m) => m.kind !== "inspiration")}
            onAddMedia={addMedia}
            onRemoveMedia={removeMedia}
            notes={data.notes}
            dimensions={data.dimensions}
            onUpdate={(p) => update(p)}
            onContinue={next}
            intake={data}
          />
        )}
        {step === 2 && isAddition && (
          <AdditionFlow
            key="addition"
            data={data}
            onUpdate={(p) => update(p)}
            onAddMedia={addMedia}
            onRemoveMedia={removeMedia}
            onContinue={next}
            outerSteps={<StepDots step={2} />}
          />
        )}
        {step === 3 && shouldShowConfirmRead && (
          <ConfirmReadScreen
            key="confirm-read"
            intake={data}
            onApprove={(snapshot) => update({ approvedAnalysis: snapshot })}
            onSaveFeedback={(feedback) => update({ readFeedback: feedback })}
            onContinue={() => setStep(4)}
            onBack={() => setStep(2)}
            stepDots={<StepDots step={3} />}
          />
        )}
        {step === 4 && (
          <AddressScreen
            key="address"
            address={data.address}
            onSave={(a) => update({ address: a })}
            onSkip={() => update({ address: { ...(data.address ?? {}), skipped: true } })}
            onContinue={next}
          />
        )}
        {step === 5 && (
          <ScopeAndBudgetScreen
            key="scope-budget"
            scope={data.scope}
            onScopeChange={(s) => update({ scope: s })}
            min={data.budgetMin}
            max={data.budgetMax}
            budgetSkipped={Boolean(data.budgetSkipped)}
            onBudgetChange={(m, x) => update({ budgetMin: m, budgetMax: x, budgetSkipped: false })}
            onSkipBudget={() =>
              update({
                budgetSkipped: !data.budgetSkipped,
                budgetMin: data.budgetSkipped ? 40 : undefined,
                budgetMax: data.budgetSkipped ? 70 : undefined,
              })
            }
            selectedTimeline={data.timeline}
            address={data.address}
            hideScope={isAddition}
            onPickTimeline={(t) => {
              update({ timeline: t });
              setTimeout(submit, 350);
            }}
          />
        )}
      </AnimatePresence>
    </IntakeShell>
  );
};

export default Brief;
// keep linter quiet about unused helper export in this file
export const _hasKind = hasKind;
