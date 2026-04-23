// Local intake state.
// Files live in a module-level Map (session-scoped) so object URLs survive
// route changes within the SPA. Metadata is also persisted to localStorage so
// the brief read still works after a hard reload — we just lose the previews.
// Rule: never ask the user for the same thing twice.
import { useEffect, useState } from "react";
import heic2any from "heic2any";

// ───── Session file store — survives navigation, dies on full reload ─────
// Keyed by asset id; holds the actual File so we can re-mint object URLs
// whenever a fresh component instance reads from localStorage.
const sessionFiles: Map<string, { file: File; url: string }> = new Map();

export type MediaAsset = {
  id: string;
  kind: "video" | "photo" | "floorplan" | "inspiration";
  name: string;
  url: string; // object URL (session-only)
  mime?: string;
  size?: number;
  uploadedUrl?: string;
};

export type Room =
  | "kitchen"
  | "bathroom"
  | "living"
  | "bedroom"
  | "office"
  | "addition"
  | "full-home"
  | "other";

export type AdditionType = "bedroom" | "bathroom" | "living" | "floor";
export type AdditionLocation = "rear" | "side" | "above" | "unsure";

export type Timeline = "asap" | "1-3" | "3-6" | "exploring";

export type LengthUnit = "ft" | "m";

export type Dimensions = {
  length?: number;
  width?: number;
  height?: number;
  unit: LengthUnit;
};

export type Address = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  // True when the homeowner explicitly opted out — we won't nag again.
  skipped?: boolean;
};

export type ScopeTier = "refresh" | "remodel" | "reconfigure" | "structural";

export type IntakeData = {
  room?: Room;
  // pain
  painPoints: string[];
  // addition
  additionType?: AdditionType;
  additionSize?: number;
  additionLocation?: AdditionLocation;
  // media (real file uploads + object URLs)
  media: MediaAsset[];
  // optional rough notes
  notes?: string;
  // structured measurements (replaces the old free-text field)
  dimensions?: Dimensions;
  // legacy free-text — kept so older saved sessions still render
  measurements?: string;
  // address (for permit + neighborhood intel)
  address?: Address;
  // scope of work — orientates budget
  scope?: ScopeTier;
  // budget
  budgetMin?: number;
  budgetMax?: number;
  budgetSkipped?: boolean;
  // timeline
  timeline?: Timeline;
  // homeowner annotations on the brief, keyed by section id (vision, evidence, scope, structural, finishes, constraints, opportunities, code)
  annotations?: Record<string, string>;
};

const STORAGE_KEY = "haleo:intake:v2";
const LEGACY_KEY = "haleo:intake";
const UPLOADED_KEY = "haleo:uploaded:v1";
const ANALYSIS_CACHE_KEY = "haleo:analysis:v1";

const empty: IntakeData = {
  painPoints: [],
  media: [],
};

// Strip non-serializable bits before persisting.
const serializable = (d: IntakeData) => ({
  ...d,
  media: d.media.map((m) => ({
    ...m,
    url: m.url.startsWith("blob:") ? m.uploadedUrl ?? "" : m.url,
  })),
});

// Re-hydrate any media metadata from localStorage with live object URLs from
// the session store (so thumbnails keep working when navigating between pages).
const rehydrateMedia = (media: MediaAsset[]): MediaAsset[] =>
  media.map((m) => {
    const live = sessionFiles.get(m.id);
    if (live) return { ...m, url: live.url };
    const uploaded = typeof window !== "undefined"
      ? (() => {
          try {
            const stored = JSON.parse(localStorage.getItem(UPLOADED_KEY) ?? "{}") as Record<string, string>;
            return stored[m.id];
          } catch {
            return undefined;
          }
        })()
      : undefined;
    return { ...m, uploadedUrl: m.uploadedUrl ?? uploaded, url: m.url || m.uploadedUrl || uploaded || "" };
  });

const readStored = (): IntakeData => {
  if (typeof window === "undefined") return empty;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      ...empty,
      ...parsed,
      media: rehydrateMedia(parsed.media ?? []),
    };
  } catch {
    return empty;
  }
};

export const useIntake = () => {
  const [data, setData] = useState<IntakeData>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable(data)));
    } catch {
      /* ignore */
    }
  }, [data]);

  const update = (patch: Partial<IntakeData>) => setData((d) => ({ ...d, ...patch }));
  const togglePill = (key: "painPoints", value: string) =>
    setData((d) => {
      const arr = d[key] ?? [];
      return {
        ...d,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  const addMedia = (assets: MediaAsset[]) =>
    setData((d) => ({ ...d, media: [...d.media, ...assets] }));
  const removeMedia = (id: string) =>
    setData((d) => {
      const live = sessionFiles.get(id);
      if (live) {
        URL.revokeObjectURL(live.url);
        sessionFiles.delete(id);
      }
      return { ...d, media: d.media.filter((m) => m.id !== id) };
    });
  const reset = () => {
    sessionFiles.forEach(({ url }) => URL.revokeObjectURL(url));
    sessionFiles.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(UPLOADED_KEY);
      localStorage.removeItem(ANALYSIS_CACHE_KEY);
    } catch {
      /* ignore */
    }
    setData(empty);
  };

  return { data, update, togglePill, addMedia, removeMedia, reset, setData };
};

// Build MediaAssets from a FileList. Object URL goes both on the asset AND
// into the session store so we can re-hydrate it after a route change.
const isHeicLike = (file: File) =>
  file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name);

const renameWithExt = (name: string, ext: string) => name.replace(/\.[^.]+$/, "") + ext;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });

const maybeConvertHeic = async (file: File): Promise<File> => {
  if (!isHeicLike(file)) return file;
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.86 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], renameWithExt(file.name, ".jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
};

const maybeCompressImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/") || file.size <= 4 * 1024 * 1024) return file;
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let output: Blob | null = null;
    while (quality >= 0.5) {
      output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (output && output.size <= 4 * 1024 * 1024) break;
      quality -= 0.08;
    }

    if (!output) return file;
    return new File([output], renameWithExt(file.name, ".jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(src);
  }
};

const normalizeFile = async (file: File, kind: MediaAsset["kind"]) => {
  if (kind === "photo" || kind === "floorplan" || kind === "inspiration") {
    const converted = await maybeConvertHeic(file);
    return maybeCompressImage(converted);
  }
  return file;
};

export const filesToAssets = async (
  files: FileList | File[],
  kind: MediaAsset["kind"],
): Promise<MediaAsset[]> => {
  const normalized = await Promise.all(Array.from(files).map((file) => normalizeFile(file, kind)));

  return normalized.map((f) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = URL.createObjectURL(f);
    sessionFiles.set(id, { file: f, url });
    return {
      id,
      kind,
      name: f.name,
      url,
      mime: f.type,
      size: f.size,
    };
  });
};

// File-size guidance shown in the UI (kept central so copy stays consistent).
export const VIDEO_LIMITS = {
  maxBytes: 100 * 1024 * 1024,
  maxSeconds: 30,
  hint: "Up to 30 seconds, 100 MB. A slow 1080p walkthrough is ideal.",
};

export const hasKind = (d: IntakeData, k: MediaAsset["kind"]) => d.media.some((m) => m.kind === k);

// ───── Helpers — used by brief generators ─────
export const formatDimensions = (dim?: Dimensions): string => {
  if (!dim) return "";
  const { length, width, height, unit } = dim;
  const u = unit === "ft" ? "ft" : "m";
  const parts: string[] = [];
  if (length && width) parts.push(`${length} × ${width} ${u}`);
  else if (length) parts.push(`${length} ${u} long`);
  else if (width) parts.push(`${width} ${u} wide`);
  if (height) parts.push(`${height} ${u} ceiling`);
  return parts.join(", ");
};

export const dimensionsArea = (dim?: Dimensions): number | null => {
  if (!dim?.length || !dim?.width) return null;
  const sq = dim.length * dim.width;
  return dim.unit === "m" ? Math.round(sq * 10.7639) : Math.round(sq);
};

export const hasAnyMeasurements = (d: IntakeData): boolean =>
  Boolean(
    d.dimensions?.length ||
      d.dimensions?.width ||
      d.dimensions?.height ||
      d.measurements?.trim(),
  );

export const ROOM_LABELS: Record<Room, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  living: "Living room",
  bedroom: "Bedroom",
  office: "Office",
  addition: "Addition",
  "full-home": "Full home",
  other: "Something else",
};

export const PAIN_BY_ROOM: Record<Exclude<Room, "addition">, string[]> = {
  kitchen: [
    "Too dark",
    "Cramped",
    "Layout doesn't work",
    "Not enough counter space",
    "No room to cook together",
    "Dated cabinets",
    "No storage",
    "Appliances need upgrading",
    "No island",
  ],
  bathroom: [
    "Too dark",
    "Cramped",
    "Dated finishes",
    "No storage",
    "Tiny shower",
    "No bathtub",
    "Bad ventilation",
    "Single vanity",
    "Ugly tile",
  ],
  living: [
    "Too dark",
    "Bad flow",
    "No focal point",
    "Dated finishes",
    "Poor lighting",
    "Not enough storage",
    "Carpet needs to go",
    "Disconnected from dining",
  ],
  bedroom: [
    "Too dark",
    "Not enough storage",
    "No closet space",
    "Cramped",
    "Bad layout",
    "Dated finishes",
    "No privacy",
  ],
  office: [
    "Too dark",
    "No storage",
    "Not enough desk space",
    "Bad acoustics",
    "No natural light",
    "Too cramped",
  ],
  "full-home": [
    "Too dark throughout",
    "Bad flow",
    "Dated finishes",
    "Not enough storage",
    "Poor lighting",
    "Energy inefficient",
    "Cramped layout",
    "No outdoor connection",
  ],
  other: [
    "Too dark",
    "Cramped",
    "Bad layout",
    "Dated finishes",
    "Not enough storage",
    "Poor lighting",
  ],
};

// ───── Scope of work — anchors budget and helps the user calibrate ─────
export type ScopeOption = {
  value: ScopeTier;
  label: string;
  oneLiner: string;
  includes: string[];
  // Default budget range (USD, in $K) — used as a sensible starting slider position.
  range: { min: number; max: number };
  permitLikely: boolean;
};

// Ranges are calibrated to a typical kitchen/bath in the Bay Area; we'll
// localize per address once Cloud + permit data are wired in.
export const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: "refresh",
    label: "Design refresh",
    oneLiner: "Same layout. New look.",
    includes: ["Paint, fixtures, hardware", "New countertops or tile", "Lighting swap-out"],
    range: { min: 15, max: 40 },
    permitLikely: false,
  },
  {
    value: "remodel",
    label: "Full remodel",
    oneLiner: "Same footprint. Everything new.",
    includes: ["New cabinets & finishes", "Appliance package", "Plumbing & electrical updates"],
    range: { min: 60, max: 140 },
    permitLikely: true,
  },
  {
    value: "reconfigure",
    label: "Reconfigure layout",
    oneLiner: "Move walls, doors, or wet areas.",
    includes: ["Wall removal / openings", "Plumbing relocation", "Structural review"],
    range: { min: 120, max: 250 },
    permitLikely: true,
  },
  {
    value: "structural",
    label: "Add space",
    oneLiner: "Build out — addition, ADU, second storey.",
    includes: ["Foundation & framing", "Roof tie-in & MEP rough-in", "Title 24 + full permitting"],
    range: { min: 200, max: 500 },
    permitLikely: true,
  },
];

export const scopeFor = (s?: ScopeTier) =>
  SCOPE_OPTIONS.find((o) => o.value === s);
