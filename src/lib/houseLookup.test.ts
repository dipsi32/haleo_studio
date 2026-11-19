import { describe, expect, it } from "vitest";
import { houseAddress, houseUrl, isSanJoseZip, looksLikeStreet } from "@/lib/houseLookup";

describe("house lookup", () => {
  it("takes a San Jose street and ZIP", () => {
    expect(looksLikeStreet("1553 Ilikai Ave")).toBe(true);
    expect(looksLikeStreet("Ilikai Ave")).toBe(false);
    expect(isSanJoseZip("95125")).toBe(true);
    expect(isSanJoseZip("94301")).toBe(false);
    expect(houseAddress("  1553  Ilikai Ave ", "95125")).toEqual({ street: "1553 Ilikai Ave", city: "San Jose", state: "CA", zip: "95125" });
  });

  it("builds a link that reopens the same lookup", () => {
    expect(houseUrl("1553 Ilikai Ave", "95125")).toBe("/house?street=1553+Ilikai+Ave&zip=95125");
  });
});
