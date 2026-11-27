import { describe, expect, it } from "vitest";
import { busiestDecade, certificateEntries, houseMoments, houseStory, persona, storyLine, systemsOnRecord, type StoryPermit } from "./houseStory";

const p = (what: string, year: number | null, done = true, extra: Partial<StoryPermit> = {}): StoryPermit => ({ what, year, done, ...extra });

const lenora: StoryPermit[] = [
  p("Building Permit", 1960),
  p("Building Permit", 1985),
  p("Solar", 2015),
  p("ReRoof", 2016, false),
  p("EV Charger And Service", 2021, false),
  p("Seismic retrofit and foundation work", 2021),
  p("Addition And Alterations", 2024),
  p("Kitchen remodel", 2019, false, { void: true }),
];

describe("houseMoments", () => {
  it("celebrates only signed-off work, oldest first, and skips work that never happened", () => {
    expect(houseMoments(lenora).map((m) => m.line)).toEqual(["Solar went up in 2015", "Bolted down for earthquakes in 2021", "Grew in 2024"]);
  });

  it("says what's on file when nothing was signed off", () => {
    expect(houseMoments([p("ReRoof", 2016, false), p("EV Charger And Service", 2021, false)]).map((m) => m.line)).toEqual([
      "Roof permit pulled in 2016",
      "EV charger permit pulled in 2021",
    ]);
  });

  it("reads the permit's name before its description", () => {
    expect(houseMoments([p("Solar", 2015, true, { scope: "INSTALL 4.24 KW ROOF MOUNT PV SYSTEM." })])[0].line).toBe("Solar went up in 2015");
  });

  it("keeps the latest of each kind", () => {
    expect(houseMoments([p("Reroof", 1998), p("Re-roof 100%", 2016)])).toEqual([{ kind: "roof", line: "New roof in 2016", year: 2016, done: true }]);
  });

  it("reads the city's description when the name is generic", () => {
    expect(houseMoments([p("Building work", 2024, true, { scope: "CONVERT PORTION OF GARAGE TO HABITABLE SPACE" })])[0].line).toBe("Grew in 2024");
  });
});

describe("systemsOnRecord", () => {
  it("lists each system's latest work, newest first", () => {
    expect(systemsOnRecord([p("Service Change", 2015), p("Replace Furnace", 1996), p("Solar", 2015, false), p("Reroof", 2001)])).toEqual([
      { system: "Electrical panel", year: 2015, done: true },
      { system: "Solar", year: 2015, done: false },
      { system: "Roof", year: 2001, done: true },
      { system: "Heating and cooling", year: 1996, done: true },
    ]);
  });
});

describe("persona", () => {
  const now = new Date("2026-11-27");
  it("is playful and grounded in the record", () => {
    expect(persona([p("Solar", 2010)], now).name).toBe("The early adopter");
    expect(persona(lenora, now).name).toBe("The one that grew");
    expect(persona([p("Building Permit", 1960)], now).name).toBe("The quiet one");
  });
});

describe("houseStory", () => {
  it("counts only real work, and never claims a build year", () => {
    const s = houseStory(lenora, 2, new Date("2026-11-27"));
    expect(s).toMatchObject({ since: 1960, permits: 7, signedOff: 5, looseEnds: 2 });
    expect(s.decade).toEqual({ decade: 2020, count: 3 });
  });

  it("makes a share line people would post", () => {
    expect(storyLine("Lenora Ave", houseStory(lenora))).toBe(
      "Lenora Ave. On the city's books since 1960. 7 permits. Solar went up in 2015. Bolted down for earthquakes in 2021. Grew in 2024.",
    );
  });

  it("says nothing about a decade with one permit", () => {
    expect(busiestDecade([p("Solar", 2015)])).toBeNull();
  });
});

describe("certificateEntries", () => {
  const row = (what: string, year: number, state: string) =>
    ({ what, year, state, stateLabel: state, permit: null, contractor: null, signoffs: [], contractors: [], docs: [], detail: {} }) as never;
  it("lists the work oldest first, in plain status words, without cancelled permits", () => {
    expect(certificateEntries([row("Solar", 2015, "finaled"), row("Building Permit", 1960, "finaled"), row("Kitchen", 2019, "cancelled"), row("ReRoof", 2016, "expired")])).toEqual([
      { year: 1960, what: "Building Permit", status: "Signed off", done: true },
      { year: 2015, what: "Solar", status: "Signed off", done: true },
      { year: 2016, what: "ReRoof", status: "Expired, no final", done: false },
    ]);
  });
});
