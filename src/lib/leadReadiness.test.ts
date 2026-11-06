import { describe, expect, it } from "vitest";
import { computeLeadReadiness, readinessLine } from "@/lib/leadReadiness";
import type { DealSnapshot } from "@/lib/dealRead";

const kitchen: DealSnapshot = {
  neighborhood: "San Jose",
  projectType: "Kitchen",
  rooms: ["Kitchen"],
  budget: "$60K – $90K",
  timeline: "1–3 months",
  room_photo_urls: ["a.jpg", "b.jpg", "c.jpg"],
  vision: "Open the wall to the dining room, a bigger island, and real light. We cook together every night and the room is too dark and cramped for two.",
  homeowner_phone: "(408) 555-0123",
  frustrations: ["Too dark", "Cramped"],
  context: { why_now: "family", who_decides: "partner", funding: "cash", shopping: "only", found_via: "referral" },
};

const dim = (r: ReturnType<typeof computeLeadReadiness>, k: string) => r.dimensions.find((d) => d.key === k)!;

describe("lead readiness", () => {
  it("calls a lead ready when there's a reason, the means and real effort", () => {
    const r = computeLeadReadiness(kitchen);
    expect(r.level).toBe("ready");
    expect(r.title).toBe("Ready to move");
    expect(dim(r, "urgency").strength).toBe("strong");
    expect(dim(r, "money").strength).toBe("strong");
    expect(dim(r, "commitment").signals.map((s) => s.text)).toContain("Referred by a friend or neighbor");
    expect(dim(r, "commitment").signals.some((s) => /real effort/.test(s.text))).toBe(true);
    expect(readinessLine(r)).toMatch(/^Ready to move · strong on/);
  });

  it("reminds them to get both decision-makers to the visit, without counting it against the lead", () => {
    const partner = dim(computeLeadReadiness(kitchen), "prep").signals.find((s) => /partner/i.test(s.text))!;
    expect(partner.effect).toBe("neutral");
    expect(partner.note).toMatch(/both/);
  });

  it("calls exploring leads early, and says so kindly", () => {
    const r = computeLeadReadiness({ ...kitchen, timeline: "Exploring" });
    expect(r.level).toBe("early");
    expect(r.summary).toMatch(/short call first/);
    expect(r.ask?.question).toMatch(/When would you ideally/);
  });

  it("treats comparing many contractors as a reason to call first, in respectful words", () => {
    const r = computeLeadReadiness({ ...kitchen, context: { shopping: "many" }, frustrations: [] });
    expect(r.level).toBe("early");
    const s = dim(r, "commitment").signals.find((x) => x.effect === "down")!;
    expect(s.text).toBe("Comparing several contractors");
    expect(JSON.stringify(r)).not.toMatch(/shopper|tire.?kicker|score/i);
  });

  it("reads failing systems as urgency, from their own pain points", () => {
    const r = computeLeadReadiness({ ...kitchen, timeline: undefined, context: {}, frustrations: ["Active leak", "Dated look"] });
    expect(dim(r, "urgency").signals[0].text).toMatch(/Something is failing: active leak/);
  });

  it("counts a budget under the contractor's minimum against the money read", () => {
    const r = computeLeadReadiness({ ...kitchen, budget: "$15K – $20K" }, { min_budget_k: 50 });
    expect(dim(r, "money").strength).toBe("some");
    expect(dim(r, "money").signals.some((s) => s.effect === "down" && /minimum/.test(s.text))).toBe(true);
    expect(r.level).not.toBe("ready");
  });

  it("never counts a skipped question against them: unknown stays unknown", () => {
    const r = computeLeadReadiness({ neighborhood: "San Jose", projectType: "Bathroom", room_photo_urls: ["a.jpg"] });
    expect(r.level).toBe("unclear");
    expect(r.dimensions.filter((d) => d.strength === "unknown").length).toBeGreaterThanOrEqual(3);
    expect(r.dimensions.some((d) => d.strength === "weak")).toBe(false);
    expect(r.ask?.question).toMatch(/range/);
  });

  it("isn't ready until a budget is on the table, however keen they are", () => {
    const r = computeLeadReadiness({ ...kitchen, budget: undefined });
    expect(r.level).toBe("serious");
    expect(r.ask?.question).toMatch(/range/);
  });

  it("asks the question that changes the read most, budget first", () => {
    expect(computeLeadReadiness({ ...kitchen, budget: undefined }).ask?.question).toMatch(/range you'd like to stay within/);
    expect(computeLeadReadiness({ ...kitchen, context: { ...kitchen.context, shopping: undefined } }).ask?.question).toMatch(/other contractors/);
  });
});
