// The saved lookups behind a home's record: hazard signals and the parcel's
// permit history, and when a saved copy can be trusted. Pure; tested in
// homeData.test.ts. The fetching lives in useHomeData.ts.

export type RiskSignal = {
  address_key: string;
  fire_hazard_class: string | null;
  fire_hazard_zone: string | null;
  flood_zone: string | null;
  flood_zone_description: string | null;
  in_special_flood_hazard_area: boolean | null;
  seismic_hazard_zone: string | null;
  seismic_hazard_type: string | null;
  lookup_succeeded: boolean | null;
  last_checked_at: string | null;
  raw_response?: {
    geocodeLevel?: string;
    fire?: { approximate?: boolean };
    /** Which hazard checks actually ran. Missing on rows saved before this was tracked. */
    checked?: { fire?: boolean; flood?: boolean; seismic?: boolean };
  } | null;
};

export type ParcelPermit = {
  permit_number: string | null;
  type: string | null;
  subtype: string | null;
  description: string | null;
  contractor: string | null;
  valuation: number | null;
  issued_date: string | null;
  final_date: string | null;
  status: string | null;
  is_open: boolean;
  is_expired_without_final: boolean;
  source?: string | null;
  /** From the city's portal, when we have its record (see cityRecord.ts). */
  what?: string | null;
  scope?: string | null;
  contractors?: string[];
  docs?: import("./homeRecord").CityDoc[];
  applied?: string | null;
  expires?: string | null;
};

export type ParcelHistory = {
  address_key: string;
  apn: string | null;
  permits: ParcelPermit[];
  contractors: string[];
  permit_count: number;
  open_permit_count: number;
  expired_without_final_count: number;
  most_recent_permit_date: string | null;
  oldest_permit_date: string | null;
  lookup_succeeded: boolean;
  last_checked_at?: string | null;
  raw_response?: { feeds?: number; street_name?: string | null; street?: StreetPermit[] } | null;
};

/** A permit on the same street, by block (never the neighbor's house number). */
export type StreetPermit = {
  block: number | null;
  type: string | null;
  subtype: string | null;
  description: string | null;
  contractor: string | null;
  valuation: number | null;
  issued_date: string | null;
  final_date: string | null;
  source: string | null;
  is_expired_without_final: boolean;
};

const DAY = 864e5;
const age = (iso: string | null | undefined, now: Date) => (iso ? now.getTime() - new Date(iso).getTime() : Infinity);

/**
 * A saved permit history is trusted when it read all three city feeds, and,
 * if it found nothing, only for a day: "nothing on file" must not outlive
 * a permit pulled this week.
 */
export const parcelIsFresh = (row: ParcelHistory | null | undefined, now = new Date()): boolean => {
  if (!row || !row.lookup_succeeded) return false;
  const permits = Array.isArray(row.permits) ? row.permits : [];
  // Saved before the street was read: look again so the street shows up.
  if (!Array.isArray(row.raw_response?.street)) return false;
  if (permits.length > 0) return permits.some((p) => p && p.source) && age(row.last_checked_at, now) < 30 * DAY;
  return row.raw_response?.feeds === 3 && age(row.last_checked_at, now) < DAY;
};

/** Saved hazard checks are trusted only when all three ran, within the month. */
export const riskIsFresh = (row: RiskSignal | null | undefined, now = new Date()): boolean => {
  const c = row?.raw_response?.checked;
  return !!row?.lookup_succeeded && !!c?.fire && !!c?.flood && !!c?.seismic && age(row.last_checked_at, now) < 30 * DAY;
};

export const addressKey = (a: { street?: string; city?: string; state?: string; zip?: string }): string =>
  [a.street, a.city, a.state, a.zip].map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ")).join("|");

/** FEMA zones that mean minimal or moderate flood risk (X, B, C). Anything else is never shown as clear. */
export const floodMinimal = (zone: string | null | undefined) => !!zone && /^(X|B|C)\b/i.test(zone.trim());
