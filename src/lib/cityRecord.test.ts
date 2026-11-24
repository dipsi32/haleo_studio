import { describe, expect, it } from "vitest";
import { fromCity, primaryDoc, withCityPermits, type CityPermit, type CityRecord } from "./cityRecord";
import { homeRecord } from "./homeRecord";

const doc = (kind: string, id = "1") => ({ id, kind, category: null, date: "2024-01-18", url: `https://permits.sanjoseca.gov/api/public-portal/permit/document?docId=${id}` });
const cp = (o: Partial<CityPermit>): CityPermit => ({
  permit: "2021-033792-RS",
  rsn: "1922657",
  what: "EV Charger And Service",
  scope: null,
  type: "1 & 2 Family Detached Dwellings",
  work: "Sub-Trades Only",
  sub: "Single-Family",
  status: "Expired",
  applied: "2021-06-11",
  issued: "2021-06-11",
  finaled: null,
  expires: "2024-01-15",
  contractors: [],
  docs: [doc("Inspection Notice")],
  ...o,
});
const now = new Date("2026-11-23");

describe("the city's record", () => {
  it("reads each status honestly", () => {
    const rows = homeRecord(
      [
        cp({}),
        cp({ permit: "a", status: "Finaled", finaled: "2025-11-12", issued: "2025-01-22", what: "Addition And Alterations", scope: "CONSTRUCT 92 SQ FT FRONT ADDITION" }),
        cp({ permit: "b", status: "Cancelled", issued: null }),
        cp({ permit: "c", status: "Technical Review", issued: null, applied: "2016-08-01" }),
        cp({ permit: "d", status: "Intake", issued: null, applied: "2026-10-01" }),
        cp({ permit: "e", status: "Under Inspection", issued: "2026-10-07", contractors: ["BAY BUILDERS & REMODELING"] }),
      ].map(fromCity),
      [],
      now,
    ).rows;
    const by = Object.fromEntries(rows.map((r) => [r.permit, [r.state, r.stateLabel]]));
    expect(by["2021-033792-RS"]).toEqual(["expired", "Expired, never signed off"]);
    expect(by.a).toEqual(["finaled", "Finished and signed off"]);
    expect(by.b).toEqual(["cancelled", "Cancelled"]);
    expect(by.c).toEqual(["cancelled", "Applied, never issued"]);
    expect(by.d).toEqual(["in_progress", "In review with the city"]);
    expect(by.e[0]).toBe("in_progress");
    const a = rows.find((r) => r.permit === "a")!;
    expect(a.what).toBe("Addition And Alterations");
    expect(a.detail.description).toMatch(/FRONT ADDITION/);
    expect(rows.find((r) => r.permit === "e")!.contractor).toBe("BAY BUILDERS & REMODELING");
    expect(rows[0].docs).toHaveLength(1);
  });

  it("replaces the feeds' permits only when the city found the house", () => {
    const city: CityRecord = { found: true, property: { apn: "56709011", zoning: "R-1-8", lot: "305", tract: "2645", facts: [], documents: 51 }, permits: [cp({}), cp({ permit: "x" })] };
    const merged = withCityPermits(null, city)!;
    expect(merged.permits).toHaveLength(2);
    expect(merged.apn).toBe("56709011");
    expect(withCityPermits(null, { ...city, found: false })).toBeNull();
  });

  it("opens the permit itself first, when the city imaged it", () => {
    expect(primaryDoc([doc("Inspection Notice", "1"), doc("Permits & Applications · Initial Permit Record", "2")])?.id).toBe("2");
    expect(primaryDoc([doc("Inspection Notice", "1")])?.id).toBe("1");
    expect(primaryDoc([])).toBeNull();
  });
});
