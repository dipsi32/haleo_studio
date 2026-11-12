import { describe, expect, it } from "vitest";
import { EMPTY_OUTCOME, nextStep, outcomeSummary, parseValueK, toOutcome } from "@/lib/briefOutcome";

describe("brief outcome steps", () => {
  it("asks for the call first, then effort", () => {
    expect(nextStep(EMPTY_OUTCOME)).toBe("decision");
    expect(nextStep({ ...EMPTY_OUTCOME, decision: "pursue" })).toBe("effort");
  });

  it("stops after effort when they passed", () => {
    expect(nextStep({ ...EMPTY_OUTCOME, decision: "pass", effort: "saved_a_lot" })).toBe("done");
  });

  it("follows a pursued job through the visit to the result", () => {
    const o = { ...EMPTY_OUTCOME, decision: "pursue" as const, effort: "saved_some" as const };
    expect(nextStep(o)).toBe("visit");
    expect(nextStep({ ...o, visit_match: "as_expected" })).toBe("result");
    expect(nextStep({ ...o, visit_match: "as_expected", result: "open" })).toBe("result");
    expect(nextStep({ ...o, visit_match: "as_expected", result: "won" })).toBe("done");
    expect(nextStep({ ...o, visit_match: "no_visit" })).toBe("done");
  });

  it("sums up what they said in one line", () => {
    expect(outcomeSummary(EMPTY_OUTCOME)).toBeNull();
    expect(outcomeSummary({ ...EMPTY_OUTCOME, decision: "pass", decision_reasons: ["Budget"] })).toBe("Pass (budget)");
    expect(outcomeSummary({ ...EMPTY_OUTCOME, decision: "pursue", visit_match: "as_expected", result: "won" })).toBe("Pursue it · visit: as expected · won it");
  });

  it("reads a contract value however it's typed", () => {
    expect(parseValueK("62")).toBe(62);
    expect(parseValueK("$62K")).toBe(62);
    expect(parseValueK("62,000")).toBe(62);
    expect(parseValueK("1.2m")).toBe(1200);
    expect(parseValueK("abc")).toBeNull();
  });

  it("tolerates odd stored rows", () => {
    expect(toOutcome({ decision: "maybe", decision_reasons: "x" })).toEqual(EMPTY_OUTCOME);
  });
});
