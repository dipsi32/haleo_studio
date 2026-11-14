import { describe, expect, it } from "vitest";
import { isGlanceSection, jobGlance } from "@/lib/jobGlance";

describe("job at a glance", () => {
  it("leads with what the job is, in their words, with size and scope", () => {
    const g = jobGlance({
      neighborhood: "San Jose",
      rooms: ["Kitchen"],
      budget: "$60K – $90K",
      timeline: "1–3 months",
      scope_summary: "Our project: redo our kitchen, it's too dark and the layout doesn't work",
      haleo_read: {
        summary: "A dark kitchen.",
        sections: [
          { title: "Job summary", items: [{ text: "Medium job · Electrician, Finish carpenter · about 2–4 weeks", basis: "inferred" }] },
          { title: "Scope of work", items: [{ text: "Electrical: add recessed lighting", basis: "inferred" }, { text: "Carpentry: new island", basis: "grounded" }] },
        ],
      },
    });
    expect(g.title).toBe("Kitchen remodel");
    expect(g.goal).toBe("Redo our kitchen, it's too dark and the layout doesn't work");
    expect(g.size).toMatch(/^Medium job/);
    expect(g.scope).toEqual(["Electrical: add recessed lighting", "Carpentry: new island"]);
    expect(g.facts).toEqual(["San Jose", "$60K – $90K", "1–3 months"]);
  });

  it("falls back to trades when there's no photo read, and never invents a size", () => {
    const g = jobGlance({ neighborhood: "San Jose", projectType: "Bathroom", trade_groups: [{ trade: "Plumbing", lines: ["Move the shower drain"] }] });
    expect(g.title).toBe("Bathroom remodel");
    expect(g.size).toBeNull();
    expect(g.scope).toEqual(["Plumbing: Move the shower drain"]);
  });

  it("knows which sections it already showed", () => {
    expect(isGlanceSection("Job summary")).toBe(true);
    expect(isGlanceSection("Scope of work")).toBe(true);
    expect(isGlanceSection("Risks & unknowns")).toBe(false);
  });
});

describe("whose words the goal is", () => {
  it("quotes what they typed, and never dresses our opener up as theirs", async () => {
    const { jobGlance } = await import("@/lib/jobGlance");
    const theirs = jobGlance({ rooms: ["Kitchen"], goal_note: "Our kitchen is dark and cramped", scope_summary: "We're remodeling the kitchen." });
    expect(theirs).toMatchObject({ goal: "Our kitchen is dark and cramped", goalIsTheirs: true });
    const ours = jobGlance({ rooms: ["Kitchen"], scope_summary: "We're remodeling the kitchen." });
    expect(ours.goalIsTheirs).toBe(false);
  });
});
