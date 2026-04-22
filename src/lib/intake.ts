// Local intake state — backend wiring comes later.
import { useEffect, useState } from "react";

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
  // media
  hasWalkthrough?: boolean;
  hasFloorPlan?: boolean;
  // pain
  painPoints: string[];
  // addition
  additionType?: AdditionType;
  additionSize?: number;
  additionLocation?: AdditionLocation;
  // photos
  hasPhotos?: boolean;
  // manual measurements (alternative to floor plan)
  measurements?: string;
  // capture method chosen on the "Show your space" step
  captureMethod?: "video" | "photos" | "floorplan" | "measurements";
  // vibe
  vibes: string[];
  hasInspiration?: boolean;
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
};

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  const reset = () => setData(empty);

  return { data, update, togglePill, reset, setData };
};

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
