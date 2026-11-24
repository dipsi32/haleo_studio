// The house card: a home's record on one shareable image. The verdict, the
// three vitals, the one fact worth knowing, where it came from, and the way
// back to Haleo ("What's on file for your house?"). Built from the same
// report as the page, so the card never says more than the page does.
// Pure; tested in houseCard.test.ts. Drawn by components/house/HouseCard.tsx.
import { topKinds, type HouseReport, type Tone } from "./houseReport";

export type HouseCardModel = {
  /** "2844 Lexford Ave", or "Lexford Ave" when they hide the house number. */
  place: string;
  city: string;
  verdict: [string, string];
  badge: { word: string; tone: Tone | "unknown" };
  rows: { label: string; value: string; tone: Tone | "unknown" }[];
  /** This house: the permits, in two words and a line. */
  house: { value: string; detail: string | null; tone: Tone | "unknown" };
  /** The ground: each hazard map at a glance. */
  ground: { label: string; status: "clear" | "zone" | "unrated" | "unchecked" }[];
  /** The home's own permit history, newest first: the heart of the card. */
  history: { year: number | null; what: string; mark: "done" | "open" | "unfinished" | "unknown" }[];
  /** Permits on file beyond the ones shown. */
  historyMore: number;
  /** Who pulled permits on this house. */
  crew: string[];
  /** The street, or (with no street data) the latest work on the house. */
  around: { label: string; value: string; detail: string | null } | null;
  /** The one thing worth knowing, in a sentence. */
  highlight: { text: string; tone: Tone | "unknown" } | null;
  checkedOn: string;
  sources: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2844 lexford ave" → "Lexford Ave" (for posting where neighbors can see). */
export const streetOnly = (street: string) =>
  street
    .trim()
    .replace(/^\d+[a-z]?\s+/i, "")
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());

// "BAY BUILDERS & REMODELING" → "Bay Builders & Remodeling"; "BAKHTIARY, MEHDI" → "Mehdi Bakhtiary".
const tidyCrew = (s: string) => {
  const t = s.trim();
  const flipped = /^[A-Z'-]+, [A-Z'-]+$/.test(t) ? t.split(", ").reverse().join(" ") : t;
  return flipped === flipped.toUpperCase() ? flipped.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Lp|Dba)\b/g, (m) => m.toUpperCase()) : flipped;
};

const tidyStreet = (street: string) => street.trim().replace(/\s+/g, " ").replace(/\b([a-z])/g, (m) => m.toUpperCase());

export const houseCard = (
  r: Pick<HouseReport, "verdict" | "badge" | "vitals" | "rows" | "ground" | "street" | "tone">,
  o: { street: string; zip: string; hideNumber?: boolean; now?: Date },
): HouseCardModel => {
  const now = o.now ?? new Date();
  const unfinished = r.rows.filter((x) => x.state === "expired" || x.state === "open");
  const underway = r.rows.filter((x) => x.state === "in_progress");
  const signed = [...new Set(r.rows.flatMap((x) => x.signoffs))];
  const zone = r.ground.find((g) => g.status === "zone");

  // The one line the tiles can't say: what to do about the most important one,
  // or the fact behind it. Never a repeat of a tile.
  const unrated = r.ground.find((g) => g.status === "unrated");
  const crewOnStreet = r.street?.crew[0];
  const highlight: HouseCardModel["highlight"] = unfinished.length
    ? { text: `Before you buy or remodel: get ${unfinished.length === 1 ? "the unfinished permit" : `the ${unfinished.length} unfinished permits`} finaled. They follow the house.`, tone: "act" }
    : zone
      ? { text: `${zone.title}. ${zone.meaning.split(". ")[0]}.`, tone: "watch" }
      : underway.length
        ? { text: "Before you buy or remodel: make sure the open work gets its final inspection.", tone: "watch" }
        : unrated
          ? { text: "FEMA hasn't rated flood risk here, so it isn't cleared. Ask about drainage before grading work.", tone: "unknown" }
          : crewOnStreet && r.street
            ? { text: `${crewOnStreet.name} has ${crewOnStreet.count} permit${crewOnStreet.count === 1 ? "" : "s"} on ${r.street.name}: the crew your neighbors hire.`, tone: "clear" }
            : r.tone === "clear"
              ? { text: "Nothing to close out and no mapped hazards. Worth keeping for when you sell.", tone: "clear" }
              : null;

  const permitsVital = r.vitals.find((v) => v.id === "permits");
  const finished = r.rows.filter((x) => x.state === "finaled").length;
  const house: HouseCardModel["house"] = {
    value: unfinished.length
      ? `${unfinished.length} unfinished`
      : underway.length
        ? `${underway.length} open`
        : r.rows.length
          ? `${r.rows.length} closed`
          : permitsVital?.tone === "unknown"
            ? "Not checked"
            : "None open",
    detail: unfinished.length
      ? "Never got a final"
      : underway.length
        ? signed.length
          ? `Passed: ${signed.slice(0, 2).join(", ").toLowerCase()}`
          : "Work underway"
        : r.rows.length
          ? `${finished || r.rows.length} signed off`
          : permitsVital?.tone === "unknown"
            ? null
            : "Nothing unfinished",
    tone: unfinished.length ? "act" : underway.length ? "watch" : permitsVital?.tone === "unknown" ? "unknown" : "clear",
  };
  const NAMES = { fire: "Fire", flood: "Flood", seismic: "Quake" } as const;
  const ground = r.ground.map((g) => ({ label: NAMES[g.id], status: g.status }));
  const latest = r.vitals.find((v) => v.id === "latest");
  const around: HouseCardModel["around"] =
    r.street && r.street.total > 0
      ? {
          label: r.street.name.length <= 11 ? r.street.name : "Your street",
          value: `${r.street.total} permit${r.street.total === 1 ? "" : "s"}`,
          detail: topKinds(r.street.kinds, 1) ? `Mostly ${topKinds(r.street.kinds, 1)}` : r.street.lastYear ? `${r.street.lastYear} this past year` : null,
        }
      : latest && latest.tone !== "unknown"
        ? { label: "Latest work", value: latest.value.split(" · ")[0], detail: latest.value.split(" · ")[1] ?? null }
        : null;

  const MARKS = { finaled: "done", in_progress: "open", open: "unfinished", expired: "unfinished", cancelled: "unknown", unknown: "unknown" } as const;
  const HISTORY_ROWS = 4;
  // The card shows work that happened (or should have): cancelled applications stay on the page, off the card.
  const real = r.rows.filter((x) => x.state !== "cancelled");
  const history = real.slice(0, HISTORY_ROWS).map((x) => ({
    year: x.year,
    // The card is small: the first clause of the city's description is enough.
    what: x.what.split(/[,;(]/)[0].trim().slice(0, 34),
    mark: MARKS[x.state],
  }));
  const crewNames = [...new Set(r.rows.map((x) => x.contractor).filter((c): c is string => !!c))].map(tidyCrew);

  return {
    history,
    historyMore: Math.max(0, real.length - HISTORY_ROWS),
    crew: crewNames.slice(0, 3),
    house,
    ground,
    around,
    place: o.hideNumber ? streetOnly(o.street) : tidyStreet(o.street),
    city: o.hideNumber ? "San José" : `San José ${o.zip}`,
    verdict: r.verdict,
    badge: r.badge,
    rows: r.vitals.map((v) => ({ label: v.label, value: v.value, tone: v.tone })),
    highlight,
    checkedOn: `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    sources: "City of San José permits · CAL FIRE · FEMA · CA Geological Survey",
  };
};

/** The way back for whoever sees the card: the tool, never this address. */
export const cardLink = (origin: string) => `${origin.replace(/\/$/, "")}/house?ref=card`;
export const cardLinkLabel = (origin: string) => `${origin.replace(/^https?:\/\//, "").replace(/\/$/, "")}/house`;

/** A file name that says what it is: "haleo-lexford-ave.png". */
export const cardFileName = (place: string) =>
  `haleo-${place
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.png`;
