import { describe, expect, it } from "vitest";
import { houseReport, shareMessage, smsLink, streetLine, tidyName, topKinds } from "./houseReport";
import { parcelIsFresh, riskIsFresh, type ParcelHistory, type ParcelPermit, type RiskSignal } from "./homeData";

const now = new Date("2026-11-21T12:00:00Z");

const permit = (p: Partial<ParcelPermit>): ParcelPermit => ({
  permit_number: "2026-118098-RS",
  type: "1 & 2 Family Detached Dwellings",
  subtype: "Single-Family",
  description: "Additions/Alterations",
  contractor: "BAY BUILDERS & REMODELING",
  valuation: 10801,
  issued_date: "2026-10-07",
  final_date: null,
  status: "Active",
  is_open: true,
  is_expired_without_final: false,
  source: "active",
  ...p,
});

const parcel = (permits: ParcelPermit[], extra: Partial<ParcelHistory> = {}): ParcelHistory => ({
  address_key: "k",
  apn: "56936096",
  permits,
  contractors: [],
  permit_count: permits.length,
  open_permit_count: 0,
  expired_without_final_count: 0,
  most_recent_permit_date: null,
  oldest_permit_date: null,
  lookup_succeeded: true,
  last_checked_at: "2026-11-21T10:00:00Z",
  raw_response: { feeds: 3, street_name: "luning dr", street: [] },
  ...extra,
});

const signal = (s: Partial<RiskSignal> = {}): RiskSignal => ({
  address_key: "k",
  fire_hazard_class: null,
  fire_hazard_zone: "Local Responsibility Area",
  flood_zone: "X",
  flood_zone_description: null,
  in_special_flood_hazard_area: false,
  seismic_hazard_zone: null,
  seismic_hazard_type: null,
  lookup_succeeded: true,
  last_checked_at: "2026-11-21T10:00:00Z",
  raw_response: { geocodeLevel: "address", checked: { fire: true, flood: true, seismic: true } },
  ...s,
});

const base = { street: "1488 Luning Dr", zip: "95118", now };

describe("houseReport", () => {
  it("a clean house leads with the answer", () => {
    const r = houseReport({ ...base, signal: signal(), parcel: parcel([]), reader: "owner" });
    expect(r.tone).toBe("clear");
    expect(r.verdict).toEqual(["Clean", "on paper."]);
    expect(r.vitals.map((v) => v.value)).toEqual(["None current", "No hazard zones", "Nothing current"]);
    expect(r.steps.map((s) => s.id)).toContain("archive");
  });

  it("work underway: the owner gets a ready text to the contractor", () => {
    const r = houseReport({
      ...base,
      signal: signal(),
      parcel: parcel([permit({})]),
      inspections: [{ folder_number: "2026-118098-RS", found: true, approvals: [{ label: "Electrical", status: "complete" }] }],
      reader: "owner",
    });
    expect(r.tone).toBe("watch");
    expect(r.verdict[1]).toBe("with one thing to know.");
    const final = r.steps.find((s) => s.id === "final")!;
    expect(final.action.kind).toBe("copy");
    expect(final.action.kind === "copy" && final.action.text).toContain("final inspection");
    expect(final.why).toContain("Bay Builders & Remodeling");
    expect(r.findings[0].text).toContain("electrical");
    expect(r.vitals[2].value).toBe("Oct 2026 · Bay Builders & Remodeling");
  });

  it("an expired permit is the one thing to close out, worded for a buyer", () => {
    const r = houseReport({
      ...base,
      signal: signal(),
      parcel: parcel([permit({ is_open: false, is_expired_without_final: true, issued_date: "2019-03-01", description: "Water heater" })]),
      reader: "deal",
    });
    expect(r.tone).toBe("act");
    expect(r.verdict).toEqual(["One thing to", "close out."]);
    expect(r.steps[0].title).toMatch(/before closing/);
    expect(r.steps[0].action.kind === "copy" && r.steps[0].action.text).toContain("expired without a final inspection");
  });

  it("a hazard zone changes the next step for each reader", () => {
    const s = signal({ seismic_hazard_type: "Liquefaction" });
    const project = houseReport({ ...base, signal: s, parcel: parcel([]), reader: "project" });
    const deal = houseReport({ ...base, signal: s, parcel: parcel([]), reader: "deal" });
    expect(project.steps[0].title).toBe("Plan for a soils report");
    expect(deal.steps[0].title).toBe("Ask about the foundation");
    expect(project.vitals[1].value).toBe("Liquefaction zone");
    expect(project.steps.some((x) => x.action.kind === "project")).toBe(true);
  });

  it("never calls an unchecked or unrated hazard clear", () => {
    const failed = houseReport({
      ...base,
      signal: signal({ raw_response: { geocodeLevel: "address", checked: { fire: true, flood: false, seismic: true } } }),
      parcel: parcel([]),
      reader: "owner",
    });
    expect(failed.unchecked).toEqual(["flood"]);
    expect(failed.verdict).toEqual(["Clean so far", "on paper."]);
    const zoneD = houseReport({ ...base, signal: signal({ flood_zone: "D" }), parcel: parcel([]), reader: "owner" });
    expect(zoneD.vitals[1].value).toBe("No hazard zones · flood unrated");
    expect(zoneD.ground.find((g) => g.id === "flood")).toMatchObject({ status: "unrated" });
    expect(zoneD.ground.find((g) => g.id === "flood")?.meaning).toMatch(/hasn't studied/);
    const none = houseReport({ ...base, signal: null, parcel: null, reader: "owner" });
    expect(none.verdict[0]).toBe("We couldn't read");
  });

  it("the summary fills every copy action", () => {
    const r = houseReport({ ...base, signal: signal(), parcel: parcel([]), reader: "deal" });
    const copy = r.steps.find((s) => s.id === "history")!;
    expect(copy.action.kind === "copy" && copy.action.text).toContain("1488 Luning Dr, San Jose 95118");
  });
});

describe("tidyName", () => {
  it("reads like a name", () => {
    expect(tidyName("BAY BUILDERS & REMODELING")).toBe("Bay Builders & Remodeling");
    expect(tidyName("BAKHTIARY, MEHDI")).toBe("Mehdi Bakhtiary");
    expect(tidyName("OPEN REMODEL LLC")).toBe("Open Remodel LLC");
    expect(tidyName("Rose Remodeling")).toBe("Rose Remodeling");
  });
});

describe("freshness", () => {
  it("an empty permit answer lasts a day, and only from all three feeds", () => {
    expect(parcelIsFresh(parcel([]), now)).toBe(true);
    expect(parcelIsFresh(parcel([], { raw_response: {} }), now)).toBe(false);
    // Saved before the street was read: looked up again so the street appears.
    expect(parcelIsFresh(parcel([permit({})], { raw_response: { feeds: 3 } }), now)).toBe(false);
    expect(parcelIsFresh(parcel([], { last_checked_at: "2026-11-13T00:00:00Z" }), now)).toBe(false);
    expect(parcelIsFresh(parcel([permit({ source: undefined })]), now)).toBe(false);
    expect(parcelIsFresh(parcel([permit({})]), now)).toBe(true);
  });
  it("hazards are trusted only when all three checks ran", () => {
    expect(riskIsFresh(signal(), now)).toBe(true);
    expect(riskIsFresh(signal({ raw_response: { checked: { fire: true, flood: false, seismic: true } } }), now)).toBe(false);
    expect(riskIsFresh(signal({ raw_response: null }), now)).toBe(false);
  });
});

describe("sharing the report", () => {
  it("the message carries the results, not just a link", () => {
    const r = houseReport({ ...base, signal: signal(), parcel: parcel([permit({})]), reader: "owner" });
    const msg = shareMessage(r, "1488 Luning Dr", "https://haleo.pages.dev/house?street=1488+Luning+Dr&zip=95118");
    expect(msg).toContain("1488 Luning Dr: In good order, with one thing to know.");
    expect(msg).toContain("• Permits: 1 permit in progress");
    expect(msg).toContain("• Ground: No hazard zones");
    expect(msg).toContain("https://haleo.pages.dev/house?street=1488+Luning+Dr&zip=95118");
    expect(smsLink(msg)).toMatch(/^sms:\?&body=1488%20Luning%20Dr/);
  });
  it("leaves out anything we couldn't check", () => {
    const r = houseReport({ ...base, signal: null, parcel: parcel([]), reader: "owner" });
    expect(shareMessage(r, "x", "u")).not.toContain("Ground");
  });
});

describe("the street and the ground", () => {
  const sp = (o: Partial<import("./homeData").StreetPermit>): import("./homeData").StreetPermit => ({
    block: 2800,
    type: "1 & 2 Family Detached Dwellings",
    subtype: "Single-Family",
    description: "Reroof",
    contractor: "ACME ROOFING INC",
    valuation: 18000,
    issued_date: "2026-08-01",
    final_date: null,
    source: "active",
    is_expired_without_final: false,
    ...o,
  });
  const street = [
    sp({}),
    sp({ description: "Install roof mounted PV solar", contractor: "SUNRUN INSTALLATION SERVICES INC", block: 2900 }),
    sp({ description: "Kitchen remodel", contractor: "ROSE REMODELING", issued_date: "2024-02-01", final_date: "2024-06-01" }),
    sp({ description: "Reroof", contractor: "ACME ROOFING INC", issued_date: "2025-01-10" }),
  ];
  const withStreet = parcel([], { raw_response: { feeds: 3, street_name: "lexford ave", street } });

  it("a house with nothing current still shows what's happening on its street", () => {
    const r = houseReport({ ...base, street: "2844 Lexford Ave", zip: "95124", signal: signal(), parcel: withStreet, reader: "owner" });
    expect(r.street?.name).toBe("Lexford Ave");
    expect(r.street?.total).toBe(4);
    expect(r.street?.kinds[0]).toEqual({ kind: "Roof", count: 2 });
    expect(r.street?.crew[0]).toMatchObject({ name: "Acme Roofing Inc", count: 2 });
    expect(r.street?.recent[0]).toMatchObject({ block: "2800 block", what: "Roof", when: "Aug 2026" });
    expect(r.vitals[2]).toMatchObject({ label: "On Lexford Ave", value: "4 permits on the street" });
    expect(r.sub).toContain("On Lexford Ave, neighbors have pulled 4 permits");
  });

  it("the project reader gets the crew already working on their street", () => {
    const r = houseReport({ ...base, signal: signal(), parcel: withStreet, reader: "project" });
    expect(r.steps.find((s) => s.id === "street-crew")?.title).toBe("See who's working on Lexford Ave");
  });

  it("reads each hazard map in plain words, never calling an unchecked one clear", () => {
    const r = houseReport({ ...base, signal: signal({ flood_zone: "D", seismic_hazard_type: "Liquefaction" }), parcel: withStreet, reader: "owner" });
    expect(r.ground.map((g) => [g.id, g.status])).toEqual([["fire", "clear"], ["flood", "unrated"], ["seismic", "zone"]]);
    expect(r.ground[1].title).toBe("Not rated by FEMA (zone D)");
    const x = houseReport({ ...base, signal: signal(), parcel: withStreet, reader: "owner" });
    expect(x.ground[1].title).toBe("Minimal flood risk (zone X)");
    const none = houseReport({ ...base, signal: null, parcel: withStreet, reader: "owner" });
    expect(none.ground.every((g) => g.status === "unchecked")).toBe(true);
  });
});

describe("topKinds", () => {
  it("names real kinds of work, never 'other work', and keeps acronyms", () => {
    expect(topKinds([{ kind: "Other work", count: 9 }, { kind: "ADU or addition", count: 3 }, { kind: "Roof", count: 2 }])).toBe("ADUs and additions, then new roofs");
    expect(topKinds([{ kind: "Other work", count: 9 }])).toBeNull();
  });
});

describe("streetLine", () => {
  it("says it the way a neighbor would", () => {
    expect(streetLine({ name: "Merrill Dr", total: 40, lastYear: 9, kinds: [{ kind: "ADU or addition", count: 12 }, { kind: "Roof", count: 8 }, { kind: "Other work", count: 20 }] })).toBe(
      "On Merrill Dr, neighbors have pulled 40 permits (9 this past year), mostly for ADUs and additions, then new roofs.",
    );
  });
  it("won't say mostly about a sliver", () => {
    expect(streetLine({ name: "Merrill Dr", total: 40, lastYear: 0, kinds: [{ kind: "Roof", count: 3 }, { kind: "Other work", count: 37 }] })).toBe("On Merrill Dr, neighbors have pulled 40 permits.");
  });
});
