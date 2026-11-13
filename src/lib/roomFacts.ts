// Two quick facts a contractor prices from first, asked in the homeowner's
// words: roughly how big the room is, and the finish level they have in mind.
// Both optional; "Not sure" is a fine answer and reads as an open question,
// never as a gap.
import type { IntakeData, Room } from "@/lib/intake";
import { detectProject } from "@/lib/projectDetect";

/** The room the project is about: what they picked, else what they typed ("redo our kitchen"). */
export const primaryRoom = (d: Pick<IntakeData, "room" | "rooms" | "goalNote">): Room | undefined => {
  if (d.room && d.room !== "other") return d.room;
  if (d.rooms?.length) return d.rooms[0];
  const typed = d.goalNote ? detectProject(d.goalNote).rooms : [];
  return typed[0] ?? d.room;
};

export type RoomSize = { bucket: "small" | "medium" | "large" | "xl" | "unsure"; sqft?: number };
export type FinishLevel = "basic" | "mid" | "high" | "unsure";

type Bucket = { value: RoomSize["bucket"]; label: string; range: string };

// Typical ranges for each kind of room, so "Medium" means something.
const KITCHEN: Bucket[] = [
  { value: "small", label: "Small", range: "under 100 sq ft" },
  { value: "medium", label: "Medium", range: "100–200 sq ft" },
  { value: "large", label: "Large", range: "200–300 sq ft" },
  { value: "xl", label: "Very large", range: "300+ sq ft" },
];
const BATH: Bucket[] = [
  { value: "small", label: "Small", range: "under 40 sq ft" },
  { value: "medium", label: "Medium", range: "40–80 sq ft" },
  { value: "large", label: "Large", range: "80–120 sq ft" },
  { value: "xl", label: "Very large", range: "120+ sq ft" },
];
const ROOM: Bucket[] = [
  { value: "small", label: "Small", range: "under 120 sq ft" },
  { value: "medium", label: "Medium", range: "120–250 sq ft" },
  { value: "large", label: "Large", range: "250–400 sq ft" },
  { value: "xl", label: "Very large", range: "400+ sq ft" },
];
const HOME: Bucket[] = [
  { value: "small", label: "Small home", range: "under 1,200 sq ft" },
  { value: "medium", label: "Medium home", range: "1,200–2,000 sq ft" },
  { value: "large", label: "Large home", range: "2,000–3,000 sq ft" },
  { value: "xl", label: "Very large home", range: "3,000+ sq ft" },
];

export const sizeBuckets = (room?: Room | null): Bucket[] =>
  room === "kitchen" ? KITCHEN : room === "bathroom" ? BATH : room === "full-home" ? HOME : ROOM;

export const FINISH_LEVELS: { value: FinishLevel; label: string; hint: string }[] = [
  { value: "basic", label: "Budget-friendly", hint: "Stock materials, keep costs down" },
  { value: "mid", label: "Mid-range", hint: "Good quality, some upgrades" },
  { value: "high", label: "High-end", hint: "Custom, premium finishes" },
  { value: "unsure", label: "Not sure yet", hint: "Happy to talk it through" },
];

/** "Medium, 100–200 sq ft", "About 150 sq ft", or null. */
export const sizeLabel = (size: RoomSize | null | undefined, room?: Room | null): string | null => {
  if (!size) return null;
  if (size.sqft && size.sqft > 0) return `About ${Math.round(size.sqft).toLocaleString("en-US")} sq ft`;
  if (size.bucket === "unsure") return "Size not sure yet";
  const b = sizeBuckets(room).find((x) => x.value === size.bucket);
  return b ? `${b.label}, ${b.range}` : null;
};

export const finishLabel = (f: FinishLevel | null | undefined): string | null =>
  f ? (FINISH_LEVELS.find((x) => x.value === f)?.label ?? null) : null;

/** "150", "150 sqft", "12x14" → square feet, or null. */
export const parseSqft = (raw: string): number | null => {
  const s = raw.toLowerCase().replace(/,/g, "").trim();
  const dims = /^(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/.exec(s);
  if (dims) {
    const v = Number(dims[1]) * Number(dims[2]);
    return v >= 10 && v <= 20000 ? Math.round(v) : null;
  }
  const n = /^(\d+(?:\.\d+)?)/.exec(s);
  if (!n) return null;
  const v = Number(n[1]);
  return v >= 10 && v <= 20000 ? Math.round(v) : null;
};
