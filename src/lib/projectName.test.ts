import { describe, expect, it, vi } from "vitest";

// intake.ts loads an image converter that needs a real canvas; not needed here.
vi.mock("heic2any", () => ({ default: vi.fn() }));
import type { IntakeData } from "@/lib/intake";
import { projectLabel, projectNoun, projectOpener } from "./projectName";

const d = (over: Partial<IntakeData>): IntakeData => ({ painPoints: [], media: [], ...over });

describe("project naming", () => {
  it("never says 'something else'", () => {
    const cases = [
      d({ room: "other" }),
      d({ room: "other", goals: ["other-job"] }),
      d({ room: "other", goals: ["other-job"], goalNote: "Replace the rotted back deck. Maybe add a pergola." }),
    ];
    for (const c of cases) {
      expect(projectOpener(c).toLowerCase()).not.toMatch(/something else/);
      expect(projectLabel(c).toLowerCase()).not.toMatch(/something else/);
    }
  });

  it("uses the homeowner's own words for an 'other' job", () => {
    const c = d({ room: "other", goals: ["other-job"], goalNote: "Replace the rotted back deck. Maybe add a pergola." });
    expect(projectOpener(c)).toBe("Our project: replace the rotted back deck.");
    expect(projectLabel(c)).toBe("Replace the rotted back deck");
  });

  it("names non-room jobs from the goals they picked", () => {
    expect(projectOpener(d({ room: "other", goals: ["pool-removal"] }))).toBe("We're planning a pool removal.");
    expect(projectOpener(d({ room: "other", goals: ["roof", "plumbing"] }))).toBe("We're planning roof work and plumbing work.");
    expect(projectLabel(d({ room: "other", goals: ["roof", "plumbing"] }))).toBe("Roof & Plumbing");
  });

  it("names rooms the way people say them", () => {
    expect(projectOpener(d({ room: "kitchen" }))).toBe("We're remodeling the kitchen.");
    expect(projectOpener(d({ room: "living" }))).toBe("We're remodeling the living room.");
    expect(projectOpener(d({ room: "full-home", rooms: ["kitchen", "bathroom"] }))).toBe("We're remodeling the kitchen and the bathroom.");
    expect(projectLabel(d({ room: "full-home", rooms: ["kitchen", "bathroom"] }))).toBe("Kitchen & bathroom");
    expect(projectOpener(d({ room: "full-home" }))).toBe("We're remodeling our whole home.");
  });

  it("handles additions and garage conversions", () => {
    expect(projectOpener(d({ room: "addition" }))).toBe("We're adding on to our home.");
    expect(projectOpener(d({ room: "addition", goals: ["garage-conversion"] }))).toBe("We're converting our garage into living space.");
    expect(projectLabel(d({ room: "addition", goals: ["garage-conversion"] }))).toBe("Garage conversion");
  });

  it("falls back plainly with nothing chosen", () => {
    expect(projectOpener(d({}))).toBe("We're planning a home project.");
    expect(projectNoun(d({}))).toBe("home project");
  });
});
