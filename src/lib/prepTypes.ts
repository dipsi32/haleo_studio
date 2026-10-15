// Shapes shared by the brief snapshot and the visit prep sheet.
// Kept apart from contractors.ts and visitPrep.ts so neither imports the other.

// ───── Public-record facts attached to a brief when it is sent ─────
export type ParcelPermitLite = {
  permit_number: string | null;
  description: string | null;
  type: string | null;
  valuation: number | null;
  issued_date: string | null;
  status: string | null;
  is_open: boolean;
  is_expired_without_final: boolean;
};

export type ParcelFacts = {
  apn?: string | null;
  lot_size_sqft?: number | null;
  zoning?: string | null;
  primary_dwelling_sqft?: number | null;
  existing_footprints_sqft?: number | null;
  permit_count?: number;
  open_permit_count?: number;
  expired_without_final_count?: number;
  oldest_permit_date?: string | null;
  /** Newest first, capped, so a snapshot stays small. */
  permits?: ParcelPermitLite[];
};

// ───── What only the homeowner can say (all optional, all in their words) ─────
export const WHY_NOW_OPTIONS = [
  { value: "family", label: "Our family is growing", read: "Growing family" },
  { value: "moving-in", label: "A parent or relative is moving in", read: "A relative is moving in" },
  { value: "rental", label: "Rental income", read: "Rental income" },
  { value: "selling", label: "Getting ready to sell", read: "Preparing to sell" },
  { value: "improve", label: "Making the home work better for us", read: "Making the home work better" },
] as const;

export const WHO_DECIDES_OPTIONS = [
  { value: "me", label: "Just me", read: "Decides alone" },
  { value: "partner", label: "Me and my partner", read: "Decides with a partner" },
  { value: "others", label: "A few of us weigh in", read: "Several people weigh in" },
] as const;

export const FUNDING_OPTIONS = [
  { value: "cash", label: "Savings", read: "Savings" },
  { value: "heloc", label: "Home equity loan or line", read: "Home equity loan or line" },
  { value: "construction-loan", label: "Construction loan", read: "Construction loan" },
  { value: "unsure", label: "Still working it out", read: "Still working out funding" },
] as const;

export const SHOPPING_OPTIONS = [
  { value: "only", label: "Just this contractor for now", read: "Talking only with you so far" },
  { value: "few", label: "A couple of others", read: "Also talking with a couple of others" },
  { value: "many", label: "Still looking around", read: "Still looking around" },
] as const;

type Opt<T extends readonly { value: string }[]> = T[number]["value"];

export type HomeownerContext = {
  why_now?: Opt<typeof WHY_NOW_OPTIONS>;
  who_decides?: Opt<typeof WHO_DECIDES_OPTIONS>;
  funding?: Opt<typeof FUNDING_OPTIONS>;
  shopping?: Opt<typeof SHOPPING_OPTIONS>;
  /** Free text: "we need it done before school starts". */
  hard_date?: string;
  /** Free text: anything from past projects they would like handled differently. */
  past_note?: string;
};

export const CONTEXT_TEXT_LIMIT = 200;

export const hasContext = (c: HomeownerContext | null | undefined): boolean =>
  Boolean(c && (c.why_now || c.who_decides || c.funding || c.shopping || c.hard_date?.trim() || c.past_note?.trim()));

/** Drop empty strings and trim, so a snapshot carries only what was said. */
export const cleanContext = (c: HomeownerContext): HomeownerContext | undefined => {
  const out: HomeownerContext = {};
  if (c.why_now) out.why_now = c.why_now;
  if (c.who_decides) out.who_decides = c.who_decides;
  if (c.funding) out.funding = c.funding;
  if (c.shopping) out.shopping = c.shopping;
  const hd = c.hard_date?.trim().slice(0, CONTEXT_TEXT_LIMIT);
  if (hd) out.hard_date = hd;
  const pn = c.past_note?.trim().slice(0, CONTEXT_TEXT_LIMIT);
  if (pn) out.past_note = pn;
  return hasContext(out) ? out : undefined;
};
