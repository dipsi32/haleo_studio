import { describe, expect, it } from "vitest";
import {
  MESSAGE_LIMIT,
  declineReply,
  matchesFilter,
  nextBusinessDays,
  questionsReply,
  replyState,
  triageCompare,
  visitReply,
} from "./replyDrafts";

const ctx = { homeowner: "Pat Lee", company: "Creative Builders", project: "Second-Story Addition" };

describe("drafts", () => {
  it("opens with the homeowner's first name and the company", () => {
    const m = questionsReply(ctx, ["Is the foundation slab or raised?"]);
    expect(m.startsWith("Hi Pat, this is Creative Builders.")).toBe(true);
    expect(m).toContain("your second-story addition");
    expect(m).toContain("1. Is the foundation slab or raised?");
  });
  it("numbers several questions and stays under the limit", () => {
    const qs = Array.from({ length: 30 }, (_, i) => `Question number ${i} about the project scope and details?`);
    const m = questionsReply(ctx, qs);
    expect(m.length).toBeLessThanOrEqual(MESSAGE_LIMIT);
    expect(m).toContain("1. Question number 0");
    expect(m.endsWith("Then we can find a time to look at the space.")).toBe(true);
  });
  it("still reads fine with no company, no project and a generic name", () => {
    const m = visitReply({ homeowner: "the homeowner", company: null, project: null }, ["Tuesday 10/13"]);
    expect(m).toBe("Hi there, I read your brief for your project and I'd like to see the space. I can come by Tuesday 10/13. What works best for you?");
  });
  it("joins several days naturally and never invents times", () => {
    expect(visitReply(ctx, ["Tue 10/13", "Wed 10/14", "Fri 10/16"])).toContain("Tue 10/13, Wed 10/14 or Fri 10/16");
    expect(visitReply(ctx, [])).toContain("What days work best for you?");
  });
  it("declines kindly with the chosen reason", () => {
    const m = declineReply(ctx, "booked");
    expect(m).toContain("my schedule is full");
    expect(m).toContain("I didn't want to leave you waiting");
  });
});

describe("nextBusinessDays", () => {
  it("skips weekends", () => {
    // Fri Oct 9 2026 -> Mon 12, Tue 13, Wed 14, Thu 15
    const days = nextBusinessDays(new Date(2026, 9, 9), 4).map((d) => d.label);
    expect(days).toEqual(["Monday 10/12", "Tuesday 10/13", "Wednesday 10/14", "Thursday 10/15"]);
  });
});

describe("reply state and triage", () => {
  const m = (role: "contractor" | "homeowner", t: string) => ({ sender_role: role, created_at: t });
  it("reads the last message", () => {
    expect(replyState([])).toBe("new");
    expect(replyState([m("contractor", "2026-10-01T10:00:00Z")])).toBe("waiting");
    expect(replyState([m("homeowner", "2026-10-01T12:00:00Z"), m("contractor", "2026-10-01T10:00:00Z")])).toBe("homeowner_replied");
  });
  it("orders: homeowner wrote back, new, waiting, passed; newest first within a group", () => {
    const rows = [
      { id: "p", passed: true, state: "new" as const, sentAt: "2026-10-05" },
      { id: "w", passed: false, state: "waiting" as const, sentAt: "2026-10-04" },
      { id: "n-old", passed: false, state: "new" as const, sentAt: "2026-10-01" },
      { id: "n-new", passed: false, state: "new" as const, sentAt: "2026-10-03" },
      { id: "h", passed: false, state: "homeowner_replied" as const, sentAt: "2026-10-02" },
    ];
    expect([...rows].sort(triageCompare).map((r) => r.id)).toEqual(["h", "n-new", "n-old", "w", "p"]);
  });
  it("filters", () => {
    const wait = { passed: false, state: "waiting" as const, sentAt: null };
    const fresh = { passed: false, state: "new" as const, sentAt: null };
    const gone = { passed: true, state: "new" as const, sentAt: null };
    expect(matchesFilter(wait, "action")).toBe(false);
    expect(matchesFilter(fresh, "action")).toBe(true);
    expect(matchesFilter(gone, "action")).toBe(false);
    expect(matchesFilter(wait, "waiting")).toBe(true);
    expect(matchesFilter(gone, "all")).toBe(true);
  });
});
