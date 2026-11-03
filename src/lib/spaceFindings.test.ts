import { describe, expect, it } from "vitest";
import { cleanFindings, findingsSection, friendlyAnalysisError, groupForHomeowner } from "./spaceFindings";

const raw = [
  { title: "Solid cabinet boxes", detail: "Doors are flat and aligned", why: "You may only need new fronts", next_step: "Ask about refacing", kind: "working", audience: "both", basis: "grounded", photo_url: "https://x/1.jpg" },
  { title: "Stain under the sink", detail: "Dark ring on the base", why: "Could be an old or active leak", next_step: "Check the shutoff and trap", kind: "attention", audience: "both", basis: "grounded", photo_url: null },
  { title: "Panel capacity", detail: "", why: "", next_step: "Open the panel", kind: "check", audience: "contractor", basis: "question" },
  { title: "", kind: "working" },
  "junk",
  { title: "Odd shape", kind: "weird", audience: "nobody", basis: "made-up", photo_url: "javascript:alert(1)" },
];

describe("cleanFindings", () => {
  it("keeps well-formed findings and repairs odd fields", () => {
    const f = cleanFindings(raw);
    expect(f.map((x) => x.title)).toEqual(["Solid cabinet boxes", "Stain under the sink", "Panel capacity", "Odd shape"]);
    expect(f[3]).toMatchObject({ kind: "check", audience: "both", basis: "inferred", photo_url: null });
    expect(cleanFindings(undefined)).toEqual([]);
  });
});

describe("groupForHomeowner", () => {
  it("keeps contractor-only notes out of the homeowner's list", () => {
    const g = groupForHomeowner(cleanFindings(raw));
    expect(g.working).toHaveLength(1);
    expect(g.attention).toHaveLength(1);
    expect(g.check.map((x) => x.title)).toEqual(["Odd shape"]);
  });
});

describe("findingsSection", () => {
  it("gives the contractor everything worth checking, not the good news", () => {
    const s = findingsSection(cleanFindings(raw))!;
    expect(s.title).toBe("Worth checking on site");
    expect(s.items).toHaveLength(3);
    expect(s.items[0].text).toBe("Stain under the sink: Dark ring on the base — Check the shutoff and trap");
    expect(findingsSection([])).toBeNull();
  });
});

describe("friendlyAnalysisError", () => {
  it("never shows technical errors to a homeowner", () => {
    expect(friendlyAnalysisError("Edge Function returned a non-2xx status code")).toBe(
      "Haleo couldn't read your photos this time. Try again in a moment.",
    );
    expect(friendlyAnalysisError("AI error 400: image exceeds 5 MB maximum")).toMatch(/^Haleo couldn't read/);
    expect(friendlyAnalysisError("Failed to fetch")).toMatch(/connection/);
    expect(friendlyAnalysisError(null)).toMatch(/Try again/);
  });
  it("passes through messages written for people", () => {
    const m = "1 photo was too large to read. Re-add it and Haleo will resize it automatically.";
    expect(friendlyAnalysisError(m)).toBe(m);
  });
});
