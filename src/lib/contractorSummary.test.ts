import { describe, expect, it } from "vitest";
import { contractorSummary, type SummaryPermit } from "./contractorSummary";

const p = (o: Partial<SummaryPermit>): SummaryPermit => ({
  work_type: null,
  description: "Reroof",
  address: "5343 LENORA AV",
  zip: "95124",
  issued_date: "2026-05-01",
  completed_date: null,
  status: "Active",
  ...o,
});

describe("contractorSummary", () => {
  it("answers what a homeowner asks, in that order", () => {
    const s = contractorSummary(
      [
        p({ completed_date: "2026-07-01", status: "Finaled" }),
        p({ description: "Install PV solar", address: "1200 CHERRY AV", zip: "95125", issued_date: "2024-03-01", completed_date: "2024-05-01" }),
        p({ issued_date: "2019-02-01", status: "Expired" }),
        p({ issued_date: "2018-02-01", completed_date: "2018-04-01" }),
        p({ issued_date: "2026-10-01", address: "88 LENORA AV" }),
      ],
      { zip: "95124", street: "Lenora Ave", now: new Date("2026-11-23") },
    );
    expect(s).toMatchObject({ total: 5, since: 2018, latest: "2026-10-01", lastYear: 2, finaled: 3, expired: 1, open: 1, inZip: 4 });
    expect(s.signedOffShare).toBe(0.75);
    expect(s.kinds[0]).toEqual({ kind: "Roof", count: 4 });
    expect(s.streets[0]).toEqual({ name: "Lenora Ave", count: 4, yours: true });
    expect(s.recent[0]).toMatchObject({ kind: "Roof", street: "Lenora Ave", date: "2026-10-01", state: "open" });
  });

  it("lists as many recent jobs as asked", () => {
    expect(contractorSummary(Array.from({ length: 12 }, () => p({})), { recent: 10 }).recent).toHaveLength(10);
  });

  it("won't put a number on too little", () => {
    expect(contractorSummary([p({ completed_date: "2026-01-01" })]).signedOffShare).toBeNull();
  });
});
