// Local intake state — backend wiring (Lovable Cloud) is the next step.
// Files live as in-memory object URLs for the session (don't try to JSON-stringify them).
// Everything else IS persisted, so we never ask the user the same question twice.
import { useEffect, useState } from "react";

export type MediaAsset = {
  id: string;
  kind: "video" | "photo" | "floorplan" | "inspiration";
  name: string;
  url: string; // object URL (session-only)
  mime?: string;
  size?: number;
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
  // vibe
  vibes: string[];
  inspirationLink?: string;
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
};

const STORAGE_KEY = "haleo:intake:v2";
const LEGACY_KEY = "haleo:intake";

const empty: IntakeData = {
  painPoints: [],
  vibes: [],
  media: [],
};

// Strip non-serializable bits before persisting.
const serializable = (d: IntakeData) => ({
  ...d,
  // object URLs die on reload; persist metadata only so analysis still works
  media: d.media.map((m) => ({ ...m, url: "" })),
});

const readStored = (): IntakeData => {
  if (typeof window === "undefined") return empty;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { ...empty, ...parsed };
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
  const togglePill = (key: "painPoints" | "vibes", value: string) =>
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
    setData((d) => ({ ...d, media: d.media.filter((m) => m.id !== id) }));
  const reset = () => setData(empty);

  return { data, update, togglePill, addMedia, removeMedia, reset, setData };
};

// Build MediaAssets from a FileList (creates object URLs).
export const filesToAssets = (files: FileList | File[], kind: MediaAsset["kind"]): MediaAsset[] =>
  Array.from(files).map((f) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: f.name,
    url: URL.createObjectURL(f),
    mime: f.type,
    size: f.size,
  }));

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

// ───── Vibes — now with visual metadata so the user can see the feel, not just read it ─────
export type VibeOption = {
  value: string;
  label: string;
  blurb: string;
  swatch: string[]; // 3 HSL color tokens to render as a tiny moodboard
  texture?: string; // a CSS gradient that hints at the material feel
};

export const VIBE_OPTIONS: VibeOption[] = [
  {
    value: "Light and airy",
    label: "Light & airy",
    blurb: "White oak, soft whites, lots of daylight.",
    swatch: ["38 35% 96%", "30 14% 86%", "36 22% 82%"],
    texture: "linear-gradient(135deg, hsl(38 35% 97%), hsl(36 22% 88%))",
  },
  {
    value: "Warm and cozy",
    label: "Warm & cozy",
    blurb: "Walnut, brass, butter-colored linens.",
    swatch: ["28 35% 28%", "36 55% 52%", "36 28% 78%"],
    texture: "linear-gradient(135deg, hsl(36 55% 52%), hsl(28 35% 28%))",
  },
  {
    value: "Clean and minimal",
    label: "Clean & minimal",
    blurb: "Quiet lines, plaster, no fuss.",
    swatch: ["0 0% 96%", "0 0% 86%", "0 0% 22%"],
    texture: "linear-gradient(135deg, hsl(0 0% 97%), hsl(0 0% 86%))",
  },
  {
    value: "Bold and dramatic",
    label: "Bold & dramatic",
    blurb: "Deep tones, rich contrast, statement light.",
    swatch: ["20 14% 14%", "14 55% 42%", "36 55% 52%"],
    texture: "linear-gradient(135deg, hsl(20 14% 14%), hsl(14 55% 42%))",
  },
  {
    value: "Natural and organic",
    label: "Natural & organic",
    blurb: "Stone, raw wood, planted edges.",
    swatch: ["95 14% 38%", "30 28% 62%", "36 22% 82%"],
    texture: "linear-gradient(135deg, hsl(95 18% 62%), hsl(30 28% 62%))",
  },
  {
    value: "Modern and sleek",
    label: "Modern & sleek",
    blurb: "Matte black, slab fronts, hidden hardware.",
    swatch: ["20 6% 14%", "20 6% 36%", "210 8% 70%"],
    texture: "linear-gradient(135deg, hsl(20 6% 14%), hsl(210 8% 70%))",
  },
  {
    value: "Classic and timeless",
    label: "Classic & timeless",
    blurb: "Shaker, marble, polished nickel.",
    swatch: ["210 14% 96%", "30 14% 78%", "210 14% 26%"],
    texture: "linear-gradient(135deg, hsl(210 14% 96%), hsl(30 14% 78%))",
  },
  {
    value: "Calm and spa-like",
    label: "Calm & spa-like",
    blurb: "Limewash, pale stone, soft greens.",
    swatch: ["95 22% 78%", "180 14% 82%", "30 14% 90%"],
    texture: "linear-gradient(135deg, hsl(180 14% 86%), hsl(95 22% 78%))",
  },
  {
    value: "Rustic and lived-in",
    label: "Rustic & lived-in",
    blurb: "Reclaimed wood, terracotta, patina brass.",
    swatch: ["14 55% 42%", "28 35% 28%", "36 28% 62%"],
    texture: "linear-gradient(135deg, hsl(14 55% 42%), hsl(28 35% 28%))",
  },
];

// Backwards-compat — previous code imported VIBES (string[])
export const VIBES = VIBE_OPTIONS.map((v) => v.value);

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
