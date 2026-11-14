import { describe, expect, it } from "vitest";
import { routeShare } from "@/lib/shareIn";

describe("routing what's shared into Haleo", () => {
  it("sends a quote to the quote check", () => {
    const r = routeShare({ text: "Kitchen remodel estimate. Cabinets $18,400. Total $62,000, 30% deposit." });
    expect(r.kind).toBe("quote");
  });

  it("sends a thread with names to the shortlist", () => {
    const r = routeShare({ text: "We used Acme Builders, great. Also try Pacific Remodeling 408-555-0199 https://nextdoor.com/p/abc" });
    expect(r.kind).toBe("names");
    expect(r.site).toBe("Nextdoor");
    expect(r.text).toContain("Acme Builders");
  });

  it("reads a business name from a shared page title", () => {
    const r = routeShare({ title: "US Creative Builders - San Jose - Yelp", url: "https://www.yelp.com/biz/us-creative" });
    expect(r.kind).toBe("names");
    expect(r.text.startsWith("US Creative Builders - San Jose")).toBe(true);
  });

  it("is honest about a bare link it can't read", () => {
    const r = routeShare({ url: "https://nextdoor.com/p/xyz" });
    expect(r).toEqual({ kind: "link_only", text: "https://nextdoor.com/p/xyz", site: "Nextdoor" });
  });
});
