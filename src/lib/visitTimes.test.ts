import { describe, expect, it } from "vitest";
import { cleanVisitTimes, formatVisitTime, upcomingDays, visitKey } from "./visitTimes";

describe("visit times", () => {
  it("offers the coming days, starting tomorrow", () => {
    const days = upcomingDays(3, new Date(2026, 10, 2, 15));
    expect(days.map((d) => d.iso)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(days[0].weekday).toBe("Tue");
  });

  it("reads like a person would say it", () => {
    expect(formatVisitTime(visitKey("2026-11-05", "morning"))).toBe("Thu, Nov 5 · morning");
  });

  it("keeps only real times, sorted, at most three", () => {
    expect(
      cleanVisitTimes(["2026-11-07|evening", "junk", "2026-11-05|morning", "2026-11-05|morning", "2026-11-06|afternoon", "2026-11-09|morning", 4]),
    ).toEqual(["2026-11-05|morning", "2026-11-06|afternoon", "2026-11-07|evening"]);
    expect(cleanVisitTimes("nope")).toEqual([]);
  });
});
