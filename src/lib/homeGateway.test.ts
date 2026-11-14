import { describe, expect, it } from "vitest";
import { GATEWAY, contractorFromTyped, licenseIn, phoneIn, shortlistUrl } from "@/lib/homeGateway";

describe("homepage gateway", () => {
  it("offers four places to start, each with three steps of what happens next", () => {
    expect(GATEWAY.map((g) => g.id)).toEqual(["scratch", "thread", "one", "quote"]);
    expect(GATEWAY.every((g) => g.next.length === 3)).toBe(true);
  });

  it("builds a shortlist link that runs straight through", () => {
    const u = new URL(`https://x${shortlistUrl({ text: "We used Acme", project: "kitchen", zip: "95125", shots: true })}`);
    expect(u.pathname).toBe("/shortlist");
    expect(Object.fromEntries(u.searchParams)).toEqual({ go: "1", text: "We used Acme", project: "kitchen", zip: "95125", shots: "1" });
    expect(shortlistUrl({ name: "Bakhtiary Mehdi", zip: "951" })).toBe("/shortlist?go=1&name=Bakhtiary+Mehdi");
  });

  it("reads a license number or phone out of what they typed", () => {
    expect(licenseIn("Lic #1025687")).toBe("1025687");
    expect(licenseIn("Acme Builders")).toBeNull();
    expect(phoneIn("Acme 408-555-0199")).toBe("408-555-0199");
  });

  it("splits a typed contractor into name, phone and license", () => {
    expect(contractorFromTyped("Acme Builders 408-555-0199 Lic #1025687")).toEqual({ name: "Acme Builders", phone: "408-555-0199", license: "1025687" });
    expect(contractorFromTyped("1025687")).toEqual({ name: "License #1025687", phone: "", license: "1025687" });
    expect(contractorFromTyped("Bakhtiary Mehdi")).toEqual({ name: "Bakhtiary Mehdi", phone: "", license: "" });
  });
});
