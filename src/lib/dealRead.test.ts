import { describe, it, expect } from "vitest";
import {
  computeDealRead,
  hasBuyBoxCriteria,
  parseBudget,
  projectKindOf,
  toBuyBox,
  type DealSnapshot,
} from "@/lib/dealRead";

const addition: DealSnapshot = {
  projectType: "addition",
  is_addition: true,
  addition_size_sqft: 600,
  budget: "$300K – $400K",
  timeline: "Ready to start",
  permit_status: "in-progress",
  room_photo_urls: ["a.jpg", "b.jpg"],
  floorplan_urls: ["plan.pdf"],
  rooms: ["Addition"],
};

describe("parseBudget", () => {
  it("reads a range in thousands", () => {
    expect(parseBudget("$300K – $400K")).toEqual({ minK: 300, maxK: 400, openEnded: false });
  });
  it("marks open-ended budgets", () => {
    expect(parseBudget("$500K+ – $500K+")).toEqual({ minK: 500, maxK: 500, openEnded: true });
  });
  it("returns null when nothing is shared", () => {
    expect(parseBudget(undefined)).toBeNull();
    expect(parseBudget("Not shared")).toBeNull();
  });
});

describe("projectKindOf", () => {
  it("recognizes additions however they are labelled", () => {
    expect(projectKindOf({ is_addition: true })).toBe("addition");
    expect(projectKindOf({ projectType: "ADU" })).toBe("addition");
    expect(projectKindOf({ projectType: "whole-home remodel" })).toBe("whole-home");
    expect(projectKindOf({ projectType: "kitchen remodel" })).toBe("kitchen");
    expect(projectKindOf({ rooms: ["Primary bathroom"] })).toBe("bathroom");
    expect(projectKindOf({ projectType: "living room remodel" })).toBe("other");
  });
});

describe("computeDealRead: fit", () => {
  it("says unset, not 'fits', when the contractor has set no criteria", () => {
    expect(computeDealRead(addition, null).fit.level).toBe("unset");
    expect(computeDealRead(addition, {}).fit.level).toBe("unset");
    expect(computeDealRead(addition, { min_budget_k: null, project_types: [] }).fit.level).toBe("unset");
  });

  it("fits when every criterion is met", () => {
    const r = computeDealRead(addition, { min_budget_k: 200, min_sqft: 400, project_types: ["addition"] });
    expect(r.fit.level).toBe("fits");
    expect(r.fit.reasons.length).toBe(3);
  });

  it("is below when the budget tops out under the minimum", () => {
    const r = computeDealRead({ ...addition, budget: "$100K – $150K" }, { min_budget_k: 200 });
    expect(r.fit.level).toBe("below");
    expect(r.fit.reasons[0]).toMatch(/tops out at \$150K/);
  });

  it("asks for a closer look when the range straddles the minimum", () => {
    const r = computeDealRead({ ...addition, budget: "$150K – $250K" }, { min_budget_k: 200 });
    expect(r.fit.level).toBe("check");
  });

  it("never rejects an open-ended budget on its ceiling", () => {
    const r = computeDealRead({ ...addition, budget: "$500K+ – $500K+" }, { min_budget_k: 300 });
    expect(r.fit.level).toBe("fits");
  });

  it("does not guess when the budget is missing", () => {
    const r = computeDealRead({ ...addition, budget: undefined }, { min_budget_k: 200 });
    expect(r.fit.level).toBe("check");
    expect(r.fit.reasons[0]).toMatch(/can't be tested/);
  });

  it("is below for a project type the contractor doesn't take", () => {
    const r = computeDealRead({ projectType: "bathroom remodel", rooms: ["Bathroom"], budget: "$15K – $20K" }, { project_types: ["addition"] });
    expect(r.fit.level).toBe("below");
  });

  it("is below when an addition is smaller than the size minimum", () => {
    const r = computeDealRead({ ...addition, addition_size_sqft: 200 }, { min_sqft: 400 });
    expect(r.fit.level).toBe("below");
  });

  it("one miss outweighs other passes", () => {
    const r = computeDealRead(addition, { min_budget_k: 200, project_types: ["kitchen"] });
    expect(r.fit.level).toBe("below");
  });
});

describe("computeDealRead: size, permit, flags, unknowns", () => {
  it("shows implied price per square foot as arithmetic", () => {
    const r = computeDealRead(addition);
    expect(r.size.perSqft).toBe("$500 to $667 per sq ft");
  });

  it("says 'at least' for an open-ended budget", () => {
    const r = computeDealRead({ ...addition, budget: "$500K+ – $500K+" });
    expect(r.size.perSqft).toBe("at least $833 per sq ft");
  });

  it("gives no per-sq-ft line without both numbers", () => {
    expect(computeDealRead({ ...addition, addition_size_sqft: undefined }).size.perSqft).toBeNull();
    expect(computeDealRead({ ...addition, budget: undefined }).size.perSqft).toBeNull();
  });

  it("states the permit position plainly", () => {
    expect(computeDealRead(addition).permit.label).toBe("Permit in progress");
    expect(computeDealRead({ ...addition, permit_status: undefined }).permit.label).toBe("Not stated");
  });

  it("surfaces hazard records and a missing plan set", () => {
    const r = computeDealRead({
      ...addition,
      floorplan_urls: [],
      address_risk: { fire_hazard_class: "Very High", in_special_flood_hazard_area: true, flood_zone: "AE", seismic_hazard_type: "Liquefaction" },
    });
    const labels = r.flags.map((f) => f.label);
    expect(labels).toContain("Fire hazard: Very High");
    expect(labels).toContain("Special flood hazard area (zone AE)");
    expect(labels).toContain("No plans attached yet");
    expect(r.flags.find((f) => f.label.startsWith("Fire"))?.tone).toBe("watch");
    expect(r.flags.find((f) => f.label.startsWith("Seismic"))?.tone).toBe("info");
  });

  it("carries Haleo's own open questions into the unknowns, deduped", () => {
    const r = computeDealRead({
      ...addition,
      haleo_read: {
        summary: "",
        sections: [
          { title: "Structure", items: [
            { text: "Is the existing foundation slab or raised?", basis: "question" },
            { text: "Is the existing foundation slab or raised?", basis: "question" },
            { text: "Two stories", basis: "grounded" },
          ] },
        ],
      },
    });
    expect(r.unknowns.filter((u) => u.includes("foundation"))).toHaveLength(1);
    expect(r.unknowns.some((u) => u.includes("Two stories"))).toBe(false);
  });

  it("asks for what is missing instead of inventing it", () => {
    const r = computeDealRead({ projectType: "addition", is_addition: true });
    expect(r.unknowns).toEqual(expect.arrayContaining([
      "What budget are you working with?",
      "When would you like to start?",
      "How large is the addition, roughly?",
    ]));
  });

  it("caps the unknowns list", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ text: `Question ${i}`, basis: "question" as const }));
    const r = computeDealRead({ ...addition, haleo_read: { summary: "", sections: [{ title: "x", items }] } });
    expect(r.unknowns.length).toBeLessThanOrEqual(6);
  });
});

describe("computeDealRead: completeness and headline", () => {
  it("counts the effort shared", () => {
    const full = computeDealRead({ ...addition, haleo_read: { summary: "", sections: [], approvedAt: "2026-10-01" } });
    expect(full.completeness).toMatchObject({ score: 6, total: 6, level: "strong", missing: [] });
    const thin = computeDealRead({ projectType: "kitchen remodel" });
    expect(thin.completeness.level).toBe("light");
    expect(thin.completeness.missing).toContain("Budget");
  });

  it("treats 'Exploring' as no timeline", () => {
    expect(computeDealRead({ ...addition, timeline: "Exploring" }).completeness.missing).toContain("Timeline");
  });

  it("writes a one-line headline from what is known", () => {
    expect(computeDealRead(addition).headline).toBe("Addition or ADU · 600 sq ft · $300K – $400K · Ready to start");
    expect(computeDealRead({ projectType: "kitchen remodel" }).headline).toBe("Kitchen");
  });
});

describe("buy box helpers", () => {
  it("detects whether any criterion is set", () => {
    expect(hasBuyBoxCriteria(null)).toBe(false);
    expect(hasBuyBoxCriteria({ min_budget_k: 0 })).toBe(false);
    expect(hasBuyBoxCriteria({ min_sqft: 300 })).toBe(true);
    expect(hasBuyBoxCriteria({ project_types: ["kitchen"] })).toBe(true);
  });

  it("reads stored JSON defensively", () => {
    expect(toBuyBox(null)).toBeNull();
    expect(toBuyBox("nope")).toBeNull();
    expect(toBuyBox({ min_budget_k: "200", min_sqft: -4, project_types: ["addition", "castle"] })).toEqual({
      min_budget_k: null,
      min_sqft: null,
      project_types: ["addition"],
    });
    expect(toBuyBox({ min_budget_k: 250, min_sqft: 400, project_types: ["addition", "kitchen"] })).toEqual({
      min_budget_k: 250,
      min_sqft: 400,
      project_types: ["addition", "kitchen"],
    });
  });
});
