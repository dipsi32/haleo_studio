// "Which city next?": anyone outside San José votes for their city. The tally
// is the demand map. Pure helpers; tested in cityNext.test.ts.

/** "  palo   alto " → "Palo Alto"; "st. louis" → "St. Louis". */
export const tidyCity = (s: string): string =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_m, a: string, b: string) => a + b.toUpperCase())
    .slice(0, 60);

/** One key per city, however it's typed: "Palo Alto, CA" and "palo  alto ca" match. */
export const cityKey = (city: string, state?: string | null): string =>
  `${city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()}|${(state ?? "").toUpperCase()}`;

/** "Austin, TX" → { city: "Austin", state: "TX" }; "Austin" → state undefined. */
export const parseCity = (raw: string): { city: string; state?: string } => {
  const m = raw.trim().match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  if (m && STATES.has(m[2].toUpperCase()) && m[1].trim().length >= 2) return { city: tidyCity(m[1]), state: m[2].toUpperCase() };
  return { city: tidyCity(raw) };
};

export const isSanJose = (city: string, state?: string | null) =>
  cityKey(city, "") === "san jose|" && (!state || state.toUpperCase() === "CA");

// ZIP prefix → state, by the first three digits (USPS ranges). Enough to
// prefill the state; the person can change it.
const RANGES: [number, number, string][] = [
  [5, 5, "NY"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"],
  [70, 89, "NJ"], [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"],
  [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"],
  [350, 369, "AL"], [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"],
  [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"], [570, 577, "SD"],
  [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"],
  [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"],
  [832, 838, "ID"], [840, 847, "UT"], [850, 865, "AZ"], [870, 884, "NM"], [889, 898, "NV"], [900, 961, "CA"],
  [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
];

export const stateForZip = (zip: string): string | null => {
  if (!/^\d{5}$/.test(zip.trim())) return null;
  const p = Number(zip.trim().slice(0, 3));
  return RANGES.find(([a, b]) => p >= a && p <= b)?.[2] ?? null;
};

export const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

export type TallyRow = { city: string; state: string | null; city_key: string; votes: number; total_votes: number; total_cities: number };

/** The leaderboard, with the person's own city kept on it even when it's outside the top. */
export const leaderboard = (rows: TallyRow[], mine?: string | null, top = 8) => {
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1, mine: !!mine && r.city_key === mine }));
  const head = ranked.slice(0, top);
  const own = ranked.find((r) => r.mine);
  return { rows: own && !head.includes(own) ? [...head, own] : head, max: Math.max(1, ...ranked.map((r) => r.votes)) };
};

/** The link a voter sends to neighbors: opens with their city filled in. */
export const voteLink = (origin: string, city: string, state?: string | null) =>
  `${origin.replace(/\/$/, "")}/next?${new URLSearchParams({ city, ...(state ? { state } : {}), ref: "vote" }).toString()}`;
