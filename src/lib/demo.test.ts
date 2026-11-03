import { describe, expect, it } from "vitest";
import { computeVisitPrep } from "./visitPrep";
import { recordHighlights } from "./recordHighlights";
import { DEMO_BUY_BOX, recordFacts, demoIntake, demoSnapshot, demoUrl, demoVisitOptions, resolveDemo, topZips } from "./demo";

// Mehdi's San Jose record as of Nov 2026, after job names are kept.
const permits = [
  { city: "San Jose", zip: "95124", issued_date: "2026-04-01", work_type: "1 & 2 Family Detached Dwellings", description: "Single-Family — Additions/Alterations" },
  { city: "San Jose", zip: "95118", issued_date: "2026-02-12", work_type: "1 & 2 Family Detached Dwellings", description: "Single-Family — Additions/Alterations" },
  { city: "San Jose", zip: "95125", issued_date: "2025-12-26", work_type: "1 & 2 Family Detached Dwellings", description: "Kitchen remodel · Single-Family — Additions/Alterations" },
  { city: "San Jose", zip: "95125", issued_date: "2025-08-14", work_type: "1 & 2 Family Detached Dwellings", description: "Single-Family — Sub-Trades Only" },
];

describe("resolveDemo", () => {
  it("finds a known contractor by slug", () => {
    const d = resolveDemo("us-creative-builders", new URLSearchParams());
    expect(d).toMatchObject({ brand: "US Creative Builders", person: "Mehdi", recordName: "BAKHTIARY, MEHDI" });
  });
  it("builds one from the link for anyone else", () => {
    const d = resolveDemo(undefined, new URLSearchParams("record=ACME BUILDERS INC&person=Sam"));
    expect(d).toMatchObject({ brand: "Acme Builders Inc", person: "Sam", slug: "acme-builders-inc", brandColor: null, licenseNumber: null });
    expect(demoUrl(d!, "https://haleo.pages.dev")).toBe("https://haleo.pages.dev/demo?record=ACME+BUILDERS+INC&brand=Acme+Builders+Inc&person=Sam");
  });
  it("takes their color, license and site from the link, and nothing malformed", () => {
    const d = resolveDemo(undefined, new URLSearchParams("record=X Co&color=%23E31B23&license=1025687&site=https://x.com/about"));
    expect(d).toMatchObject({ brandColor: "#E31B23", licenseNumber: "1025687", website: "x.com" });
    const bad = resolveDemo(undefined, new URLSearchParams("record=X Co&color=red&license=abc"));
    expect(bad).toMatchObject({ brandColor: null, licenseNumber: null });
  });
  it("needs a name", () => {
    expect(resolveDemo("nobody", new URLSearchParams())).toBeNull();
  });
});

describe("the client's side", () => {
  it("speaks to a kitchen and to their ZIP from the real record", () => {
    const hs = recordHighlights(permits, demoIntake({ project: "kitchen", zip: "95125", visitTimes: [] }), "US Creative Builders", new Date("2026-11-03"));
    const text = hs.map((h) => h.text).join(" ");
    expect(text).toMatch(/1 kitchen permit in San Jose/);
    expect(text).toMatch(/2 jobs in 95125, your ZIP code/);
  });
  it("offers the ZIPs they work in most", () => {
    expect(topZips(permits)).toEqual(["95125", "95118", "95124"]);
  });
});

describe("the contractor's side", () => {
  it("makes the call and surfaces the surprise on the lot", () => {
    const times = demoVisitOptions(new Date(2026, 10, 3));
    const prep = computeVisitPrep(demoSnapshot({ project: "kitchen", zip: "95125", visitTimes: [times[0]] }), DEMO_BUY_BOX);
    expect(prep.call.level).toBe("drive");
    expect(prep.surprises[0].text).toMatch(/no final sign-off/);
    expect(prep.people.some((p) => /Times that work for a visit/.test(p.text))).toBe(true);
  });
  it("works for an addition too", () => {
    const prep = computeVisitPrep(demoSnapshot({ project: "addition", zip: "", visitTimes: [] }), DEMO_BUY_BOX);
    expect(prep.read.kind).toBe("addition");
    expect(prep.call.level).not.toBe("skip");
  });
});

describe("recordFacts", () => {
  it("reads ZIPs, kinds of work and active permits, nothing else", () => {
    const f = recordFacts([
      ...permits.map((p) => ({ ...p, status: "Active" })),
      { zip: "95120", status: "Finaled", description: "Single-Family — Sub-Trades Only" },
    ]);
    expect(f.zips).toEqual(["95125", "95118", "95120", "95124"]);
    expect(f.active).toBe(4);
    expect(f.kinds).toEqual(["Additions and alterations", "Kitchen remodel"]);
  });
});
