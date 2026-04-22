// Local intake state — backend wiring comes later.
// Files live as in-memory object URLs for the session (don't try to JSON-stringify them).
import { useEffect, useState } from "react";

export type MediaAsset = {
  id: string;
  kind: "video" | "photo" | "floorplan" | "inspiration";
  name: string;
  url: string; // object URL
  mime?: string;
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
  // optional rough notes — vision doc explicitly mentions "rough notes"
  notes?: string;
  // manual measurements (alternative to floor plan)
  measurements?: string;
  // vibe
  vibes: string[];
  inspirationLink?: string;
  // budget
  budgetMin?: number;
  budgetMax?: number;
  budgetSkipped?: boolean;
  // timeline
  timeline?: Timeline;
};

const STORAGE_KEY = "haleo:intake";

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

export const useIntake = () => {
  const [data, setData] = useState<IntakeData>(() => {
    if (typeof window === "undefined") return empty;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...empty, ...JSON.parse(raw) } : empty;
    } catch {
      return empty;
    }
  });

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
  }));

export const hasKind = (d: IntakeData, k: MediaAsset["kind"]) => d.media.some((m) => m.kind === k);

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

export const VIBES = [
  "Light and airy",
  "Warm and cozy",
  "Clean and minimal",
  "Bold and dramatic",
  "Natural and organic",
  "Modern and sleek",
  "Classic and timeless",
  "Calm and spa-like",
  "Rustic and lived-in",
];
