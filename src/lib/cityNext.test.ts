import { describe, expect, it } from "vitest";
import { cityKey, isSanJose, leaderboard, parseCity, stateForZip, tidyCity, voteLink, type TallyRow } from "./cityNext";

describe("city names", () => {
  it("tidies however it's typed", () => {
    expect(tidyCity("  palo   alto ")).toBe("Palo Alto");
    expect(tidyCity("winston-salem")).toBe("Winston-Salem");
  });

  it("gives one key per city", () => {
    expect(cityKey("Palo Alto", "CA")).toBe(cityKey(" palo  alto", "ca"));
    expect(cityKey("Saint Louis", "MO")).toBe(cityKey("St. Louis", "MO"));
    expect(cityKey("San José", "CA")).toBe("san jose|CA");
  });

  it("reads 'City, ST'", () => {
    expect(parseCity("austin, tx")).toEqual({ city: "Austin", state: "TX" });
    expect(parseCity("Sunnyvale")).toEqual({ city: "Sunnyvale" });
  });

  it("knows San José when it sees it", () => {
    expect(isSanJose("san jose", "CA")).toBe(true);
    expect(isSanJose("San José")).toBe(true);
    expect(isSanJose("San Jose", "TX")).toBe(false);
  });
});

describe("stateForZip", () => {
  it("prefills the state from a ZIP", () => {
    expect(stateForZip("94301")).toBe("CA");
    expect(stateForZip("78701")).toBe("TX");
    expect(stateForZip("10001")).toBe("NY");
    expect(stateForZip("abc")).toBeNull();
  });
});

describe("leaderboard", () => {
  const row = (city: string, votes: number): TallyRow => ({ city, state: "CA", city_key: cityKey(city, "CA"), votes, total_votes: 0, total_cities: 0 });
  const rows = ["Palo Alto", "Sunnyvale", "Oakland", "Fremont"].map((c, i) => row(c, 10 - i));

  it("keeps your city on the board even outside the top", () => {
    const b = leaderboard(rows, cityKey("Fremont", "CA"), 2);
    expect(b.rows.map((r) => r.city)).toEqual(["Palo Alto", "Sunnyvale", "Fremont"]);
    expect(b.rows[2]).toMatchObject({ rank: 4, mine: true });
    expect(b.max).toBe(10);
  });
});

describe("voteLink", () => {
  it("opens with the city filled in", () => {
    expect(voteLink("https://haleo.studio/", "Palo Alto", "CA")).toBe("https://haleo.studio/next?city=Palo+Alto&state=CA&ref=vote");
  });
});
