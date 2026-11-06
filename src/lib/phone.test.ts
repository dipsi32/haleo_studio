import { describe, expect, it } from "vitest";
import { cleanPhone, typingPhone } from "@/lib/phone";

describe("homeowner phone", () => {
  it("reads any common way of writing a US number", () => {
    expect(cleanPhone("408-555-0123")).toBe("(408) 555-0123");
    expect(cleanPhone("+1 (408) 555 0123")).toBe("(408) 555-0123");
    expect(cleanPhone("14085550123")).toBe("(408) 555-0123");
  });
  it("says no to what isn't a number", () => {
    expect(cleanPhone("")).toBeUndefined();
    expect(cleanPhone("555-0123")).toBeUndefined();
    expect(cleanPhone("(108) 555-0123")).toBeUndefined();
    expect(cleanPhone(undefined)).toBeUndefined();
  });
  it("formats as they type", () => {
    expect(typingPhone("408")).toBe("408");
    expect(typingPhone("40855")).toBe("(408) 55");
    expect(typingPhone("4085550123999")).toBe("(408) 555-0123");
  });
});
