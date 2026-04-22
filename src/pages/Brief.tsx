import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Upload,
  Image as ImageIcon,
  Camera,
  ArrowRight,
  Link as LinkIcon,
  Ruler,
  Map,
  Check,
  Wand2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import IntakeShell from "@/components/IntakeShell";
import PillGroup from "@/components/PillGroup";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ROOM_LABELS,
  PAIN_BY_ROOM,
  VIBES,
  type Room,
  type AdditionType,
  type AdditionLocation,
  type Timeline,
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

const TOTAL = 6;

const fmtMoney = (v: number) =>
  v >= 500
    ? "$500K+"
    : v >= 1000
      ? "$1M+"
      : `$${v}K`;

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
    <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
      {title}
    </h1>
    {sub && <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">{sub}</p>}
  </div>
);

const SkipButton = ({ onClick, label = "Skip for now" }: { onClick: () => void; label?: string }) => (
  <button
    onClick={onClick}
    className="text-sm text-muted-foreground underline-offset-4 transition-smooth hover:text-foreground hover:underline"
  >
    {label}
  </button>
);

// ───── Step indicator (feedforward affordance) ─────
const ThreeStepFeedforward = () => {
  const items = [
    { n: 1, label: "Pick a room" },
    { n: 2, label: "Show your space" },
    { n: 3, label: "Tell us the vibe" },
  ];
  return (
    <div className="mx-auto flex max-w-xl items-center justify-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-xs font-medium text-foreground/70 shadow-soft backdrop-blur sm:gap-3 sm:px-4">
      <span className="hidden items-center gap-1.5 text-accent sm:inline-flex">
        <Wand2 className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.18em]">3 simple steps</span>
      </span>
      <span className="hidden h-3 w-px bg-border sm:inline-block" />
      {items.map((it, idx) => (
        <span key={it.n} className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
            {it.n}
          </span>
          <span className="whitespace-nowrap">{it.label}</span>
          {idx < items.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
        </span>
      ))}
    </div>
  );
};

// ───── Screen 1: Room ─────
const RoomScreen = ({ onPick }: { onPick: (r: Room) => void }) => {
  const rooms = Object.keys(ROOM_LABELS) as Room[];
  return (
    <div className="space-y-10">
      <ThreeStepFeedforward />
      <ScreenTitle
        eyebrow="Step 1"
        title="Which room are we transforming?"
        sub="Tap one. Don't overthink it — you can change it later."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rooms.map((r) => {
          const Icon = ROOM_ICONS[r];
          return (
            <button
              key={r}
              onClick={() => onPick(r)}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-soft transition-smooth hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent transition-smooth group-hover:bg-accent group-hover:text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-display text-base font-medium">{ROOM_LABELS[r]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ───── Screen 2: Capture (intuitive multi-modal) ─────
type CaptureMethod = "video" | "photos" | "floorplan" | "measurements";

const CAPTURE_OPTIONS: {
  value: CaptureMethod;
  icon: typeof Video;
  label: string;
  hint: string;
  best?: boolean;
}[] = [
  { value: "video", icon: Video, label: "Walkthrough video", hint: "Best — slow 30s pan", best: true },
  { value: "photos", icon: Camera, label: "A few photos", hint: "Snap the trouble spots" },
  { value: "floorplan", icon: Map, label: "Floor plan", hint: "Sketch, PDF, or image" },
  { value: "measurements", icon: Ruler, label: "Type measurements", hint: "Rough dimensions in words" },
];

const MediaScreen = ({
  onContinue,
  data,
  update,
}: {
  onContinue: () => void;
  data: { captureMethod?: CaptureMethod; hasWalkthrough?: boolean; hasFloorPlan?: boolean; hasPhotos?: boolean; measurements?: string };
  update: (s: Partial<{ captureMethod: CaptureMethod; hasWalkthrough: boolean; hasFloorPlan: boolean; hasPhotos: boolean; measurements: string }>) => void;
}) => {
  const method = data.captureMethod;

  const handlePick = (m: CaptureMethod) => {
    update({ captureMethod: m });
  };

  const markCaptured = () => {
    if (method === "video") update({ hasWalkthrough: true });
    if (method === "photos") update({ hasPhotos: true });
    if (method === "floorplan") update({ hasFloorPlan: true });
  };

  const captured =
    (method === "video" && data.hasWalkthrough) ||
    (method === "photos" && data.hasPhotos) ||
    (method === "floorplan" && data.hasFloorPlan) ||
    (method === "measurements" && (data.measurements?.trim().length ?? 0) > 4);

  return (
    <div className="space-y-10">
      <ScreenTitle
        eyebrow="Step 2"
        title="Help us see your space."
        sub="Pick whatever's easiest right now. A quick video says the most — but a photo, sketch, or even a few measurements works."
      />

      {/* Segmented capture options */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CAPTURE_OPTIONS.map((opt) => {
          const active = method === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => handlePick(opt.value)}
              className={`group relative flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift ${
                active ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
              }`}
            >
              {opt.best && (
                <span className="absolute right-3 top-3 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Best
                </span>
              )}
              <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent transition-smooth group-hover:bg-accent group-hover:text-accent-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <p className="font-display text-base font-medium leading-tight">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Dynamic action area */}
      <AnimatePresence mode="wait">
        {method && (
          <motion.div
            key={method}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-2xl"
          >
            {method === "measurements" ? (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <label className="font-display text-sm font-medium">Rough measurements</label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Plain language is fine. e.g. "Kitchen ~12×14ft, ceiling 9ft, one window on the south wall."
                </p>
                <Textarea
                  value={data.measurements ?? ""}
                  onChange={(e) => update({ measurements: e.target.value })}
                  rows={4}
                  placeholder="Type a quick description with rough dimensions…"
                  className="mt-4 rounded-xl border-border bg-background"
                />
              </div>
            ) : (
              <button
                onClick={markCaptured}
                className={`flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-dashed p-6 text-left transition-smooth ${
                  captured ? "border-accent bg-accent-soft/30" : "border-border bg-card/60 hover:border-accent/60 hover:bg-card"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`grid h-11 w-11 place-items-center rounded-full ${captured ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground/70"}`}>
                    {captured ? <Check className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-display text-base font-medium">
                      {captured
                        ? "Got it — added to your brief"
                        : method === "video"
                          ? "Tap to record or upload your walkthrough"
                          : method === "photos"
                            ? "Tap to add photos of the trouble spots"
                            : "Tap to upload your floor plan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {method === "video" && "MP4 or MOV. 30 seconds is plenty."}
                      {method === "photos" && "Up to 10 photos. JPG, PNG, or HEIC."}
                      {method === "floorplan" && "PDF, JPG, PNG — even a phone photo of a sketch."}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background">
                  {captured ? "Replace" : "Choose"}
                </span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center gap-4">
        <Button onClick={onContinue} size="lg" className="rounded-full px-8">
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
        <SkipButton onClick={onContinue} label="I'll add this later" />
      </div>
    </div>
  );
};

// ───── Screen 3: Pain ─────
const PainScreen = ({
  room,
  selected,
  onToggle,
  onContinue,
  setHasPhotos,
  hasPhotos,
}: {
  room: Exclude<Room, "addition">;
  selected: string[];
  onToggle: (v: string) => void;
  onContinue: () => void;
  setHasPhotos: (v: boolean) => void;
  hasPhotos?: boolean;
}) => {
  const options = PAIN_BY_ROOM[room].map((p) => ({ value: p, label: p }));
  return (
    <div className="space-y-12">
      <ScreenTitle
        eyebrow="Step 3"
        title="What's bugging you about it?"
        sub="Tap as many as ring true. Be honest — this is for your eyes only first."
      />
      <PillGroup options={options} selected={selected} onToggle={onToggle} />

      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/60 p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-foreground/70">
            <Camera className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-display text-base font-medium">Snap the parts you most want to change.</p>
            <p className="text-sm text-muted-foreground">Photos help your contractor see exactly what you mean.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setHasPhotos(!hasPhotos)}
            className="rounded-full"
          >
            {hasPhotos ? "Added ✓" : "Upload"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button onClick={onContinue} size="lg" className="rounded-full px-8" disabled={selected.length === 0}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
        <SkipButton onClick={onContinue} />
      </div>
    </div>
  );
};

// ───── Screen 3 (Addition variant) ─────
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
      <div className="space-y-12">
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
      <div className="space-y-12">
        <ScreenTitle eyebrow="Addition · 2 of 3" title="How big?" sub="Roughly. We'll pin it down with your contractor." />
        <div className="mx-auto max-w-xl space-y-8 rounded-3xl border border-border bg-card p-8 shadow-soft">
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
    <div className="space-y-12">
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

// ───── Screen 4: Vibe ─────
const VibeScreen = ({
  selected,
  onToggle,
  onContinue,
  inspirationLink,
  setInspirationLink,
  hasInspiration,
  setHasInspiration,
}: {
  selected: string[];
  onToggle: (v: string) => void;
  onContinue: () => void;
  inspirationLink?: string;
  setInspirationLink: (v: string) => void;
  hasInspiration?: boolean;
  setHasInspiration: (v: boolean) => void;
}) => {
  const options = VIBES.map((v) => ({ value: v, label: v }));
  return (
    <div className="space-y-12">
      <ScreenTitle
        eyebrow="Step 4"
        title="What's the vibe?"
        sub="Pick the words that feel right. Two or three is plenty."
      />
      <PillGroup options={options} selected={selected} onToggle={onToggle} />

      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-center text-sm text-muted-foreground">Have images in mind?</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Paste a Pinterest, Instagram, or Houzz link"
              value={inspirationLink ?? ""}
              onChange={(e) => setInspirationLink(e.target.value)}
              className="h-12 rounded-full border-border bg-card pl-11"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setHasInspiration(!hasInspiration)}
            className="h-12 rounded-full px-6"
          >
            {hasInspiration ? "Added ✓" : "Upload images"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button onClick={onContinue} size="lg" className="rounded-full px-8" disabled={selected.length === 0}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
        <SkipButton onClick={onContinue} />
      </div>
    </div>
  );
};

// ───── Screen 5: Budget ─────
const BudgetScreen = ({
  min,
  max,
  onChange,
  onContinue,
  onSkip,
}: {
  min: number;
  max: number;
  onChange: (m: number, x: number) => void;
  onContinue: () => void;
  onSkip: () => void;
}) => (
  <div className="space-y-12">
    <ScreenTitle
      eyebrow="Step 5"
      title="What's your budget range?"
      sub="A range is fine. This is only ever shared with contractors you choose."
    />
    <div className="mx-auto max-w-xl space-y-10 rounded-3xl border border-border bg-card p-8 shadow-soft">
      <p className="text-center font-display text-5xl font-medium tabular-nums">
        {fmtMoney(min)} <span className="text-muted-foreground">–</span> {fmtMoney(max)}
      </p>
      <Slider
        value={[min, max]}
        min={5}
        max={500}
        step={5}
        minStepsBetweenThumbs={1}
        onValueChange={(v) => {
          const [a, b] = v;
          onChange(a, b);
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>$5K</span>
        <span>$500K+</span>
      </div>
    </div>
    <div className="flex flex-col items-center gap-4">
      <Button onClick={onContinue} size="lg" className="rounded-full px-8">
        Continue
        <ArrowRight className="h-4 w-4" />
      </Button>
      <SkipButton onClick={onSkip} label="I'd rather not say" />
    </div>
  </div>
);

// ───── Screen 6: Timeline ─────
const TimelineScreen = ({
  onPick,
  selected,
}: {
  onPick: (t: Timeline) => void;
  selected?: Timeline;
}) => {
  const opts: { value: Timeline; label: string; sub: string }[] = [
    { value: "asap", label: "ASAP", sub: "Ready to move." },
    { value: "1-3", label: "1–3 months", sub: "Lining things up." },
    { value: "3-6", label: "3–6 months", sub: "Plenty of runway." },
    { value: "exploring", label: "Just exploring", sub: "Window-shopping ideas." },
  ];
  return (
    <div className="space-y-12">
      <ScreenTitle
        eyebrow="Step 6 · last one"
        title="When do you want to start?"
        sub="Tap one. We'll auto-advance from here."
      />
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
        {opts.map((o) => (
          <button
            key={o.value}
            onClick={() => onPick(o.value)}
            className={`rounded-2xl border bg-card p-6 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift ${
              selected === o.value ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
            }`}
          >
            <p className="font-display text-xl font-medium">{o.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{o.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

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
  const { data, update, togglePill } = useIntake();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => s + 1);

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => navigate("/brief/result"), 2400);
  };

  if (submitting) return <LoadingPage />;

  const isAddition = data.room === "addition";

  return (
    <IntakeShell step={step} total={TOTAL} onBack={back}>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <RoomScreen
            key="room"
            onPick={(r) => {
              update({ room: r, painPoints: [] });
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <MediaScreen
            key="media"
            state={{ hasWalkthrough: data.hasWalkthrough, hasFloorPlan: data.hasFloorPlan }}
            setState={(s) => update(s)}
            onContinue={next}
          />
        )}
        {step === 3 && !isAddition && (
          <PainScreen
            key="pain"
            room={data.room as Exclude<Room, "addition">}
            selected={data.painPoints}
            onToggle={(v) => togglePill("painPoints", v)}
            onContinue={next}
            setHasPhotos={(v) => update({ hasPhotos: v })}
            hasPhotos={data.hasPhotos}
          />
        )}
        {step === 3 && isAddition && (
          <AdditionScreen
            key="addition"
            data={{
              additionType: data.additionType,
              additionSize: data.additionSize,
              additionLocation: data.additionLocation,
            }}
            onChange={(p) => update(p)}
            onContinue={next}
          />
        )}
        {step === 4 && (
          <VibeScreen
            key="vibe"
            selected={data.vibes}
            onToggle={(v) => togglePill("vibes", v)}
            onContinue={next}
            inspirationLink={data.inspirationLink}
            setInspirationLink={(v) => update({ inspirationLink: v })}
            hasInspiration={data.hasInspiration}
            setHasInspiration={(v) => update({ hasInspiration: v })}
          />
        )}
        {step === 5 && (
          <BudgetScreen
            key="budget"
            min={data.budgetMin ?? 40}
            max={data.budgetMax ?? 70}
            onChange={(m, x) => update({ budgetMin: m, budgetMax: x, budgetSkipped: false })}
            onContinue={next}
            onSkip={() => {
              update({ budgetSkipped: true, budgetMin: undefined, budgetMax: undefined });
              next();
            }}
          />
        )}
        {step === 6 && (
          <TimelineScreen
            key="timeline"
            selected={data.timeline}
            onPick={(t) => {
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
