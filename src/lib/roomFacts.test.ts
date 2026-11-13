import { describe, expect, it } from "vitest";
import { finishLabel, parseSqft, primaryRoom, sizeBuckets, sizeLabel } from "@/lib/roomFacts";

describe("room facts", () => {
  it("uses ranges that fit the room", () => {
    expect(sizeBuckets("kitchen")[1].range).toBe("100–200 sq ft");
    expect(sizeBuckets("bathroom")[0].range).toBe("under 40 sq ft");
  });

  it("labels a size the way a contractor reads it", () => {
    expect(sizeLabel({ bucket: "medium" }, "kitchen")).toBe("Medium, 100–200 sq ft");
    expect(sizeLabel({ bucket: "medium", sqft: 152 }, "kitchen")).toBe("About 152 sq ft");
    expect(sizeLabel({ bucket: "unsure" }, "kitchen")).toBe("Size not sure yet");
    expect(sizeLabel(null, "kitchen")).toBeNull();
  });

  it("reads square feet however it's typed", () => {
    expect(parseSqft("150")).toBe(150);
    expect(parseSqft("1,200 sq ft")).toBe(1200);
    expect(parseSqft("12 x 14")).toBe(168);
    expect(parseSqft("12by14")).toBe(168);
    expect(parseSqft("big")).toBeNull();
    expect(parseSqft("3")).toBeNull();
  });

  it("names finish levels plainly", () => {
    expect(finishLabel("mid")).toBe("Mid-range");
    expect(finishLabel(undefined)).toBeNull();
  });
});

describe("primary room", () => {
  it("uses what they picked, else what they typed", () => {
    expect(primaryRoom({ room: "bathroom" })).toBe("bathroom");
    expect(primaryRoom({ rooms: ["kitchen"] })).toBe("kitchen");
    expect(primaryRoom({ goalNote: "Redo our kitchen, it's too dark" })).toBe("kitchen");
    expect(primaryRoom({ room: "other" })).toBe("other");
  });
});
