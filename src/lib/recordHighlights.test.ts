import { describe, expect, it, vi } from "vitest";

vi.mock("heic2any", () => ({ default: vi.fn() }));

import type { IntakeData } from "@/lib/intake";
import { recordHighlights, type RecordPermit, workFor } from "./recordHighlights";

const P = (description: string, issued_date: string, zip = "95110"): RecordPermit => ({ city: "SAN JOSE", zip, issued_date, work_type: "Alteration", description });
const permits: RecordPermit[] = [
  P("Kitchen remodel, new cabinets", "2026-08-01", "95125"),
  P("Kitchen and bath remodel", "2025-03-11", "95125"),
  P("Reroof", "2024-06-01"),
  P("Remove load bearing wall, new beam", "2023-02-01"),
  P("Detached ADU 800 sf", "2019-05-01"),
];
const d = (over: Partial<IntakeData>): IntakeData => ({ painPoints: [], media: [], ...over });
const now = new Date("2026-10-01");

describe("recordHighlights", () => {
  it("starts with the track record, before anything is entered", () => {
    const h = recordHighlights(permits, d({}), "Creative Builders", now);
    expect(h.map((x) => x.id)).toEqual(["track"]);
    expect(h[0].text).toBe("Creative Builders has 5 permits on file in San Jose since 2019, and pulled one as recently as Aug 2026.");
  });

  it("adds their kind of job once the project is picked", () => {
    const h = recordHighlights(permits, d({ room: "kitchen", rooms: ["kitchen"] }), "Creative Builders", now);
    expect(h.find((x) => x.id === "work")?.text).toBe("2 kitchen permits in San Jose, the latest in Aug 2026. That's the kind of work you're planning.");
  });

  it("adds their neighborhood once the address is in", () => {
    const h = recordHighlights(permits, d({ room: "kitchen", address: { zip: "95125", city: "San Jose" } }), "Creative Builders", now);
    expect(h.find((x) => x.id === "nearby")?.text).toMatch(/^2 jobs in 95125, your ZIP code\./);
  });

  it("adds structural work only for bigger scopes", () => {
    expect(recordHighlights(permits, d({ room: "kitchen", scope: "refresh" }), "X", now).some((x) => x.id === "structural")).toBe(false);
    expect(recordHighlights(permits, d({ room: "kitchen", scope: "structural" }), "X", now).find((x) => x.id === "structural")?.text).toMatch(/^2 permits involving structural work/);
  });

  it("never states a negative: unmatched facts are simply left out", () => {
    const h = recordHighlights(permits, d({ room: "other", goals: ["pool-removal"], address: { zip: "94000" } }), "X", now);
    expect(h.map((x) => x.id)).toEqual(["track"]);
    expect(recordHighlights([], d({ room: "kitchen" }), "X", now)).toEqual([]);
  });

  it("doesn't call an old record recent", () => {
    const h = recordHighlights([P("Kitchen remodel", "2020-01-01")], d({}), "X", now);
    expect(h[0].text).toBe("X has 1 permit on file in San Jose since 2020.");
  });

  it("answers what they've typed before they pick anything", () => {
    expect(workFor(d({ goalNote: "We want to redo our kitchen" }))?.word).toBe("kitchen");
    expect(workFor(d({ goalNote: "New roof before the rains" }))?.word).toBe("roofing");
    expect(workFor(d({ goalNote: "Paint the hallway" }))).toBeNull();
  });

  it("names jobs from goals before rooms", () => {
    expect(workFor(d({ goals: ["roof"], room: "other" }))?.word).toBe("roofing");
    expect(workFor(d({ room: "living" }))).toBeNull();
  });
});
