// Contractors a homeowner picked before their brief was done ("Ask if
// they're interested"), carried through the brief and back to the match page.
const KEY = "haleo:picks";
export type Pick = { id: string; name: string };

export const savePicks = (picks: Pick[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(picks.slice(0, 10)));
  } catch {
    /* private mode: they can pick again after the brief */
  }
};
export const readPicks = (): Pick[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((p) => p && typeof p.id === "string" && typeof p.name === "string") : [];
  } catch {
    return [];
  }
};
export const clearPicks = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
/** "Oak & Stone", "Oak & Stone and Ridgeline", "Oak & Stone, Ridgeline and 2 more". */
export const pickNames = (picks: Pick[]): string => {
  const n = picks.map((p) => p.name);
  if (n.length <= 2) return n.join(" and ");
  if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]}`;
  return `${n[0]}, ${n[1]} and ${n.length - 2} more`;
};
