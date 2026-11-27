// The house's history for a contractor brief, from the City of San José's own
// file (city-record): every permit in plain words, what's still open, and the
// systems on record ("Electrical panel, 2015, signed off"), so the contractor
// arrives knowing the house. Uses the same reading as the house page.
// Pure; tested in briefHistory.test.ts.
import type { CityRecord } from "./cityRecord";
import { fromCity } from "./cityRecord";
import { homeRecord } from "./homeRecord";
import { certificateEntries, fromRow, systemsOnRecord } from "./houseStory";
import type { ParcelFacts, ParcelPermitLite } from "./prepTypes";

const MAX_PERMITS = 10;
const MAX_HISTORY = 30;

export const briefFromCity = (city: CityRecord | null | undefined, now = new Date()): ParcelFacts | null => {
  if (!city?.found || !city.permits.length) return null;
  const { rows, open, expired } = homeRecord(city.permits.map(fromCity), [], now);
  const real = rows.filter((r) => r.state !== "cancelled");
  if (!real.length) return null;
  const dates = real.map((r) => r.detail.issued ?? r.detail.applied).filter((d): d is string => !!d).sort();
  const permits: ParcelPermitLite[] = real.slice(0, MAX_PERMITS).map((r) => ({
    permit_number: r.permit,
    description: r.what,
    type: r.detail.type,
    valuation: r.detail.valuation,
    issued_date: r.detail.issued ?? r.detail.applied,
    status: r.stateLabel,
    is_open: r.state === "open" || r.state === "in_progress",
    is_expired_without_final: r.state === "expired",
    finaled: r.detail.finaled,
  }));
  return {
    apn: city.property?.apn ?? null,
    zoning: city.property?.zoning ?? null,
    permit_count: real.length,
    open_permit_count: open,
    expired_without_final_count: expired,
    oldest_permit_date: dates[0] ?? null,
    permits,
    history: certificateEntries(real)
      .slice(-MAX_HISTORY)
      .map(({ year, what, status, done }) => ({ year, what, status, done })),
    systems: systemsOnRecord(real.map(fromRow)),
    permit_source: "city",
  };
};
