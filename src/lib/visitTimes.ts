// Visit times a homeowner suggests when they send a brief through a
// contractor's link. Light on purpose: a day and a part of the day, up to
// three. The contractor confirms one. Stored as "YYYY-MM-DD|morning".
export type DayPart = "morning" | "afternoon" | "evening";

export const DAY_PARTS: { id: DayPart; label: string; hours: string }[] = [
  { id: "morning", label: "Morning", hours: "8–12" },
  { id: "afternoon", label: "Afternoon", hours: "12–4" },
  { id: "evening", label: "Evening", hours: "4–7" },
];

export const MAX_VISIT_TIMES = 3;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The next `count` days, starting tomorrow (a same-day visit is rarely realistic). */
export const upcomingDays = (count = 12, from: Date = new Date()): { iso: string; weekday: string; day: number; month: string }[] => {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push({
      iso: isoDay(d),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return out;
};

export const visitKey = (iso: string, part: DayPart) => `${iso}|${part}`;

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})\|(morning|afternoon|evening)$/;

export const isVisitTime = (s: unknown): s is string => typeof s === "string" && KEY_RE.test(s);

/** "Thu, Nov 5 · morning" */
export const formatVisitTime = (key: string): string => {
  const m = KEY_RE.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${date} · ${m[4]}`;
};

/** Keep only well-formed, de-duplicated times, in date order, capped. */
export const cleanVisitTimes = (xs: unknown): string[] =>
  Array.isArray(xs) ? [...new Set(xs.filter(isVisitTime))].sort().slice(0, MAX_VISIT_TIMES) : [];
