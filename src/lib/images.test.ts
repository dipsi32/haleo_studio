import { describe, expect, it } from "vitest";
import { base64Length, checkImage, MAX_IMAGE_BASE64, skippedNote, sniffImageType } from "../../supabase/functions/_shared/images";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const HEIC = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63); // ....ftypheic

describe("image guards", () => {
  it("reads the real type from the bytes, not the label", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(HEIC)).toBeNull();
  });

  it("rejects a photo that is under 5 MB on disk but over 5 MB once encoded", () => {
    expect(base64Length(3)).toBe(4);
    const big = new Uint8Array(3_900_000); big.set(JPEG);
    expect(base64Length(big.length)).toBeGreaterThan(MAX_IMAGE_BASE64);
    expect(checkImage(big)).toEqual({ ok: false, reason: "too_large" });
    const fine = new Uint8Array(900_000); fine.set(JPEG);
    expect(checkImage(fine)).toMatchObject({ ok: true, type: "image/jpeg" });
    expect(checkImage(HEIC)).toEqual({ ok: false, reason: "unsupported" });
    expect(checkImage(new Uint8Array(0))).toEqual({ ok: false, reason: "empty" });
  });

  it("says what was left out in words a homeowner can act on", () => {
    expect(skippedNote({ too_large: 1, unsupported: 0, unreachable: 0, over_budget: 0 })).toBe(
      "1 photo was too large to read. Re-add it and Haleo will resize it automatically.",
    );
    expect(skippedNote({ too_large: 0, unsupported: 0, unreachable: 0, over_budget: 0 })).toBeNull();
    expect(skippedNote({ too_large: 0, unsupported: 0, unreachable: 0, over_budget: 3 })).toBe("3 more photos didn't fit in this read. Try fewer photos at a time.");
    expect(skippedNote({ too_large: 2, unsupported: 1, unreachable: 0, over_budget: 0 })).toMatch(/^2 photos were too large to read; 1 file isn't a photo format/);
  });
});
