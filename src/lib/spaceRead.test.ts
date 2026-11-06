import { describe, expect, it } from "vitest";
import { atAGlance, basisTag, normalizeSpaceRead, siteBriefSections } from "../../supabase/functions/_shared/spaceRead";

const urls = ["https://x/1.jpg", "https://x/2.jpg"];
const raw = {
  headline: "A dark, character-rich kitchen. Better lighting is the quickest win.",
  noticed: [
    { kind: "good", title: "Timber ceiling worth keeping", note: "Exposed beams add volume; likely structural.", photo: 1 },
    { kind: "watch", title: "Only three bare bulbs", note: "Not enough light for a high ceiling.", photo: 1 },
    { kind: "unknown", title: "No window in view", note: "Daylight seems to come from the hall.", photo: 9 },
    { kind: "good", title: "A fourth one", note: "Dropped: three at most." },
  ],
  questions: [
    { question: "Is there a window on the walls we can't see?", why: "Daylight changes the lighting plan.", options: ["Yes, one", "Yes, several", "No", "Not sure"], photo: 1 },
    { question: "What bothers you most about the layout?", why: "Sets the scope.", options: ["Counter space", "Storage", "Moving around", "Something else"] },
    { question: "Only one option", why: "Dropped.", options: ["Yes"] },
  ],
  photo_request: "the other walls, especially any windows",
  site_brief: {
    likely_work: [
      { trade: "Electrical", work: "Layered lighting: task, ambient, accent; new circuits.", basis: "inferred" },
      { trade: "Flooring", work: "Refinish wide-plank floor if solid.", basis: "question" },
    ],
    watch_outs: [{ text: "Timbers likely carry the roof; no ceiling changes without an engineer.", basis: "inferred" }],
    check_on_site: ["Panel capacity", "Roof above the timbers", "Plank condition"],
    job_size: "medium",
    trades: ["Electrician", "Finish carpenter"],
    duration: "about 2–4 weeks",
  },
};

describe("normalizeSpaceRead", () => {
  it("keeps the read within what the page is designed for", () => {
    const r = normalizeSpaceRead(raw, urls)!;
    expect(r.headline).toMatch(/^A dark, character-rich kitchen/);
    expect(r.noticed).toHaveLength(3);
    expect(r.noticed[0].photo_url).toBe("https://x/1.jpg");
    expect(r.noticed[2].photo_url).toBeNull();
    expect(r.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(r.questions[0].options).toContain("Not sure");
    expect(r.photo_request).toBe("the other walls, especially any windows");
    expect(r.site_brief.job_size).toBe("medium");
  });
  it("returns null when there's no usable read, and repairs odd fields", () => {
    expect(normalizeSpaceRead(null, urls)).toBeNull();
    expect(normalizeSpaceRead({ headline: "" }, urls)).toBeNull();
    const r = normalizeSpaceRead({ headline: "x", noticed: [{ kind: "weird", title: "t", note: "n" }], site_brief: { job_size: "huge" } }, urls)!;
    expect(r.noticed[0].kind).toBe("unknown");
    expect(r.site_brief.job_size).toBe("unclear");
    expect(r.site_brief.duration).toBe("unclear");
    expect(r.questions).toEqual([]);
  });
});

describe("the contractor's site brief", () => {
  it("leads with size, trades and duration, then their answers, then the work", () => {
    const r = normalizeSpaceRead(raw, urls)!;
    expect(atAGlance(r.site_brief)).toBe("Medium job · Electrician, Finish carpenter · about 2–4 weeks");
    const secs = siteBriefSections(r.site_brief, [{ question: "Is there a window on the walls we can't see?", answer: "No" }]);
    expect(secs.map((s) => s.title)).toEqual(["Job summary", "Homeowner's answers", "Scope of work", "Risks & unknowns", "Verify on site"]);
    expect(secs[1].items[0].text).toBe("Is there a window on the walls we can't see? No");
    expect(secs[2].items[0].text).toMatch(/^Electrical: Layered lighting/);
  });
});

describe("line tags", () => {
  it("say what kind of claim a line is, in plain words, and stay quiet for the normal case", () => {
    expect(basisTag("grounded", "Scope of work")).toBeNull();
    expect(basisTag("inferred", "Scope of work")).toEqual({ label: "Likely", tone: "likely" });
    expect(basisTag("question", "Risks & unknowns")).toEqual({ label: "Verify on site", tone: "verify" });
    expect(basisTag("question", "Verify on site")).toBeNull();
    expect(basisTag("grounded", "Homeowner's answers")).toBeNull();
    expect(basisTag("inferred", "Job summary")).toEqual({ label: "Estimate", tone: "estimate" });
  });
});
