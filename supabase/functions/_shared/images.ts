// Guards for images sent to Claude. Pure, so it's tested from vitest.
//
// Claude rejects an image whose declared type doesn't match its bytes, and
// any single image over 5 MB *after* base64 encoding (a 3.9 MB photo becomes
// ~5.2 MB). One bad image fails the whole request, so each one is checked
// here and skipped with a reason instead.

export type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** The real type from the file's first bytes, or null if Claude can't read it (HEIC, TIFF, PDF…). */
export const sniffImageType = (b: Uint8Array): ImageType | null => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  return null;
};

/** Claude's per-image limit, measured on the base64 text. Kept just under. */
export const MAX_IMAGE_BASE64 = 5 * 1024 * 1024 - 64 * 1024;
/** Keep the whole request comfortably under the API's request size limit. */
export const MAX_TOTAL_BASE64 = 24 * 1024 * 1024;

export const base64Length = (bytes: number) => 4 * Math.ceil(bytes / 3);

export type ImageCheck =
  | { ok: true; type: ImageType; base64Bytes: number }
  | { ok: false; reason: "unsupported" | "too_large" | "empty" };

export const checkImage = (b: Uint8Array): ImageCheck => {
  if (b.length === 0) return { ok: false, reason: "empty" };
  const type = sniffImageType(b);
  if (!type) return { ok: false, reason: "unsupported" };
  const base64Bytes = base64Length(b.length);
  if (base64Bytes > MAX_IMAGE_BASE64) return { ok: false, reason: "too_large" };
  return { ok: true, type, base64Bytes };
};

/** A line the homeowner can act on, for images we had to leave out. */
export const skippedNote = (counts: { too_large: number; unsupported: number; unreachable: number; over_budget: number }): string | null => {
  const parts: string[] = [];
  const n = (k: number, one: string, many: string) => (k === 1 ? one : many.replace("#", String(k)));
  if (counts.too_large) parts.push(n(counts.too_large, "1 photo was too large to read", "# photos were too large to read"));
  if (counts.unsupported) parts.push(n(counts.unsupported, "1 file isn't a photo format we can read", "# files aren't a photo format we can read"));
  if (counts.unreachable) parts.push(n(counts.unreachable, "1 photo didn't upload completely", "# photos didn't upload completely"));
  if (counts.over_budget) parts.push(n(counts.over_budget, "1 more photo didn't fit in this read", "# more photos didn't fit in this read"));
  if (!parts.length) return null;
  const fixable = counts.too_large + counts.unreachable;
  const tail: string[] = [];
  if (fixable) {
    const it = fixable === 1 ? "it" : "them";
    tail.push(`Re-add ${it} and Haleo will resize ${it} automatically.`);
  }
  if (counts.unsupported) tail.push("A JPG or PNG photo works best.");
  if (!tail.length) tail.push("Try fewer photos at a time.");
  return `${parts.join("; ")}. ${tail.join(" ")}`;
};
