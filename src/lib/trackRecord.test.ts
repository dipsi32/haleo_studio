import { describe, expect, it } from "vitest";
import { jobWhat, streetOf, trackChips, trackRecord, type Inspection, type TrackPermit } from "@/lib/trackRecord";
import type { IntakeData } from "@/lib/intake";

// Matt's real permits, as stored.
const permits: TrackPermit[] = [
  { permit_number: "2025-113070-RS", address: "1416 SIETA CT", zip: "95118", issued_date: "2026-02-12", work_type: "1 & 2 Family Detached Dwellings", description: "Addition and alterations · Single-Family — Additions/Alterations", city: "San Jose" },
  { permit_number: "2026-140983-RS", address: "6410 DESERT FLAME DR", zip: "95120", issued_date: "2026-10-05", work_type: "1 & 2 Family Detached Dwellings", description: "Minor kitchen/bath remodel. multiple fixture replacement · Single-Family — Additions/Alterations", city: "San Jose" },
  { permit_number: "2025-145832-RS", address: "1553 ILIKAI AV", zip: "95118", issued_date: "2026-06-22", work_type: "1 & 2 Family Detached Dwellings", description: "Addition/alteration · Single-Family — Additions/Alterations", city: "San Jose" },
];

const inspections: Inspection[] = [
  { folder_number: "2026-140983-RS", found: true, lifecycle: "in_inspection", approvals: [
    { code: "E", label: "Electrical", status: "complete" }, { code: "M", label: "Mechanical", status: "complete" }, { code: "P", label: "Plumbing", status: "complete" },
  ] },
  { folder_number: "2025-145832-RS", found: true, lifecycle: "closed", approvals: [{ code: "B", label: "Building", status: "complete" }, { code: "E", label: "Electrical", status: "pending" }] },
];

const data = (over: Partial<IntakeData>): IntakeData => ({ media: [], painPoints: [], ...over }) as unknown as IntakeData;

describe("track record", () => {
  it("counts their kind of work, jobs in the homeowner's ZIP, and city sign-offs", () => {
    const t = trackRecord(permits, data({ room: "kitchen", address: { zip: "95118" } as IntakeData["address"] }), inspections, { status: "This license is current and active.", classifications: ["B - General Building"], issue_date: "2017-03-01" });
    expect(t.permits).toBe(3);
    expect(t.since).toBe(2026);
    expect(t.matching).toEqual({ word: "kitchen", count: 1 });
    expect(t.nearby).toEqual({ zip: "95118", count: 2, streets: ["Ilikai Av", "Sieta Ct"] });
    expect(t.inspections).toEqual({ checked: 2, signoffs: 4, trades: ["Electrical", "Mechanical", "Plumbing", "Building"], finaled: 1 });
    expect(t.license).toMatchObject({ active: true, since: 2017, classes: ["B - General Building"] });
    expect(t.recent[0]).toMatchObject({ what: "Minor kitchen and bath remodel", street: "Desert Flame Dr", zip: "95120", signoffs: ["Electrical", "Mechanical", "Plumbing"] });
  });

  it("leaves out what didn't answer, instead of calling it fine", () => {
    const t = trackRecord(permits, data({}), null, { status: null });
    expect(t.inspections).toBeNull();
    expect(t.license).toBeNull();
    expect(t.matching).toBeNull();
    expect(t.nearby).toBeNull();
  });

  it("never shows a house number", () => {
    expect(streetOf("1553 ILIKAI AV")).toBe("Ilikai Av");
    expect(streetOf("6410  DESERT FLAME DR  , SAN JOSE CA 95120-3922")).toBe("Desert Flame Dr");
    expect(streetOf("")).toBeNull();
    expect(jobWhat({ description: "(PME)  Minor Kitchen/Bath Remodel. Multiple fixture replacement" } as TrackPermit)).toBe("Minor kitchen and bath remodel");
  });

  it("puts the most relevant chips first", () => {
    const t = trackRecord(permits, data({ room: "kitchen", address: { zip: "95118" } as IntakeData["address"] }), inspections, { status: "Active" });
    expect(trackChips(t).map((c) => c.id)).toEqual(["matching", "nearby", "inspections", "license", "permits"]);
  });

  it("doesn't call an expired license active", () => {
    const t = trackRecord(permits, data({}), null, { status: "Inactive / expired" });
    expect(t.license?.active).toBe(false);
  });
});
