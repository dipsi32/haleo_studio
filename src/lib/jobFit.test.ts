import { describe, expect, it } from "vitest";
import { jobFit, readLicense } from "@/lib/jobFit";
import type { LicenseStatus } from "@/lib/contractors";
import type { TrackPermit } from "@/lib/trackRecord";

const now = new Date("2026-11-13T00:00:00Z");
const p = (over: Partial<TrackPermit>): TrackPermit => ({
  city: "SAN JOSE", zip: "95125", issued_date: "2026-06-01", work_type: "Alteration", description: "Kitchen remodel", address: "1553 ILIKAI AV", permit_number: "2026-1", ...over,
});
const lic = (over: Partial<LicenseStatus> = {}): LicenseStatus => ({
  license_number: "1025687", status: "Active", business_name: "US Creative Builders", classifications: ["B"], issue_date: "2017-01-01",
  expiration_date: "2028-01-01", has_disciplinary_action: false, disciplinary_notes: null, workers_comp_status: null, bond_status: null,
  scrape_succeeded: true, last_checked_at: now.toISOString(), deep_link: "", ...over,
});
const kitchen = { room: "kitchen" as const, address: { zip: "95125" }, painPoints: [], media: [] };

describe("job fit", () => {
  it("answers five questions and counts the ones that line up", () => {
    const permits = [p({}), p({ permit_number: "2" }), p({ permit_number: "3", address: "10 LINCOLN AV" }), p({ zip: "95112", description: "Bath remodel", permit_number: "4" })];
    const f = jobFit(permits, kitchen, { license: lic(), now });
    expect(f.rows.map((r) => r.id)).toEqual(["done_it", "near_you", "active", "inspections", "license"]);
    expect(f.rows[0]).toMatchObject({ level: "yes", fact: "3 kitchen permits on their San Jose record" });
    expect(f.rows[1].fact).toBe("3 jobs in 95125, on Ilikai Av and Lincoln Av");
    expect(f.rows[3].level).toBe("not_checked");
    expect(f.headline).toBe("Lines up with your kitchen job on 4 of 5 · 1 not checked yet");
  });

  it("never counts a license the board didn't answer for", () => {
    const f = jobFit([p({})], kitchen, { license: lic({ scrape_succeeded: false }), now });
    const row = f.rows.find((r) => r.id === "license")!;
    expect(row.level).toBe("not_checked");
    expect(row.source).toBe("Not checked");
    expect(f.flag).toBeNull();
  });

  it("puts a flag first, and ranks it last", () => {
    const bad = jobFit([p({}), p({}), p({})], kitchen, { license: lic({ has_disciplinary_action: true }), now });
    const thin = jobFit([], kitchen, { now });
    expect(bad.headline).toBe("Disciplinary record on the state license.");
    expect(bad.rank).toBeLessThan(thin.rank);
  });

  it("asks for a ZIP instead of guessing", () => {
    const f = jobFit([p({})], { room: "kitchen", painPoints: [], media: [] }, { now });
    expect(f.rows[1]).toMatchObject({ level: "not_checked", fact: "Add your ZIP to check this." });
  });

  it("reads inspections as sign-offs, and no sign-offs as work underway", () => {
    const signed = jobFit([p({})], kitchen, {
      now,
      inspections: [{ folder_number: "2026-1", found: true, lifecycle: "closed", approvals: [
        { code: "E", label: "Electrical", status: "complete" }, { code: "P", label: "Plumbing", status: "complete" }, { code: "B", label: "Building", status: "complete" },
      ] }],
    });
    expect(signed.rows[3]).toMatchObject({ level: "yes", fact: "3 city sign-offs across 1 recent permit, 1 closed out" });
    const open = jobFit([p({})], kitchen, { now, inspections: [{ folder_number: "2026-1", found: true, approvals: [] }] });
    expect(open.rows[3].level).toBe("no");
    expect(open.rows[3].fact).toMatch(/still underway/);
  });

  it("reads license states", () => {
    expect(readLicense(lic({ expiration_date: "2026-12-20" }), now)).toBe("expiring");
    expect(readLicense(lic({ status: "Suspended" }), now)).toBe("inactive");
    expect(readLicense(lic({ expiration_date: "2025-01-01" }), now)).toBe("inactive");
    expect(readLicense(null, now)).toBe("not_checked");
  });

  it("reads a name with no city record as unknown, not as no", () => {
    const f = jobFit([], kitchen, { now, noRecord: true });
    expect(f.rows.slice(0, 4).every((r) => r.level === "not_checked")).toBe(true);
    expect(f.headline).toBe("Not enough on public record to check yet");
  });
});
