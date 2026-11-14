import { describe, expect, it } from "vitest";
import { classifyHomeEntry } from "@/lib/homeEntry";

describe("the homepage box works out which door it is", () => {
  it("reads a project in their words as a project", () => {
    expect(classifyHomeEntry("Our kitchen is dark and cramped, we want to open it up")).toBe("project");
    expect(classifyHomeEntry("redo the master bathroom, walk-in shower")).toBe("project");
    expect(classifyHomeEntry("We want to add an ADU in the backyard for my parents")).toBe("project");
    expect(classifyHomeEntry("We used to love our kitchen but it's falling apart")).toBe("project");
  });

  it("reads names from neighbors as names", () => {
    expect(classifyHomeEntry("We used Acme Builders for our kitchen, on time. 408-555-0199")).toBe("names");
    expect(classifyHomeEntry("Pacific Remodeling Inc\nSouth Bay Construction")).toBe("names");
    expect(classifyHomeEntry("Lic #1025687")).toBe("names");
    expect(classifyHomeEntry("Recommend Mike, he did our bathroom")).toBe("names");
    expect(classifyHomeEntry("https://nextdoor.com/p/abc")).toBe("names");
  });

  it("reads a quote as a quote", () => {
    expect(classifyHomeEntry("Kitchen remodel estimate\nCabinets $31,000\nCountertops $9,400\nTotal $84,200")).toBe("quote");
  });

  it("doesn't mistake a budget for a quote", () => {
    expect(classifyHomeEntry("Kitchen remodel, budget around $80,000")).toBe("project");
  });
});
