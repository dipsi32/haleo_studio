import { describe, expect, it } from "vitest";
import { permitDescription, permitJobName } from "../../supabase/functions/_shared/permitText";

describe("permitJobName", () => {
  it("keeps the job, drops the city's codes", () => {
    expect(permitJobName("BPD (BEMP100%) KITCHEN REMODEL")).toBe("Kitchen remodel");
    expect(permitJobName("OTC BATHROOM REMODEL")).toBe("Bathroom remodel");
    expect(permitJobName("NEW DETACHED ADU 800 SF")).toBe("New detached ADU 800 sf");
  });
  it("returns null when nothing useful is left", () => {
    expect(permitJobName("BPD (X)")).toBeNull();
    expect(permitJobName("")).toBeNull();
    expect(permitJobName(null)).toBeNull();
  });
});

describe("permitDescription", () => {
  it("leads with the job name", () => {
    expect(permitDescription("BPD (BEMP100%) KITCHEN REMODEL", "Single-Family — Additions/Alterations")).toBe(
      "Kitchen remodel · Single-Family — Additions/Alterations",
    );
    expect(permitDescription(null, "Single-Family — Additions/Alterations")).toBe("Single-Family — Additions/Alterations");
    expect(permitDescription(null, "")).toBeNull();
  });
});
