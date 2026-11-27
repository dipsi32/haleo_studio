// "What's on file for your house?" The free lookup: an address in, the
// home's permit record out. Pure helpers for the page (src/pages/House.tsx);
// tested in houseLookup.test.ts.
import type { Address } from "@/lib/intake";

/** San Jose ZIPs start 950/951. The permit record only covers San Jose for now. */
export const isSanJoseZip = (zip: string) => /^95[01]\d{2}$/.test(zip.trim());

/** A street worth looking up: a house number and a street name. */
export const looksLikeStreet = (s: string) => /^\s*\d+[a-z]?\s+\S+/i.test(s);

export const houseAddress = (street: string, zip: string): Address => ({
  street: street.trim().replace(/\s+/g, " "),
  city: "San Jose",
  state: "CA",
  zip: zip.trim(),
});

/** The shareable link for a lookup: /house?street=…&zip=… */
export const houseUrl = (street: string, zip: string) =>
  `/house?${new URLSearchParams({ street: street.trim(), zip: zip.trim() }).toString()}`;

/** What a neighbor gets when it's shared: the tool, never this person's address. */
export const SHARE_TEXT =
  "I just looked up the permits on file for my house, including anything the city never signed off. Free, takes a minute:";

/** The house's birth certificate: a printable, frameable history. */
export const certificateUrl = (street: string, zip: string) =>
  `/house/certificate?${new URLSearchParams({ street: street.trim(), zip: zip.trim() }).toString()}`;
