import { describe, expect, it } from "vitest";
import { buildQueries, findMatch, matchConfidence } from "../../supabase/functions/_shared/visibility";
import {
  cooldownLeftHours,
  rankLabel,
  reviewGap,
  summarizeAi,
  summarizeSearch,
  topRivals,
  type ScanResults,
  type SearchChannel,
} from "./visibility";

const target = { names: ["Creative Builders Inc."], phone: "(408) 555-0142", website: "https://www.creativebuilders.com/" };

describe("matching a business", () => {
  it("treats a phone or website match as strong", () => {
    expect(matchConfidence(target, { name: "Something else", phone: "+1 408-555-0142" })).toBe("strong");
    expect(matchConfidence(target, { name: "x", website: "creativebuilders.com/about" })).toBe("strong");
  });
  it("ignores legal suffixes and punctuation", () => {
    expect(matchConfidence(target, { name: "Creative Builders" })).toBe("strong");
    expect(matchConfidence(target, { name: "CREATIVE BUILDERS, LLC" })).toBe("strong");
  });
  it("flags close multi-word names as name-only", () => {
    expect(matchConfidence({ names: ["Bay Area Custom Builders"] }, { name: "Bay Area Custom Builders SF" })).toBe("name");
  });
  it("does not match different businesses that share a word", () => {
    expect(matchConfidence(target, { name: "Creative Kitchens" })).toBe("none");
    expect(matchConfidence({ names: ["Smith"] }, { name: "Smith & Sons Roofing" })).toBe("none");
  });
  it("prefers a strong match later in the list over a name-only match earlier", () => {
    const list = [{ name: "Bay Area Custom Builders SF" }, { name: "Bay Area Custom Builders", phone: "4085550142" }];
    const r = findMatch({ names: ["Bay Area Custom Builders"], phone: "408-555-0142" }, list);
    expect(r).toEqual({ index: 1, confidence: "strong" });
  });
  it("returns -1 when nothing matches", () => {
    expect(findMatch(target, [{ name: "Other Co" }])).toEqual({ index: -1, confidence: "none" });
  });
});

describe("buildQueries", () => {
  it("always includes the two general searches", () => {
    const q = buildQueries("San Jose", null);
    expect(q.map((x) => x.text)).toContain("general contractor in San Jose");
    expect(q.map((x) => x.text)).toContain("home remodel in San Jose");
  });
  it("picks a third search from the specialty", () => {
    expect(buildQueries("San Jose", "ADUs and additions")[2].key).toBe("adu");
    expect(buildQueries("San Jose", "second story additions")[2].key).toBe("addition");
    expect(buildQueries("San Jose", "kitchens")[2].key).toBe("kitchen_bath");
  });
});

const L = (name: string, reviews: number | null = null) => ({ name, rating: 4.8, reviews, url: null });
const per = (rank: number | null, top = [L("A", 100), L("B", 200), L("C", 300)], reviews = 40) => ({
  key: "gc",
  text: "general contractor in San Jose",
  rank,
  total: 20,
  confidence: rank ? ("strong" as const) : ("none" as const),
  listing: rank ? L("Me", reviews) : null,
  top,
});

describe("summaries", () => {
  it("labels rank and misses plainly", () => {
    expect(rankLabel({ rank: 4, total: 20 })).toBe("#4 of 20");
    expect(rankLabel({ rank: null, total: 20 })).toBe("Not in the top 20");
    expect(rankLabel({ rank: null, total: 0 })).toBe("No results");
  });
  it("finds the best rank and counts searches found", () => {
    const ch: SearchChannel = { status: "ok", perQuery: [per(7), per(null), per(3)] };
    expect(summarizeSearch(ch)).toEqual({ found: 2, searched: 3, best: 3 });
  });
  it("reports unavailable channels as null, never zero", () => {
    expect(summarizeSearch({ status: "unavailable", reason: "x" })).toBeNull();
    expect(summarizeAi({ status: "unavailable", reason: "x" })).toBeNull();
  });
  it("sums AI mentions across models", () => {
    const ai = summarizeAi({
      status: "ok",
      models: [
        { id: "a", label: "Gemini", perQuery: [{ key: "k", text: "t", runs: 4, mentioned: 1, named: [] }] },
        { id: "b", label: "ChatGPT", perQuery: [{ key: "k", text: "t", runs: 4, mentioned: 0, named: [] }] },
      ],
    });
    expect(ai?.mentioned).toBe(1);
    expect(ai?.runs).toBe(8);
  });
  it("ranks rivals by how often they appear across channels", () => {
    const results: ScanResults = {
      city: "San Jose",
      queries: [],
      google: { status: "ok", perQuery: [per(null, [L("Acme"), L("Zed")])] },
      yelp: { status: "ok", perQuery: [per(null, [L("ACME!")])] },
      ai: { status: "ok", models: [{ id: "a", label: "G", perQuery: [{ key: "k", text: "t", runs: 4, mentioned: 0, named: [{ name: "Zed", count: 3 }] }] }] },
    };
    expect(topRivals(results)).toEqual([
      { name: "Zed", appearances: 4 },
      { name: "Acme", appearances: 2 },
    ]);
  });
  it("only compares reviews when it has your listing and three others", () => {
    expect(reviewGap({ status: "ok", perQuery: [per(5, [L("A", 100), L("B", 200), L("C", 300)], 40)] })).toEqual({ yours: 40, typicalTop3: 200 });
    expect(reviewGap({ status: "ok", perQuery: [per(null)] })).toBeNull();
    expect(reviewGap({ status: "ok", perQuery: [per(5, [L("A", 100)], 40)] })).toBeNull();
  });
  it("counts cooldown hours down and rounds up", () => {
    const now = Date.parse("2026-10-08T12:00:00Z");
    expect(cooldownLeftHours(null, now)).toBe(0);
    expect(cooldownLeftHours("2026-10-08T06:30:00Z", now)).toBe(7);
    expect(cooldownLeftHours("2026-10-07T12:00:00Z", now)).toBe(0);
  });
});
