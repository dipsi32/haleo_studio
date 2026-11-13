import { describe, expect, it } from "vitest";
import { projectSummary } from "@/lib/projectSummary";
import type { DealSnapshot } from "@/lib/dealRead";

const snap: DealSnapshot = {
  neighborhood: "San Jose",
  rooms: ["Kitchen"],
  scope_summary: "Our project: redo our kitchen, it's too dark and the layout doesn't work",
  room_size: "Medium, 100–200 sq ft",
  finish_level: "Mid-range",
  scope_label: "Full remodel",
  budget: "$60K – $90K",
  timeline: "1–3 months",
  frustrations: ["Too dark", "Cramped"],
  room_photo_urls: ["a.jpg", "b.jpg"],
  haleo_read: {
    summary: "A dark, character-rich kitchen. Better lighting is the quickest win.",
    sections: [
      { title: "Job summary", items: [{ text: "Medium job · Electrician · about 2–4 weeks", basis: "inferred" }] },
      { title: "Scope of work", items: [{ text: "Electrical: layered lighting, new circuits", basis: "inferred" }, { text: "Carpentry: new island", basis: "grounded" }] },
      { title: "Risks & unknowns", items: [{ text: "Wall behind the range may be load-bearing", basis: "question" }] },
      { title: "Verify on site", items: [{ text: "Panel capacity", basis: "question" }] },
      { title: "Homeowner's answers", items: [{ text: "Is there a window on the walls we can't see? No", basis: "grounded" }] },
    ],
  },
  context: { why_now: "family", who_decides: "partner", funding: "cash", visit_times: ["2026-11-20|morning"], found_via: "referral" },
};

describe("project summary", () => {
  it("leads with the job, in their words", () => {
    const p = projectSummary(snap);
    expect(p.title).toBe("Kitchen remodel");
    expect(p.goal).toBe("Redo our kitchen, it's too dark and the layout doesn't work");
    expect(p.where).toBe("San Jose");
  });

  it("puts the numbers a contractor prices from first, in order", () => {
    expect(projectSummary(snap).facts.map((f) => `${f.label}: ${f.value}`)).toEqual([
      "Size: Medium, 100–200 sq ft",
      "Scope: Full remodel",
      "Finish: Mid-range",
      "Budget: $60K – $90K",
      "Start: 1–3 months",
    ]);
  });

  it("marks what's missing as open, never guesses", () => {
    const p = projectSummary({ neighborhood: "San Jose", rooms: ["Bathroom"] });
    expect(p.facts.find((f) => f.label === "Budget")).toEqual({ label: "Budget", value: "Not shared yet", open: true });
    expect(p.facts.find((f) => f.label === "Size")?.open).toBe(true);
    expect(p.work).toEqual([]);
    expect(p.logistics).toEqual([]);
  });

  it("splits the work by trade and lists what to settle on site", () => {
    const p = projectSummary(snap);
    expect(p.work[0]).toEqual({ trade: "Electrical", text: "layered lighting, new circuits" });
    expect(p.settle).toEqual(["Panel capacity", "Wall behind the range may be load-bearing"]);
  });

  it("keeps their answers to the photo questions with the space", () => {
    expect(projectSummary(snap).today.answers).toEqual(["Is there a window on the walls we can't see? No"]);
  });

  it("gathers the logistics they shared", () => {
    const labels = projectSummary(snap).logistics.map((l) => l.label);
    expect(labels).toEqual(["Can meet", "Why now", "Decides", "Paying with", "Found you"]);
  });
});
