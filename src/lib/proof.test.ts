import { describe, expect, it } from "vitest";
import { summarizeProof, type ProofPermit } from "@/lib/proof";
import { addressRiskKey } from "@/lib/addressRisk";

const p = (over: Partial<ProofPermit>): ProofPermit => ({
  city: "San Jose",
  issued_date: "2025-06-01",
  completed_date: null,
  work_type: "Addition",
  description: "Add 400 sf to SFD",
  ...over,
});

describe("summarizeProof", () => {
  const permits: ProofPermit[] = [
    p({ issued_date: "2023-02-10", completed_date: "2023-09-01" }),
    p({ issued_date: "2025-12-05" }),
    p({ city: "SAN JOSE ", issued_date: "2024-04-01", work_type: "Kitchen", description: "Kitchen remodel", completed_date: "2024-08-01" }),
    p({ city: "Gilroy", issued_date: "2022-01-01" }),
  ];

  it("counts by city regardless of case or stray spaces", () => {
    const s = summarizeProof(permits, "san jose", ["addition"]);
    expect(s.total).toBe(4);
    expect(s.inCity).toBe(3);
  });

  it("counts similar work and closed-out permits within the city", () => {
    const s = summarizeProof(permits, "San Jose", ["addition", "adu"]);
    expect(s.similar).toBe(2);
    expect(s.finaled).toBe(2);
  });

  it("reports the span of local activity", () => {
    const s = summarizeProof(permits, "San Jose", []);
    expect(s.firstIssued).toBe("2023-02-10");
    expect(s.lastIssued).toBe("2025-12-05");
  });

  it("counts everything when no city is known", () => {
    expect(summarizeProof(permits, null, []).inCity).toBe(4);
  });

  it("handles a contractor with no permits", () => {
    expect(summarizeProof([], "San Jose", ["addition"])).toEqual({
      total: 0, inCity: 0, similar: 0, finaled: 0, lastIssued: null, firstIssued: null,
    });
  });

  it("matches short keywords as whole words only", () => {
    const list = [
      p({ work_type: "Alteration", description: "Add 650 sf to existing SFD" }),
      p({ work_type: "Alteration", description: "New address sign and padding" }),
      p({ work_type: "Addition", description: "Rear addition" }),
    ];
    // "Add 650 sf" and "Addition" count; "address ... padding" does not.
    expect(summarizeProof(list, "San Jose", ["addition", "add"]).similar).toBe(2);
  });

  it("does not count a permit as similar when there are no keywords", () => {
    expect(summarizeProof(permits, "San Jose", []).similar).toBe(0);
  });
});

describe("addressRiskKey", () => {
  it("normalizes case, spacing and missing parts", () => {
    expect(addressRiskKey({ street: " 742  Lenora Ave ", city: "San Jose", state: "CA", zip: "95124" })).toBe(
      "742 lenora ave|san jose|ca|95124",
    );
    expect(addressRiskKey({ street: "1 Main", city: "San Jose" })).toBe("1 main|san jose||");
  });
});
