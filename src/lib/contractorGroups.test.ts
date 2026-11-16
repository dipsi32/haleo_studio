import { describe, expect, it } from "vitest";
import { declaredCost, groupContractors, nearbyLine, permitLight, type Groupable } from "@/lib/contractorGroups";
import type { JobFit } from "@/lib/jobFit";

const fit = (rank: number, flag: string | null = null) => ({ rows: [], lined: 0, checked: 0, total: 5, headline: "", flag, rank }) as JobFit;
const c = (id: string, matchCount: number, zips: string[], rank = 0, flag: string | null = null): Groupable => ({
  id,
  matchCount,
  fit: fit(rank, flag),
  permits: zips.map((zip, i) => ({ zip, issued_date: `2026-0${(i % 9) + 1}-01`, address: `${10 + i} CABANA DR` })),
});

describe("contractor groups", () => {
  const list = [
    c("big", 12, ["95112", "95118"], 900),
    c("mid", 5, ["95125"], 800),
    c("small-near", 0, ["95125", "95125"], 100),
    c("tiny-near", 0, ["95125"], 50),
    c("far", 0, ["95112"], 10),
    c("flagged", 20, ["95125"], 0, "License not active on the state record."),
    c("more", 3, [], 600),
    c("most", 7, [], 700),
  ];

  it("leads with the most permits for jobs like this, at most three, never a flagged record", () => {
    const g = groupContractors(list, "95125");
    expect(g.experienced.map((t) => t.id)).toEqual(["big", "most", "mid"]);
  });

  it("then up to three others who have worked in the neighborhood", () => {
    const g = groupContractors(list, "95125");
    expect(g.neighborhood.map((t) => t.id)).toEqual(["small-near", "tiny-near"]);
    expect(g.rest.map((t) => t.id)).toEqual(["far", "more", "flagged"]);
  });

  it("for a job that skips permits, leads with the neighborhood, then the most permitted work", () => {
    const g = groupContractors(list, "95125", { permitLight: true });
    expect(g.neighborhood.map((t) => t.id)).toEqual(["small-near", "mid", "tiny-near"]);
    expect(g.experienced.map((t) => t.id)).toEqual(["big", "far"]);
  });

  it("has no neighborhood group without a ZIP", () => {
    expect(groupContractors(list, null).neighborhood).toEqual([]);
  });

  it("names the street of their latest nearby job, never the house number", () => {
    expect(nearbyLine(list[2], "95125")).toBe("Cabana Dr, Feb 2026");
  });
});

describe("jobs that usually skip permits", () => {
  it("knows a refresh, paint or flooring from a remodel", () => {
    expect(permitLight({ scope: "refresh" })).toBe(true);
    expect(permitLight({ scope: "remodel" })).toBe(false);
    expect(permitLight({ goalNote: "Repaint the living room and new flooring" })).toBe(true);
    expect(permitLight({ goalNote: "Kitchen remodel, new flooring" })).toBe(false);
  });
});

describe("declared cost nearby", () => {
  const now = new Date("2026-11-16");
  const p = (valuation: number, description = "Kitchen remodel") => ({ valuation, description, issued_date: "2026-01-01" });
  it("gives the middle half of what was declared, only with enough permits", () => {
    expect(declaredCost([p(40000), p(55000), p(60000), p(72000), p(90000), p(500, "Kitchen")], ["kitchen"], now)).toEqual({ n: 5, low: 55000, mid: 60000, high: 72000 });
    expect(declaredCost([p(40000), p(55000)], ["kitchen"], now)).toBeNull();
    expect(declaredCost([p(40000, "Bath"), p(1, "Kitchen")], ["kitchen"], now)).toBeNull();
  });
});
