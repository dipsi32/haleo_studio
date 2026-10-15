import { describe, expect, it } from "vitest";
import { computeVisitPrep, prepToText } from "@/lib/visitPrep";
import { cleanContext, hasContext } from "@/lib/prepTypes";
import type { DealSnapshot } from "@/lib/dealRead";

const adu: DealSnapshot = {
  neighborhood: "San Jose",
  projectType: "Addition or ADU",
  is_addition: true,
  addition_size_sqft: 600,
  budget: "$300K – $400K",
  timeline: "3–6 months",
  permit_status: "not-yet",
  floorplan_urls: ["a.pdf"],
  room_photo_urls: ["p1.jpg", "p2.jpg"],
};

const records: DealSnapshot = {
  ...adu,
  address_risk: { fire_hazard_class: "Very High", in_special_flood_hazard_area: false, flood_zone: "X" },
  parcel: {
    apn: "123-45-678",
    lot_size_sqft: 6200,
    zoning: "R-1-8",
    primary_dwelling_sqft: 1500,
    existing_footprints_sqft: 2700,
    permit_count: 3,
    open_permit_count: 0,
    expired_without_final_count: 1,
    oldest_permit_date: "2011-04-02",
    permits: [{ permit_number: "P1", description: "Garage conversion to living space", type: null, valuation: 38000, issued_date: "2019-06-01", status: "Expired", is_open: false, is_expired_without_final: false }],
  },
};

describe("computeVisitPrep: the call", () => {
  it("says drive when it fits and nothing is missing", () => {
    const p = computeVisitPrep(adu, { min_budget_k: 100, project_types: ["addition"] });
    expect(p.call.level).toBe("drive");
    expect(p.call.title).toBe("Worth the drive");
  });

  it("says call first when the budget is missing", () => {
    const p = computeVisitPrep({ ...adu, budget: undefined }, { min_budget_k: 100 });
    expect(p.call.level).toBe("call-first");
    expect(p.call.why.join(" ")).toMatch(/budget/i);
  });

  it("says skip, with reasons, when outside what they take", () => {
    const p = computeVisitPrep(adu, { project_types: ["kitchen"] });
    expect(p.call.level).toBe("skip");
    expect(p.call.why.length).toBeGreaterThan(0);
  });

  it("does not decide without fit criteria", () => {
    const p = computeVisitPrep(adu, null);
    expect(p.call.level).toBe("unset");
    expect(p.call.why).toEqual([]);
  });
});

describe("computeVisitPrep: what the homeowner may not know", () => {
  it("leads with the unfinished permit and gives a question, not a verdict", () => {
    const p = computeVisitPrep(records, null);
    expect(p.surprises[0].text).toBe("1 permit on this address shows no final sign-off.");
    expect(p.surprises[0].source).toBe("record");
    expect(p.surprises[0].opener.trim().endsWith("?")).toBe(true);
    expect(p.surprises[0].note).toMatch(/Could be/);
  });

  it("caps at three and orders by weight", () => {
    const p = computeVisitPrep(records, null);
    expect(p.surprises.length).toBeLessThanOrEqual(3);
    const weights = p.surprises.map((s) => s.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it("states lot coverage as arithmetic on records and hedges the consequence", () => {
    const p = computeVisitPrep(records, null);
    const cov = p.surprises.find((s) => /cover about/.test(s.text));
    expect(cov?.text).toContain("44%");
    expect(cov?.note).toMatch(/Check the limits with the city/);
  });

  it("flags high fire hazard from the record and skips low ones", () => {
    expect(computeVisitPrep(records, null).surprises.some((s) => /Fire hazard zone/.test(s.text))).toBe(true);
    const low = computeVisitPrep({ ...adu, address_risk: { fire_hazard_class: "Moderate" } }, null);
    expect(low.surprises.some((s) => /Fire hazard zone/.test(s.text))).toBe(false);
  });

  it("flags a missing plan set on an addition", () => {
    const p = computeVisitPrep({ ...adu, floorplan_urls: [] }, null);
    expect(p.surprises.some((s) => /No plans/.test(s.text))).toBe(true);
  });

  it("never claims anything when there are no records", () => {
    const p = computeVisitPrep({ ...adu }, null);
    expect(p.noRecords).toBe(true);
    expect(p.home).toEqual([]);
    expect(p.confirm.join(" ")).toMatch(/no public record came through/);
  });
});

describe("computeVisitPrep: provenance", () => {
  it("labels every line, and every note is a hedge", () => {
    const p = computeVisitPrep({ ...records, context: { why_now: "moving-in", funding: "heloc" } }, null);
    const all = [...p.home, ...p.work, ...p.people, ...p.surprises];
    for (const i of all) expect(["record", "asked", "math", "inferred"]).toContain(i.source);
    expect(p.home.every((i) => i.source === "record")).toBe(true);
    expect(p.people.every((i) => i.source === "asked")).toBe(true);
    expect(p.work.find((i) => /per sq ft/.test(i.text))?.source).toBe("math");
  });

  it("does not estimate a price", () => {
    const text = prepToText(computeVisitPrep(records, null));
    expect(text).not.toMatch(/we estimate|estimated cost|should cost/i);
  });
});

describe("computeVisitPrep: questions", () => {
  it("asks only what is still unknown, and caps the list", () => {
    const p = computeVisitPrep({ ...adu, budget: undefined, timeline: "Exploring" }, null);
    expect(p.asks.length).toBeLessThanOrEqual(5);
    expect(p.asks[0].question).toMatch(/budget/i);
    const answered = computeVisitPrep(
      { ...adu, context: { why_now: "family", who_decides: "partner", funding: "cash", shopping: "few", hard_date: "June 1" } },
      null,
    );
    const q = answered.asks.map((a) => a.question).join(" ");
    expect(q).not.toMatch(/prompting|part of the decision|paying|other contractors|done by/);
  });

  it("every question explains why it is worth asking", () => {
    for (const a of computeVisitPrep(adu, null).asks) expect(a.why.length).toBeGreaterThan(5);
  });
});

describe("computeVisitPrep: the people", () => {
  it("reports only what was said, in their terms", () => {
    const p = computeVisitPrep({ ...adu, context: { why_now: "moving-in", hard_date: "Before my mother arrives in September" } }, null);
    expect(p.people.map((i) => i.text).join(" | ")).toMatch(/a relative is moving in/i);
    expect(p.people.some((i) => /September/.test(i.text) && i.tone === "watch")).toBe(true);
  });

  it("is empty when nothing was shared", () => {
    expect(computeVisitPrep(adu, null).people).toEqual([]);
  });
});

describe("prepToText", () => {
  it("makes a phone-friendly cheat sheet that keeps the labels", () => {
    const t = prepToText(computeVisitPrep(records, { project_types: ["addition"] }), { homeowner: "Pat", address: "San Jose" });
    expect(t).toMatch(/^Visit prep: Pat, San Jose/);
    expect(t).toMatch(/Worth knowing before you knock/);
    expect(t).toMatch(/\[Public record\]/);
    expect(t).toMatch(/Confirm on site/);
    expect(t).toMatch(/Confirm anything that matters on site/);
  });
});

describe("homeowner context hygiene", () => {
  it("drops empties, trims, and caps free text", () => {
    expect(cleanContext({ hard_date: "   ", past_note: "" })).toBeUndefined();
    const c = cleanContext({ why_now: "family", hard_date: ` ${"x".repeat(500)} ` })!;
    expect(c.hard_date!.length).toBe(200);
    expect(hasContext(c)).toBe(true);
  });
});
