// US phone numbers, as homeowners type them and as contractors dial them. Pure.

/**
 * A US phone number as people read it, "(408) 555-0123", or undefined if it
 * isn't one. Accepts any punctuation and a leading +1 or 1.
 */
export const cleanPhone = (raw: string | null | undefined): string | undefined => {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d)) return undefined;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

/** As they type: "4085550" becomes "(408) 555-0". Never longer than a full number. */
export const typingPhone = (raw: string): string => {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};
