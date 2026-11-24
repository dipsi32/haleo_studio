// The city's own record for a home (the city-record function, reading San
// José's public permit portal): every permit on the parcel with its scope,
// contractor and imaged documents, plus the lot's facts. When we have it, it
// replaces the open-data feeds as the house's permit history, which only
// carry current permits. Pure; tested in cityRecord.test.ts.
import type { ParcelHistory, ParcelPermit } from "./homeData";
import type { CityDoc } from "./homeRecord";

export type CityPermit = {
  permit: string;
  rsn: string;
  what: string;
  scope: string | null;
  type: string | null;
  work: string | null;
  sub: string | null;
  status: string | null;
  applied: string | null;
  issued: string | null;
  finaled: string | null;
  expires: string | null;
  contractors: string[];
  docs: CityDoc[];
};

export type CityRecord = {
  found: boolean;
  property: {
    apn: string | null;
    zoning: string | null;
    lot: string | null;
    tract: string | null;
    facts: { label: string; value: string }[];
    documents: number;
  } | null;
  permits: CityPermit[];
};

/** A city permit, in the shape the house report reads (with the city's extra detail riding along). */
export const fromCity = (c: CityPermit): ParcelPermit => ({
  permit_number: c.permit,
  type: c.type,
  subtype: c.sub,
  description: c.work,
  contractor: c.contractors[0] ?? null,
  valuation: null,
  issued_date: c.issued,
  final_date: c.finaled,
  status: c.status,
  is_open: !c.finaled && !/expired|cancel|withdraw|closed/i.test(c.status ?? ""),
  is_expired_without_final: /expired/i.test(c.status ?? "") && !!c.issued && !c.finaled,
  source: "city",
  what: c.what,
  scope: c.scope,
  contractors: c.contractors,
  docs: c.docs,
  applied: c.applied,
  expires: c.expires,
});

/**
 * The house's permit history: the city's full record when we have it (and
 * it found the house), else the open-data feeds. The street and the rest of
 * the saved lookup ride along either way.
 */
export const withCityPermits = (parcel: ParcelHistory | null, city: CityRecord | null): ParcelHistory | null => {
  if (!city?.found) return parcel;
  const permits = city.permits.map(fromCity);
  const base: ParcelHistory = parcel ?? {
    address_key: "",
    apn: city.property?.apn ?? null,
    permits: [],
    contractors: [],
    permit_count: 0,
    open_permit_count: 0,
    expired_without_final_count: 0,
    most_recent_permit_date: null,
    oldest_permit_date: null,
    lookup_succeeded: true,
    raw_response: null,
  };
  return {
    ...base,
    apn: base.apn ?? city.property?.apn ?? null,
    permits,
    permit_count: permits.length,
    contractors: [...new Set(permits.flatMap((p) => p.contractors ?? []))],
    lookup_succeeded: true,
  };
};

/** The document to open first: the permit itself if it was imaged, else the newest. */
export const primaryDoc = (docs: CityDoc[]): CityDoc | null =>
  docs.find((d) => /initial permit record|permit card|issued permit/i.test(d.kind)) ??
  docs.find((d) => /permits & applications/i.test(d.kind)) ??
  docs.find((d) => /plans/i.test(d.kind)) ??
  docs[0] ??
  null;
