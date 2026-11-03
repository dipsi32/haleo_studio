// While a homeowner fills in their project through a contractor's link, the
// contractor's public record speaks to *their* project, one fact at a time:
// pick "Kitchen" and it says how many kitchen permits this contractor has
// pulled; add the address and it says how many jobs were in their ZIP code.
//
// Rules: only true, favorable facts from the permit record. A fact that isn't
// favorable is simply not shown (never stated as a negative here; the full
// record is one tap away on the invite page). Nothing is estimated.
import type { Permit } from "@/lib/contractors";
import type { IntakeData, ProjectGoal, Room } from "@/lib/intake";
import { matchesKeyword } from "@/lib/proof";
import { detectProject } from "@/lib/projectDetect";

export type RecordPermit = Pick<Permit, "city" | "zip" | "issued_date" | "work_type" | "description">;

export type Highlight = {
  /** Which answer unlocked it, so the newest can be highlighted. */
  id: "track" | "work" | "nearby" | "structural";
  text: string;
};

type Work = { word: string; keywords: string[] };

// What a permit description says for each kind of job. Kept narrow on purpose:
// "3 kitchen permits" must mean kitchen work.
const ROOM_WORK: Partial<Record<Room, Work>> = {
  kitchen: { word: "kitchen", keywords: ["kitchen"] },
  bathroom: { word: "bathroom", keywords: ["bath"] },
  addition: { word: "addition and ADU", keywords: ["addition", "adu", "accessory dwelling"] },
  "full-home": { word: "remodel", keywords: ["remodel", "alteration"] },
};

const GOAL_WORK: Partial<Record<ProjectGoal, Work>> = {
  roof: { word: "roofing", keywords: ["roof"] },
  electrical: { word: "electrical", keywords: ["electric", "service upgrade", "panel"] },
  plumbing: { word: "plumbing", keywords: ["plumb", "repipe", "sewer", "water heater"] },
  hvac: { word: "heating and cooling", keywords: ["hvac", "furnace", "heat pump", "mechanical"] },
  "pool-removal": { word: "pool", keywords: ["pool"] },
  demolition: { word: "demolition", keywords: ["demo"] },
  landscape: { word: "landscape and hardscape", keywords: ["landscap", "retaining", "patio", "fence", "driveway"] },
  foundation: { word: "foundation and structural", keywords: ["foundation", "retrofit", "seismic"] },
  "windows-doors": { word: "window and door", keywords: ["window", "door"] },
  exterior: { word: "siding and exterior", keywords: ["siding", "stucco", "exterior"] },
  "garage-conversion": { word: "garage conversion", keywords: ["garage"] },
  "adu-addition": { word: "addition and ADU", keywords: ["addition", "adu", "accessory dwelling"] },
};

const STRUCTURAL = ["structural", "foundation", "addition", "beam", "load bearing", "bearing wall", "framing", "retrofit", "second story", "adu", "accessory dwelling", "new construction"];

/**
 * The kind of work they described, if we can name it reliably. Uses what
 * they've picked, and otherwise what they've typed so far, so the card
 * answers as they write ("redo our kitchen" → kitchen).
 */
export const workFor = (d: IntakeData): Work | null => {
  const typed = d.goalNote ? detectProject(d.goalNote) : { rooms: [], goals: [] };
  const goals = d.goals?.length ? d.goals : typed.goals;
  for (const g of goals) if (GOAL_WORK[g]) return GOAL_WORK[g]!;
  const rooms = d.rooms?.length ? d.rooms : d.room && d.room !== "other" ? [d.room] : typed.rooms;
  for (const r of rooms) if (ROOM_WORK[r]) return ROOM_WORK[r]!;
  return null;
};

const hay = (p: RecordPermit) => `${p.work_type ?? ""} ${p.description ?? ""}`.toLowerCase();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export const recordHighlights = (permits: RecordPermit[], d: IntakeData, who: string, now: Date = new Date()): Highlight[] => {
  if (permits.length === 0) return [];
  const out: Highlight[] = [];
  const city = permits.find((p) => p.city)?.city ?? null;
  const where = city ? ` in ${city.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase())}` : "";

  // Always: their track record, framed by how long and how recent.
  const dates = permits.map((p) => p.issued_date).filter((x): x is string => !!x).sort();
  const latest = dates[dates.length - 1];
  const recent = latest && now.getTime() - new Date(latest).getTime() < 120 * 864e5;
  out.push({
    id: "track",
    text: `${who} has ${plural(permits.length, "permit")} on file${where}${dates[0] ? ` since ${new Date(dates[0]).getUTCFullYear()}` : ""}${recent ? `, and pulled one as recently as ${monthYear(latest!)}` : ""}.`,
  });

  // Their kind of job.
  const work = workFor(d);
  if (work) {
    const match = permits.filter((p) => work.keywords.some((k) => matchesKeyword(hay(p), k)));
    if (match.length > 0) {
      const last = match.map((p) => p.issued_date).filter((x): x is string => !!x).sort().pop();
      out.push({
        id: "work",
        text: `${plural(match.length, `${work.word} permit`)}${where}${last ? `, the latest in ${monthYear(last)}` : ""}. That's the kind of work you're planning.`,
      });
    }
  }

  // Their neighborhood.
  const zip = d.address && !d.address.skipped ? d.address.zip?.trim() : undefined;
  if (zip && /^\d{5}$/.test(zip)) {
    const near = permits.filter((p) => (p.zip ?? "").startsWith(zip)).length;
    if (near > 0) out.push({ id: "nearby", text: `${plural(near, "job")} in ${zip}, your ZIP code. They know your city's inspectors and your neighborhood's homes.` });
  }

  // Bigger scope: walls moving, structure, additions.
  if (d.scope === "structural" || d.scope === "reconfigure" || d.room === "addition") {
    const n = permits.filter((p) => STRUCTURAL.some((k) => matchesKeyword(hay(p), k))).length;
    if (n > 0) out.push({ id: "structural", text: `${plural(n, "permit")} involving structural work, like walls, foundations and additions.` });
  }

  return out;
};
