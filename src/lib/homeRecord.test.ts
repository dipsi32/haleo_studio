import { describe, expect, it } from "vitest";
import { homeRecord } from "@/lib/homeRecord";

const p = (over: Record<string, unknown>) => ({
  permit_number: "1", description: "Kitchen remodel · Single-Family", issued_date: "2021-04-01", status: "Finaled", final_date: "2021-09-01",
  is_open: false, is_expired_without_final: false, ...over,
});

describe("the home's record", () => {
  it("lists permits newest first with what the city signed off", () => {
    const r = homeRecord(
      [p({ permit_number: "A", issued_date: "2018-02-01", description: "Reroof" }), p({ permit_number: "B" })],
      [{ folder_number: "B", found: true, lifecycle: "closed", approvals: [{ label: "Building", status: "complete" }, { label: "Electrical", status: "complete" }, { label: "Plumbing", status: "pending" }] }],
    );
    expect(r.rows.map((x) => x.permit)).toEqual(["B", "A"]);
    expect(r.rows[0]).toMatchObject({ what: "Kitchen remodel", state: "finaled", signoffs: ["Building", "Electrical"], year: 2021 });
    expect(r.headline).toBe("2 permits on file since 2018, none left unfinished.");
  });

  it("calls out unfinished work plainly", () => {
    const r = homeRecord([
      p({ permit_number: "X", final_date: null, status: "Expired", is_expired_without_final: true }),
      p({ permit_number: "Y", final_date: null, status: "Active", is_open: true }),
    ]);
    expect(r.rows.map((x) => x.stateLabel)).toEqual(["Expired, never signed off", "Still open with the city"]);
    expect(r.headline).toBe("2 permits on file since 2021. 1 expired without a sign-off, 1 still open.");
  });

  it("says so when there's nothing on file", () => {
    expect(homeRecord([]).headline).toBe("No permits on file for this address.");
  });
});
