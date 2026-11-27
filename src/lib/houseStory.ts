// A house's story, told from the city's permit file. One source for:
//   House Wrapped (the shareable story), the birth certificate (the
//   frameable history) and the contractor brief ("systems on record").
// Every line is something the city's record says. The only "Our read" is
// the house's persona, and the UI labels it so. Pure; tested in houseStory.test.ts.
import type { RecordRow } from "./homeRecord";

/** The jobs people remember a house by, in the words they'd use. Order = how much it shapes a house. */
const JOBS: { kind: string; label: string; re: RegExp; line: (y: number) => string; system?: string }[] = [
  { kind: "addition", label: "Addition", re: /\baddition|\badu\b|accessory dwelling|garage conv|habitable|second unit|in-law/i, line: (y) => `Grew in ${y}` },
  { kind: "kitchen", label: "Kitchen", re: /kitchen/i, line: (y) => `Kitchen redone in ${y}` },
  { kind: "bath", label: "Bathroom", re: /\bbath/i, line: (y) => `Bathroom redone in ${y}` },
  { kind: "roof", label: "Roof", re: /re-?roof|\broof(?!\s*-?mount)/i, line: (y) => `New roof in ${y}`, system: "Roof" },
  { kind: "solar", label: "Solar", re: /solar|photovolt|\bpv\b/i, line: (y) => `Solar went up in ${y}`, system: "Solar" },
  { kind: "seismic", label: "Seismic retrofit", re: /seismic|brace (&|and) bolt|retrofit/i, line: (y) => `Bolted down for earthquakes in ${y}`, system: "Seismic retrofit" },
  {
    kind: "panel",
    label: "Electrical panel",
    re: /panel upgrade|service upgrade|main panel|service change|electrical panel|\bservice\b.*\bamp/i,
    line: (y) => `Electrical panel upgraded in ${y}`,
    system: "Electrical panel",
  },
  { kind: "ev", label: "EV charger", re: /ev charg|electric vehicle/i, line: (y) => `EV charger added in ${y}`, system: "EV charger" },
  { kind: "hvac", label: "Heating and cooling", re: /hvac|furnace|heat pump|a\/c|air cond|heating and cooling/i, line: (y) => `New heating and cooling in ${y}`, system: "Heating and cooling" },
  { kind: "windows", label: "Window", re: /window/i, line: (y) => `New windows in ${y}`, system: "Windows" },
  { kind: "pool", label: "Pool or spa", re: /\bpool|\bspa\b/i, line: (y) => `Pool or spa work in ${y}` },
  { kind: "repipe", label: "Plumbing", re: /repipe|re-pipe|sewer/i, line: (y) => `Plumbing redone in ${y}`, system: "Plumbing" },
  { kind: "water_heater", label: "Water heater", re: /water heater/i, line: (y) => `New water heater in ${y}`, system: "Water heater" },
  { kind: "remodel", label: "Remodel", re: /remodel|alteration/i, line: (y) => `Remodeled in ${y}` },
];

export type StoryPermit = {
  /** What the work was, in plain words (the city's record, cleaned up). */
  what: string;
  /** The city's own description, when there is one. */
  scope?: string | null;
  year: number | null;
  /** Signed off by the city (a final inspection on file). */
  done: boolean;
  /** Cancelled or never issued: no work was authorized, so it isn't part of the story. */
  void?: boolean;
};

export type Moment = { kind: string; line: string; year: number; done: boolean };

// The permit's own name first ("Solar"), then the city's description ("INSTALL ... ROOF MOUNT PV"):
// a description can mention other things in passing.
const jobOf = (p: StoryPermit) => JOBS.find((j) => j.re.test(p.what)) ?? JOBS.find((j) => j.re.test(p.scope ?? ""));

export const fromRow = (r: RecordRow): StoryPermit => ({
  what: r.what,
  scope: r.detail.description,
  year: r.year,
  done: r.state === "finaled",
  void: r.state === "cancelled",
});

/**
 * The jobs that shaped the house: the latest of each kind, oldest first, so
 * they read as a story. Only work the city signed off is celebrated ("New roof
 * in 2016"); an expired or open permit isn't proof the work happened. A house
 * with no signed-off work says what's on file instead ("Roof permit pulled in 2016").
 */
export const houseMoments = (permits: StoryPermit[], max = 4): Moment[] => {
  const pick = (done: boolean) => {
    const byKind = new Map<string, Moment>();
    for (const p of permits) {
      if (p.void || !p.year || p.done !== done) continue;
      const job = jobOf(p);
      if (!job) continue;
      const have = byKind.get(job.kind);
      if (!have || p.year > have.year)
        byKind.set(job.kind, { kind: job.kind, line: done ? job.line(p.year) : `${job.label} permit pulled in ${p.year}`, year: p.year, done });
    }
    return [...byKind.values()];
  };
  const done = pick(true);
  const chosen = done.length ? done : pick(false);
  const rank = (k: string) => JOBS.findIndex((j) => j.kind === k);
  return chosen
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .slice(0, max)
    .sort((a, b) => a.year - b.year);
};

/** For a contractor: the house's systems and when the city last saw work on each. */
export const systemsOnRecord = (permits: StoryPermit[]): { system: string; year: number; done: boolean }[] => {
  const out = new Map<string, { system: string; year: number; done: boolean }>();
  for (const p of permits) {
    if (p.void || !p.year) continue;
    const job = jobOf(p);
    if (!job?.system) continue;
    const have = out.get(job.system);
    if (!have || p.year > have.year) out.set(job.system, { system: job.system, year: p.year, done: p.done });
  }
  return [...out.values()].sort((a, b) => b.year - a.year);
};

export type Persona = { name: string; line: string };

/** A playful read of the house's pattern. The UI labels it "Our read". */
export const persona = (permits: StoryPermit[], now = new Date()): Persona => {
  const real = permits.filter((p) => !p.void && p.year);
  const kinds = new Set(real.map((p) => jobOf(p)?.kind).filter(Boolean));
  const solar = real.filter((p) => jobOf(p)?.kind === "solar").map((p) => p.year!);
  const recent = real.filter((p) => p.year! >= now.getFullYear() - 3).length;
  if (solar.length && Math.min(...solar) <= 2012) return { name: "The early adopter", line: "Solar before it was everywhere." };
  if (kinds.has("addition")) return { name: "The one that grew", line: "When the family needed room, this house made it." };
  if (recent >= 3) return { name: "The glow-up", line: "A lot of new life in the last few years." };
  if (real.length >= 12) return { name: "The tinkerer", line: "There's almost always a project going." };
  if (real.length <= 3) return { name: "The quiet one", line: "Few permits on file. It's kept to itself." };
  return { name: "The steady one", line: "A little care every few years." };
};

/** Its busiest decade on record, when one stands out. */
export const busiestDecade = (permits: StoryPermit[]): { decade: number; count: number } | null => {
  const counts = new Map<number, number>();
  for (const p of permits) if (!p.void && p.year) counts.set(Math.floor(p.year / 10) * 10, (counts.get(Math.floor(p.year / 10) * 10) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return best && best[1] >= 2 ? { decade: best[0], count: best[1] } : null;
};

export type HouseStory = {
  /** First year on the city's books (the oldest permit on file). Not a build year: the city's file doesn't record one. */
  since: number | null;
  permits: number;
  signedOff: number;
  moments: Moment[];
  decade: { decade: number; count: number } | null;
  persona: Persona;
  /** Permits that expired or stayed open without a final: worth closing. */
  looseEnds: number;
};

export const houseStory = (permits: StoryPermit[], looseEnds = 0, now = new Date()): HouseStory => {
  const real = permits.filter((p) => !p.void);
  const years = real.map((p) => p.year).filter((y): y is number => !!y);
  return {
    since: years.length ? Math.min(...years) : null,
    permits: real.length,
    signedOff: real.filter((p) => p.done).length,
    moments: houseMoments(real),
    decade: busiestDecade(real),
    persona: persona(real, now),
    looseEnds,
  };
};

/** The share line: "Lenora Ave. On the books since 1960. 17 permits. New roof in 2016. Solar went up in 2015." */
export const storyLine = (place: string, s: HouseStory): string =>
  [
    `${place}.`,
    s.since ? `On the city's books since ${s.since}.` : null,
    s.permits ? `${s.permits} permit${s.permits === 1 ? "" : "s"}.` : null,
    ...s.moments.slice(-3).map((m) => `${m.line}.`),
  ]
    .filter(Boolean)
    .join(" ");

export type CertificateEntry = { year: number | null; what: string; status: string; done: boolean };

const STATUS: Record<string, string> = {
  finaled: "Signed off",
  expired: "Expired, no final",
  open: "Open",
  in_progress: "In progress",
  unknown: "No final on record",
};

/** Every permit that authorized work, oldest first: the house's life on one page. */
export const certificateEntries = (rows: RecordRow[]): CertificateEntry[] =>
  rows
    .filter((r) => r.state !== "cancelled")
    .map((r) => ({ year: r.year, what: r.what, status: STATUS[r.state] ?? r.stateLabel, done: r.state === "finaled" }))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
