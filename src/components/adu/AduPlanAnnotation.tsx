import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pencil, Type as TypeIcon, Upload, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";

export type AduType = "detached" | "attached" | "garage_conversion" | "jadu";

export interface AnnotationOutput {
  base_plan_url: string | null;
  annotation_image_url: string | null;
  intended_scope: {
    adu_type: AduType;
    location_description: string;
    size_sqft: number;
    annotation_coordinates: { x_pct: number; y_pct: number; w_pct: number; h_pct: number } | null;
  };
}

interface Props {
  maxAllowedSqft: number | null;
  setbacks: { rear: number; sides: number; front: string };
  initialBasePlanUrl?: string | null;
  onComplete: (out: AnnotationOutput) => void;
}

const ADU_TYPES: { value: AduType; label: string }[] = [
  { value: "detached", label: "Detached" },
  { value: "attached", label: "Attached" },
  { value: "garage_conversion", label: "Garage conversion" },
  { value: "jadu", label: "JADU (inside primary)" },
];

export default function AduPlanAnnotation({ maxAllowedSqft, setbacks, initialBasePlanUrl, onComplete }: Props) {
  const [method, setMethod] = useState<"draw" | "type" | null>(initialBasePlanUrl ? null : null);
  const [basePlanUrl, setBasePlanUrl] = useState<string | null>(initialBasePlanUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [aduType, setAduType] = useState<AduType>("detached");
  const [sizeSqft, setSizeSqft] = useState<number>(600);
  const [location, setLocation] = useState<string>("");
  const [planScaleFt, setPlanScaleFt] = useState<number>(60); // assumed plan-width in ft

  // Drawn rectangle (% of base image, so coordinates persist on resize)
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function uploadFile(file: File): Promise<string> {
    const ext = file.name.split(".").pop() || "png";
    const path = `adu-plans/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("intake-media").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("intake-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleBasePlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadFile(f);
      setBasePlanUrl(url);
    } catch (err) {
      console.error(err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function chooseMethod(m: "draw" | "type") {
    setMethod(m);
    track("adu_annotation_method_chosen", { method: m });
  }

  async function handleContinue() {
    if (!method) return;
    setSubmitting(true);
    try {
      let annotationImageUrl: string | null = null;

      if (method === "draw" && rect && basePlanUrl) {
        // Render an overlay PNG (amber rect on transparent background, same size as base plan)
        const overlay = await buildOverlayPng(basePlanUrl, rect);
        if (overlay) {
          const file = new File([overlay], "annotation.png", { type: "image/png" });
          annotationImageUrl = await uploadFile(file);
        }
      }

      track("adu_size_entered", { size_sqft: sizeSqft, method });
      track("adu_type_selected", { adu_type: aduType });

      onComplete({
        base_plan_url: basePlanUrl,
        annotation_image_url: annotationImageUrl,
        intended_scope: {
          adu_type: aduType,
          location_description: location.trim() || (method === "draw" ? "See annotated plan" : ""),
          size_sqft: sizeSqft,
          annotation_coordinates:
            method === "draw" && rect
              ? { x_pct: rect.x, y_pct: rect.y, w_pct: rect.w, h_pct: rect.h }
              : null,
        },
      });
    } catch (e) {
      console.error(e);
      setUploadError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const sizeWarning =
    maxAllowedSqft != null && sizeSqft > maxAllowedSqft
      ? `Your selected size of ${sizeSqft} sqft exceeds the maximum allowed of ${maxAllowedSqft} sqft for a ${aduType.replace("_", " ")} on this lot. Consider reducing to stay within limits.`
      : null;

  return (
    <div className="space-y-5">
      {/* === Input A: Base Plan === */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Input A
          </span>
          <h3 className="text-sm font-semibold">Your current home as it exists today</h3>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Upload your existing floor plan or site plan. PDF, PNG, or JPG.
        </p>

        {basePlanUrl ? (
          <div className="mt-3 space-y-2">
            <img
              src={basePlanUrl}
              alt="Base plan"
              className="max-h-64 w-full rounded-xl border border-border object-contain bg-secondary/40"
            />
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground underline">
              <Upload className="h-3.5 w-3.5" /> Replace
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBasePlanUpload} />
            </label>
          </div>
        ) : (
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-6 text-center text-sm transition-smooth hover:bg-secondary/50">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">{uploading ? "Uploading…" : "Click to upload base plan"}</span>
            <span className="text-[12px] text-muted-foreground">PNG, JPG, PDF up to 10 MB</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBasePlanUpload} />
          </label>
        )}
        {uploadError ? (
          <p className="mt-2 text-[12px] text-rose-700">{uploadError}</p>
        ) : null}
      </section>

      {/* === Input B: Annotation === */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
            Input B
          </span>
          <h3 className="text-sm font-semibold">Show us where and what you want to add</h3>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Treated as a completely separate input from your base plan. Pick one option below.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MethodButton
            active={method === "draw"}
            disabled={!basePlanUrl}
            onClick={() => chooseMethod("draw")}
            icon={<Pencil className="h-4 w-4" />}
            label="Draw on plan"
            hint={basePlanUrl ? "Drag a rectangle" : "Upload plan first"}
          />
          <MethodButton
            active={method === "type"}
            onClick={() => chooseMethod("type")}
            icon={<TypeIcon className="h-4 w-4" />}
            label="Type sqft + describe"
            hint="No drawing needed"
          />
        </div>

        <AnimatePresence mode="wait">
          {method === "draw" && basePlanUrl ? (
            <motion.div
              key="draw"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-3"
            >
              <PlanScaleInput planScaleFt={planScaleFt} onChange={setPlanScaleFt} />
              <DrawCanvas
                imageUrl={basePlanUrl}
                planScaleFt={planScaleFt}
                rect={rect}
                onRectChange={(r, sqft) => {
                  setRect(r);
                  if (sqft) setSizeSqft(sqft);
                }}
              />
            </motion.div>
          ) : null}

          {method === "type" ? (
            <motion.div
              key="type"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-3"
            >
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium">How big do you want your ADU? (sqft)</label>
                <Input
                  type="number"
                  min={120}
                  max={1500}
                  value={sizeSqft}
                  onChange={(e) => setSizeSqft(Number(e.target.value || 0))}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium">Where on your property?</label>
                <Input
                  placeholder="e.g. back left corner, above garage, attached to east side"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              {basePlanUrl && sizeSqft ? (
                <AutoOverlayPreview imageUrl={basePlanUrl} sizeSqft={sizeSqft} planScaleFt={planScaleFt} />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ADU type selector — shared by both methods */}
        {method ? (
          <div className="mt-4 space-y-1.5">
            <label className="text-[12px] font-medium">ADU type</label>
            <select
              value={aduType}
              onChange={(e) => setAduType(e.target.value as AduType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {ADU_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Real-time, hardcoded warnings (never AI) */}
        {method && sizeWarning ? (
          <div className="mt-3 flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-950">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p>{sizeWarning}</p>
          </div>
        ) : null}
        {method === "type" && location.length > 0 && /(front|street|driveway)/i.test(location) ? (
          <div className="mt-3 flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-950">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p>{`Front-yard ADU placement is not permitted in San Jose. ${setbacks.front}. Consider a rear or side-yard location.`}</p>
          </div>
        ) : null}
      </section>

      <button
        type="button"
        disabled={!method || submitting || (method === "type" && (!sizeSqft || !location.trim()))}
        onClick={handleContinue}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition-smooth disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Preparing…" : "Generate my ADU brief"}
      </button>
    </div>
  );
}

function MethodButton({
  active,
  disabled,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-smooth disabled:opacity-50 ${
        active ? "border-foreground bg-secondary" : "border-border bg-card hover:bg-secondary/60"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">{icon} {label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function PlanScaleInput({ planScaleFt, onChange }: { planScaleFt: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-[12px]">
      <label className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          Approximate width of your plan in real-world feet (for live sqft estimate):
        </span>
        <Input
          type="number"
          min={20}
          max={300}
          value={planScaleFt}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          className="h-8 w-20 text-right"
        />
      </label>
    </div>
  );
}

function DrawCanvas({
  imageUrl,
  planScaleFt,
  rect,
  onRectChange,
}: {
  imageUrl: string;
  planScaleFt: number;
  rect: { x: number; y: number; w: number; h: number } | null;
  onRectChange: (r: { x: number; y: number; w: number; h: number } | null, sqftEstimate?: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState<null | { startX: number; startY: number }>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function clientToPct(clientX: number, clientY: number) {
    const r = wrapperRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  }

  function recompute(next: { x: number; y: number; w: number; h: number } | null) {
    if (!next) return onRectChange(null);
    // Approx sqft. Assume aspect ratio of image equals plan aspect ratio.
    const planWidthFt = planScaleFt;
    const aspect = imgRef.current ? imgRef.current.naturalHeight / imgRef.current.naturalWidth : 1;
    const planHeightFt = planWidthFt * aspect;
    const sqft = Math.round(next.w * planWidthFt * next.h * planHeightFt);
    onRectChange(next, sqft);
  }

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-secondary/40"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const p = clientToPct(e.clientX, e.clientY);
          setDragging({ startX: p.x, startY: p.y });
          recompute({ x: p.x, y: p.y, w: 0, h: 0 });
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          const p = clientToPct(e.clientX, e.clientY);
          const x = Math.min(dragging.startX, p.x);
          const y = Math.min(dragging.startY, p.y);
          const w = Math.abs(p.x - dragging.startX);
          const h = Math.abs(p.y - dragging.startY);
          recompute({ x, y, w, h });
        }}
        onPointerUp={() => setDragging(null)}
      >
        <img ref={imgRef} src={imageUrl} alt="Base plan" className="block w-full" draggable={false} />
        {rect && rect.w > 0 && rect.h > 0 && size ? (
          <div
            className="pointer-events-none absolute border-2 border-amber-500 bg-amber-400/25"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          />
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">
        Drag on the plan to draw your ADU footprint. Live estimate:{" "}
        <span className="font-medium text-foreground">
          {rect && rect.w > 0 ? `~${Math.round((rect.w * planScaleFt) * (rect.h * planScaleFt * ((imgRef.current?.naturalHeight ?? 1) / (imgRef.current?.naturalWidth ?? 1))))} sqft` : "—"}
        </span>
      </p>
    </div>
  );
}

function AutoOverlayPreview({
  imageUrl,
  sizeSqft,
  planScaleFt,
}: {
  imageUrl: string;
  sizeSqft: number;
  planScaleFt: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const onLoad = () => force((x) => x + 1);
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, []);

  const aspect = imgRef.current ? imgRef.current.naturalHeight / imgRef.current.naturalWidth : 1;
  const planHeightFt = planScaleFt * aspect;
  const sideFt = Math.sqrt(sizeSqft);
  const wPct = Math.min(0.6, sideFt / planScaleFt);
  const hPct = Math.min(0.6, sideFt / planHeightFt);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-secondary/40">
      <img ref={imgRef} src={imageUrl} alt="Base plan with overlay" className="block w-full" />
      <div
        aria-hidden
        className="pointer-events-none absolute border-2 border-amber-500 bg-amber-400/30"
        style={{
          right: "8%",
          bottom: "8%",
          width: `${wPct * 100}%`,
          height: `${hPct * 100}%`,
        }}
      />
      <p className="absolute bottom-1 right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-amber-50">
        ~{sizeSqft} sqft (estimate)
      </p>
    </div>
  );
}

// Build a transparent PNG the same size as base plan with just the amber rect.
// This is what we send to Gemini as "the addition" — strictly separate from
// the base plan image so the model cannot conflate them.
async function buildOverlayPng(
  baseUrl: string,
  rect: { x: number; y: number; w: number; h: number },
): Promise<Blob | null> {
  try {
    const img = await loadImage(baseUrl);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "rgba(245, 158, 11, 0.55)";
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = Math.max(4, Math.round(c.width * 0.004));
    const rx = rect.x * c.width;
    const ry = rect.y * c.height;
    const rw = rect.w * c.width;
    const rh = rect.h * c.height;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.font = `${Math.max(18, Math.round(c.width * 0.025))}px sans-serif`;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText("Proposed ADU", rx + 8, ry + 24);
    return await new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  } catch (e) {
    console.error("overlay build failed", e);
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
