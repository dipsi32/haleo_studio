// The house card: a home's record on one shareable image. The verdict, the
// three vitals, the one fact worth knowing, where it came from, and the way
// back to Haleo ("What's on file for your house?"). Built from the same
// report as the page, so the card never says more than the page does.
// Pure; tested in houseCard.test.ts. Drawn by components/house/HouseCard.tsx.
import type { HouseReport, Tone } from "./houseReport";

export type HouseCardModel = {
  /** "2844 Lexford Ave", or "Lexford Ave" when they hide the house number. */
  place: string;
  city: string;
  verdict: [string, string];
  badge: { word: string; tone: Tone | "unknown" };
  rows: { label: string; value: string; tone: Tone | "unknown" }[];
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

  // The one fact worth knowing, most important first.
  const highlight: HouseCardModel["highlight"] = unfinished.length
    ? {
        text: `${unfinished.length === 1 ? "1 permit" : `${unfinished.length} permits`} never got a final inspection. Unfinished permits follow a house to the next job and the sale.`,
        tone: "act",
      }
    : zone
      ? { text: `${zone.title}. ${zone.meaning.split(". ")[0]}.`, tone: "watch" }
      : underway.length && signed.length
        ? { text: `Work underway. City inspectors have signed off ${signed.slice(0, 3).join(", ").toLowerCase()} so far.`, tone: "watch" }
        : r.street && r.street.total > 0
          ? {
              text: `${r.street.total} permit${r.street.total === 1 ? "" : "s"} on ${r.street.name}${r.street.lastYear ? `, ${r.street.lastYear} this past year` : ""}. Most often: ${r.street.kinds
                .slice(0, 2)
                .map((k) => k.kind.toLowerCase())
                .join(" and ")}.`,
              tone: "clear",
            }
          : r.tone === "clear"
            ? { text: "No open or expired permits with the city, and no mapped fire, flood or earthquake zone.", tone: "clear" }
            : null;

  return {
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
