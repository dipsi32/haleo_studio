import { describe, expect, it } from "vitest";
import { scorecard, totalRow, weekStart, type PilotRow } from "@/lib/pilotScorecard";

const base: PilotRow = {
  contractor_id: "c1",
  name: "US Creative Builders",
  slug: "matt",
  claimed: true,
  status: "active",
  started_at: new Date(Date.now() - 30 * 864e5).toISOString(),
  baseline: { inquiries: 12, visits: 8, jobs_won: 2, late_mismatches_per_10_visits: 3 },
  price_offered_monthly: 49,
  paying_since: null,
  inquiries_reported: 20,
  links_reported: 17,
  weeks_reported: 4,
  front_door_views: 30,
  links_made: 3,
  links_opened: 3,
  intakes_started: 16,
  briefs_sent: 12,
  median_minutes_to_send: 11,
  homeowner_ease: { easy: 8, okay: 2, hard: 0 },
  outcomes: {
    decided: 11, pursue: 7, clarify: 2, pass: 2, median_hours_to_decision: 3,
    effort_answers: 10, saved_a_lot: 5, saved_some: 3, no_difference: 2, more_work: 0,
    visits: 6, as_expected: 5, small_surprise: 1, big_mismatch: 0, won: 3, lost: 2, open: 2, won_value_k: 140,
  },
  active_weeks: 4,
  last_activity: new Date().toISOString(),
  would_pay: { answer: "yes", price: 49 },
};

const byN = (r: PilotRow) => Object.fromEntries(scorecard(r).map((a) => [a.n, a]));

describe("launch scorecard", () => {
  it("answers all seven questions, in order", () => {
    const s = scorecard(base);
    expect(s.map((a) => a.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("reads a healthy pilot as healthy", () => {
    const a = byN(base);
    expect(a[1].headline).toBe("85% of inquiries got the link");
    expect(a[1].verdict).toBe("good");
    expect(a[2].headline).toBe("75% of homeowners who started sent a brief");
    expect(a[3].verdict).toBe("good");
    expect(a[4].headline).toMatch(/Win rate up 35 points/);
    expect(a[5].headline).toBe("Saved back-and-forth on 80% of briefs");
    expect(a[6].verdict).toBe("good");
    expect(a[7].verdict).toBe("good");
  });

  it("says 'too early' instead of a percentage of two", () => {
    const a = byN({ ...base, inquiries_reported: 2, links_reported: 1, intakes_started: 2, links_opened: 2, briefs_sent: 2, outcomes: { ...base.outcomes!, decided: 1, won: 1, lost: 0, effort_answers: 1 } });
    expect(a[1].verdict).toBe("early");
    expect(a[2].verdict).toBe("early");
    expect(a[3].verdict).toBe("early");
    expect(a[4].verdict).toBe("early");
    expect(a[5].verdict).toBe("early");
  });

  it("shows a gap as a gap, never as good news", () => {
    const a = byN({ ...base, weeks_reported: 0, inquiries_reported: 0, links_reported: 0, baseline: {} });
    expect(a[1].headline).toBe("Not reported yet");
    expect(a[4].details[0]).toMatch(/No baseline yet/);
  });

  it("flags friction when homeowners find it hard", () => {
    const a = byN({ ...base, homeowner_ease: { easy: 3, okay: 2, hard: 5 } });
    expect(a[2].verdict).toBe("concern");
    expect(a[6].verdict).toBe("concern");
  });

  it("flags a contractor who stopped using it", () => {
    const a = byN({ ...base, active_weeks: 1, would_pay: null, started_at: new Date(Date.now() - 40 * 864e5).toISOString() });
    expect(a[7].verdict).toBe("concern");
  });

  it("adds pilots together for the top line", () => {
    const t = totalRow([base, { ...base, contractor_id: "c2", briefs_sent: 3 }])!;
    expect(t.briefs_sent).toBe(15);
    expect(t.outcomes!.won).toBe(6);
  });

  it("keys the weekly count by Monday", () => {
    expect(weekStart(new Date(2026, 10, 12))).toBe("2026-11-09"); // Thursday → Monday
    expect(weekStart(new Date(2026, 10, 9))).toBe("2026-11-09");
    expect(weekStart(new Date(2026, 10, 15))).toBe("2026-11-09"); // Sunday
  });
});
