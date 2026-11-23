import { describe, expect, it } from "vitest";
import { areaContractors, onStreet, streetOf, type AreaPermit } from "./areaContractors";

const p = (o: Partial<AreaPermit>): AreaPermit => ({ contractor_id: "a", address: "5343 LENORA AV", work_type: null, description: "Reroof", issued_date: "2026-05-01", ...o });

describe("areaContractors", () => {
  it("never keeps a house number", () => {
    expect(streetOf("5343 LENORA AV")).toBe("Lenora Ave");
    expect(streetOf("12B N 1ST ST, SAN JOSE")).toBe("N 1st St");
    expect(streetOf("100-104 ALMADEN BL #3")).toBe("Almaden Blvd");
    expect(streetOf("")).toBeNull();
  });

  it("groups each contractor's work: how much, what kind, which streets", () => {
    const names = new Map([
      ["a", "ACME ROOFING INC"],
      ["b", "BAKHTIARY, MEHDI"],
    ]);
    const out = areaContractors(
      [
        p({}),
        p({ address: "5301 LENORA AV", description: "Install PV solar" }),
        p({ address: "1200 CHERRY AV", issued_date: "2023-01-01" }),
        p({ contractor_id: "b", address: "900 CAMDEN AV", description: "Kitchen remodel" }),
        p({ contractor_id: "zz" }),
      ],
      names,
      new Date("2026-11-23"),
    );
    expect(out[0]).toMatchObject({ id: "a", name: "Acme Roofing Inc", count: 3, lastYear: 2, latest: "2026-05-01", kinds: ["Roof", "Solar"] });
    expect(out[0].streets).toEqual([
      { name: "Lenora Ave", count: 2 },
      { name: "Cherry Ave", count: 1 },
    ]);
    expect(out[1]).toMatchObject({ name: "Mehdi Bakhtiary", kinds: ["Kitchen"] });
    expect(onStreet(out[0], "Lenora Ave")).toBe(true);
    expect(onStreet(out[1], "Lenora Ave")).toBe(false);
  });
});
