// Multi-step Addition / ADU / JADU intake.
// Five sub-screens with progressive disclosure:
//   1) kind        — ADU vs JADU vs general addition (JADU shows tooltip)
//   2) permit      — permit status conversational prompt
//   3) plans       — plan upload (PDF/JPG) with ack micro-interaction
//   4) vision      — editable square footage + open-ended intent
//   5) inspiration — drag/drop vibe gallery
// State lives on the parent intake; this component is a pure controller.
import { useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  FileText,
  Image as ImageIcon,
  Info,
  X,
  Sparkles,
  Home as HomeIcon,
  Building2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  filesToAssets,
  type AdditionKind,
  type IntakeData,
  type MediaAsset,
  type PermitStatus,
} from "@/lib/intake";

type Sub = "kind" | "permit" | "plans" | "vision" | "inspiration";

const SUB_ORDER: Sub[] = ["kind", "permit", "plans", "vision", "inspiration"];

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{children}</p>
);

const SubStepDots = ({ sub }: { sub: Sub }) => {
  const idx = SUB_ORDER.indexOf(sub);
  return (
    <div className="mx-auto flex max-w-md items-center gap-1.5">
      {SUB_ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-1 flex-1 rounded-full transition-all ${
            i <= idx ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
};

const Card = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    className="space-y-10"
  >
    {children}
  </motion.div>
);

// ───── Sub 1: Kind (ADU / JADU / Addition) ─────
const KindStep = ({
  value,
  onPick,
}: {
  value?: AdditionKind;
  onPick: (k: AdditionKind) => void;
}) => {
  const opts: { value: AdditionKind; label: string; sub: string; Icon: typeof HomeIcon; tip?: string }[] = [
    {
      value: "adu",
      label: "ADU",
      sub: "Detached or attached accessory dwelling — full kitchen, bath, and entrance.",
      Icon: HomeIcon,
    },
    {
      value: "jadu",
      label: "JADU",
      sub: "Junior ADU — carved out of the existing home.",
      Icon: Building2,
      tip:
        "Junior ADUs typically remain under 500 sq ft and are contained within the existing primary residence structure. Often a converted bedroom, garage, or basement.",
    },
    {
      value: "addition",
      label: "Addition",
      sub: "Extra room or square footage attached to your home.",
      Icon: Plus,
    },
  ];

  return (
    <Card>
      <div className="text-center">
        <Eyebrow>Additions · 1 of 5</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          What are we building?
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">
          Pick the closest fit. We'll tailor the questions and contractor matches from here.
        </p>
      </div>
      <TooltipProvider delayDuration={150}>
        <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-3">
          {opts.map((o) => {
            const Icon = o.Icon;
            const active = value === o.value;
            return (
              <button
                key={o.value}
                onClick={() => onPick(o.value)}
                className={`group relative flex h-full flex-col gap-3 rounded-2xl border bg-card p-6 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift ${
                  active ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent transition-smooth group-hover:bg-accent group-hover:text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  {o.tip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          onClick={(e) => e.stopPropagation()}
                          className="grid h-7 w-7 place-items-center rounded-full border border-border text-foreground/60 hover:bg-secondary"
                          aria-label="What's a JADU?"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {o.tip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="font-display text-xl font-medium">{o.label}</p>
                <p className="text-sm text-muted-foreground">{o.sub}</p>
              </button>
            );
          })}
        </div>
      </TooltipProvider>
    </Card>
  );
};

// ───── Sub 2: Permit ─────
const PermitStep = ({
  value,
  onPick,
}: {
  value?: PermitStatus;
  onPick: (p: PermitStatus) => void;
}) => {
  const opts: { value: PermitStatus; label: string; sub: string }[] = [
    { value: "yes", label: "Yes", sub: "Permit is active — let's go." },
    { value: "in-progress", label: "In progress", sub: "Filed or under review." },
    { value: "not-yet", label: "Not yet", sub: "We'll match contractors who handle permitting." },
  ];
  return (
    <Card>
      <div className="text-center">
        <Eyebrow>Additions · 2 of 5</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Great choice.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">
          To help us find the right contractors — do you already have an active building permit for
          this project?
        </p>
      </div>
      <div className="mx-auto grid max-w-2xl gap-3 md:grid-cols-3">
        {opts.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onPick(o.value)}
              className={`flex flex-col gap-2 rounded-2xl border bg-card p-6 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift ${
                active ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
              }`}
            >
              <p className="font-display text-2xl font-medium">{o.label}</p>
              <p className="text-sm text-muted-foreground">{o.sub}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

// ───── Plan / Inspiration thumbnail tile ─────
const Thumb = ({
  asset,
  onRemove,
}: {
  asset: MediaAsset;
  onRemove: () => void;
}) => {
  const isImage =
    asset.mime?.startsWith("image/") || asset.kind === "photo" || asset.kind === "inspiration";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary shadow-soft"
    >
      {isImage ? (
        <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
          <FileText className="h-7 w-7 text-accent" />
          <span className="line-clamp-2 text-[11px] font-medium text-foreground/80">
            {asset.name}
          </span>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-foreground/70 opacity-0 shadow-sm transition-smooth group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
        aria-label={`Remove ${asset.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
};

// ───── Sub 3: Plan upload ─────
const PlansStep = ({
  plans,
  onAdd,
  onRemove,
}: {
  plans: MediaAsset[];
  onAdd: (a: MediaAsset[]) => void;
  onRemove: (id: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handle = async (files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return;
    const assets = await filesToAssets(files, "floorplan");
    onAdd(assets);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2400);
  };

  return (
    <Card>
      <div className="text-center">
        <Eyebrow>Additions · 3 of 5</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Got plans yet?
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">
          Drop a PDF or photo of your architectural drawings. Don't have any? Skip it — we'll work
          from the rest.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handle(e.target.files);
            e.target.value = "";
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files) handle(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-12 text-center transition-smooth ${
            drag
              ? "border-accent bg-accent-soft/40"
              : "border-border bg-card/60 hover:border-accent/60 hover:bg-card"
          }`}
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
            <Upload className="h-6 w-6" />
          </div>
          <p className="font-display text-lg font-medium">Drop plans here</p>
          <p className="text-xs text-muted-foreground">PDF or JPG · up to a few MBs each</p>
        </div>

        <AnimatePresence>
          {justAdded && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center justify-center gap-2 rounded-full bg-sage-soft px-4 py-2 text-sm text-sage"
            >
              <Check className="h-4 w-4" /> Got it! We'll use these plans to refine your contractor matches.
            </motion.div>
          )}
        </AnimatePresence>

        {plans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:grid-cols-4">
            <AnimatePresence>
              {plans.map((p) => (
                <Thumb key={p.id} asset={p} onRemove={() => onRemove(p.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  );
};

// ───── Sub 4: Vision (editable sq ft + intent) ─────
const VisionStep = ({
  size,
  vision,
  kind,
  onSize,
  onVision,
}: {
  size?: number;
  vision?: string;
  kind?: AdditionKind;
  onSize: (n: number) => void;
  onVision: (s: string) => void;
}) => {
  const defaultSize = kind === "jadu" ? 400 : kind === "adu" ? 750 : 300;
  const display = size ?? defaultSize;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(display));
  const isJaduOver = kind === "jadu" && display > 500;

  const commit = () => {
    const n = Math.max(50, Math.min(2000, parseInt(draft.replace(/[^\d]/g, ""), 10) || display));
    onSize(n);
    setEditing(false);
  };

  return (
    <Card>
      <div className="text-center">
        <Eyebrow>Additions · 4 of 5</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          What are you envisioning?
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">
          A rental unit, a guest house for family, a quiet home office — paint us the picture.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Editable square footage */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 text-center shadow-soft">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Square footage
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {editing ? (
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(String(display));
                    setEditing(false);
                  }
                }}
                className="w-40 border-b-2 border-accent bg-transparent text-center font-display text-6xl font-medium outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setDraft(String(display));
                  setEditing(true);
                }}
                className="font-display text-6xl font-medium text-foreground transition-smooth hover:text-accent"
                aria-label="Edit square footage"
              >
                {display.toLocaleString()}
              </button>
            )}
            <span className="self-end pb-2 text-base text-muted-foreground">sq ft</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {editing ? "Press enter to save" : "Tap the number to edit"}
          </p>
          <AnimatePresence>
            {isJaduOver && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-800"
              >
                <Info className="h-3 w-3" /> JADUs typically stay under 500 sq ft.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Vision textarea */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <label className="flex items-center gap-2 font-display text-sm font-medium">
            <Sparkles className="h-4 w-4 text-accent" /> The vision
          </label>
          <Textarea
            value={vision ?? ""}
            onChange={(e) => onVision(e.target.value)}
            rows={5}
            placeholder="e.g. A bright rental studio for short-term guests with its own entrance off the side yard."
            className="mt-3 rounded-xl border-border bg-background text-sm"
          />
        </div>
      </div>
    </Card>
  );
};

// ───── Sub 5: Inspiration ─────
const InspirationStep = ({
  shots,
  onAdd,
  onRemove,
}: {
  shots: MediaAsset[];
  onAdd: (a: MediaAsset[]) => void;
  onRemove: (id: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = async (files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return;
    const assets = await filesToAssets(files, "inspiration");
    onAdd(assets);
  };

  return (
    <Card>
      <div className="text-center">
        <Eyebrow>Additions · 5 of 5</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Vibe check.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground">
          Drop a few inspiration images — Pinterest screenshots, magazine snaps, anything that
          captures the feel.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handle(e.target.files);
            e.target.value = "";
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files) handle(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 md:p-8 text-center transition-smooth ${
            drag
              ? "border-accent bg-accent-soft/40"
              : "border-border bg-card/60 hover:border-accent/60 hover:bg-card"
          }`}
        >
          <ImageIcon className="h-6 w-6 text-accent" />
          <p className="font-display text-base font-medium">Drag images or click to upload</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, HEIC</p>
        </div>

        {shots.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:grid-cols-4">
            <AnimatePresence>
              {shots.map((s) => (
                <Thumb key={s.id} asset={s} onRemove={() => onRemove(s.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  );
};

// ───── Controller ─────
type Props = {
  data: IntakeData;
  onUpdate: (p: Partial<IntakeData>) => void;
  onAddMedia: (a: MediaAsset[]) => void;
  onRemoveMedia: (id: string) => void;
  onContinue: () => void;
  // Render slot for the parent's StepDots so the outer progress stays consistent.
  outerSteps?: ReactNode;
};

const AdditionFlow = ({
  data,
  onUpdate,
  onAddMedia,
  onRemoveMedia,
  onContinue,
  outerSteps,
}: Props) => {
  const initial: Sub = !data.additionKind
    ? "kind"
    : !data.permitStatus
      ? "permit"
      : "plans";
  const [sub, setSub] = useState<Sub>(initial);

  const idx = SUB_ORDER.indexOf(sub);
  const next = () => {
    if (idx < SUB_ORDER.length - 1) setSub(SUB_ORDER[idx + 1]);
    else onContinue();
  };
  const prev = () => {
    if (idx > 0) setSub(SUB_ORDER[idx - 1]);
  };

  const plans = data.media.filter((m) => m.kind === "floorplan");
  const inspo = data.media.filter((m) => m.kind === "inspiration");

  const canContinue =
    (sub === "kind" && Boolean(data.additionKind)) ||
    (sub === "permit" && Boolean(data.permitStatus)) ||
    sub === "plans" ||
    (sub === "vision" && Boolean(data.additionSize || data.visionNote)) ||
    sub === "inspiration";

  return (
    <div className="space-y-10">
      {outerSteps}
      <SubStepDots sub={sub} />
      <AnimatePresence mode="wait">
        {sub === "kind" && (
          <KindStep
            key="kind"
            value={data.additionKind}
            onPick={(k) => {
              onUpdate({ additionKind: k });
              setTimeout(() => setSub("permit"), 220);
            }}
          />
        )}
        {sub === "permit" && (
          <PermitStep
            key="permit"
            value={data.permitStatus}
            onPick={(p) => {
              onUpdate({ permitStatus: p });
              setTimeout(() => setSub("plans"), 220);
            }}
          />
        )}
        {sub === "plans" && (
          <PlansStep
            key="plans"
            plans={plans}
            onAdd={onAddMedia}
            onRemove={onRemoveMedia}
          />
        )}
        {sub === "vision" && (
          <VisionStep
            key="vision"
            size={data.additionSize}
            vision={data.visionNote}
            kind={data.additionKind}
            onSize={(n) => onUpdate({ additionSize: n })}
            onVision={(s) => onUpdate({ visionNote: s })}
          />
        )}
        {sub === "inspiration" && (
          <InspirationStep
            key="inspiration"
            shots={inspo}
            onAdd={onAddMedia}
            onRemove={onRemoveMedia}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={idx === 0}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={next}
          size="lg"
          className="rounded-full px-8"
          disabled={!canContinue}
        >
          {idx === SUB_ORDER.length - 1 ? "Continue" : "Next"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default AdditionFlow;
