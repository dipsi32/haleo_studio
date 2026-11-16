import { describe, expect, it } from "vitest";
import { isBigJob } from "@/lib/bigJob";

describe("bigger jobs", () => {
  it("are additions, whole homes, layout changes and added space", () => {
    expect(isBigJob({ room: "addition" })).toBe(true);
    expect(isBigJob({ room: "kitchen", scope: "reconfigure" })).toBe(true);
    expect(isBigJob({ room: "kitchen", scope: "remodel" })).toBe(false);
    expect(isBigJob({ room: "bathroom", goals: ["garage-conversion"] })).toBe(true);
    expect(isBigJob({ room: "bathroom", scope: "refresh" })).toBe(false);
  });
});
