import { describe, expect, it } from "vitest";
import { briefFromCity } from "./briefHistory";
import type { CityPermit, CityRecord } from "./cityRecord";

const permit = (o: Partial<CityPermit>): CityPermit => ({
  permit: "2015-000001-RS",
  rsn: "1",
  what: "Permitted work",
  scope: null,
  type: "Residential",
  work: null,
  sub: null,
  status: "Finaled",
  applied: null,
  issued: null,
  finaled: null,
  expires: null,
  contractors: [],
  docs: [],
  ...o,
});

const city = (permits: CityPermit[]): CityRecord => ({ found: true, property: { apn: "56708016", zoning: "R-1-8", lot: null, tract: null, facts: [], documents: 0 }, permits });

describe("briefFromCity", () => {
  const now = new Date("2026-11-27");
  it("gives the contractor the house's whole story and its systems", () => {
    const f = briefFromCity(
      city([
        permit({ permit: "1960-1", what: "Building Permit", issued: "1960-07-27", finaled: "1960-12-01" }),
        permit({ permit: "2015-1", what: "Service Change", issued: "2015-03-02", finaled: "2015-04-10" }),
        permit({ permit: "2016-1", what: "ReRoof", issued: "2016-05-01", status: "Expired", expires: "2017-05-01" }),
        permit({ permit: "2019-1", what: "Kitchen remodel", status: "Cancelled" }),
      ]),
      now,
    )!;
    expect(f).toMatchObject({ apn: "56708016", zoning: "R-1-8", permit_count: 3, expired_without_final_count: 1, oldest_permit_date: "1960-07-27", permit_source: "city" });
    expect(f.history?.map((h) => `${h.year} ${h.what} · ${h.status}`)).toEqual([
      "1960 Building Permit · Signed off",
      "2015 Service Change · Signed off",
      "2016 ReRoof · Expired, no final",
    ]);
    expect(f.systems).toEqual([
      { system: "Roof", year: 2016, done: false },
      { system: "Electrical panel", year: 2015, done: true },
    ]);
    expect(f.permits?.[0]).toMatchObject({ permit_number: "2016-1", is_expired_without_final: true });
  });

  it("returns nothing when the city has no record", () => {
    expect(briefFromCity({ found: false, property: null, permits: [] })).toBeNull();
    expect(briefFromCity(null)).toBeNull();
  });
});
