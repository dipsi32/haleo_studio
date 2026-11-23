import { describe, expect, it } from "vitest";
import { cardFileName, cardLink, cardLinkLabel, houseCard, streetOnly } from "./houseCard";
import { houseReport } from "./houseReport";
import type { ParcelHistory, ParcelPermit, RiskSignal, StreetPermit } from "./homeData";

const now = new Date("2026-11-23T12:00:00Z");
const signal = (s: Partial<RiskSignal> = {}): RiskSignal => ({
  address_key: "k",
  fire_hazard_class: null,
  fire_hazard_zone: null,
  flood_zone: "X",
  flood_zone_description: null,
  in_special_flood_hazard_area: false,
  seismic_hazard_zone: null,
  seismic_hazard_type: null,
  lookup_succeeded: true,
  last_checked_at: "2026-11-23T10:00:00Z",
  raw_response: { geocodeLevel: "address", checked: { fire: true, flood: true, seismic: true } },
  ...s,
});
const permit = (p: Partial<ParcelPermit>): ParcelPermit => ({
  permit_number: "2021-033792-RS",
  type: null,
  subtype: null,
  description: "Water heater",
  contractor: null,
  valuation: null,
  issued_date: "2021-06-01",
  final_date: null,
  status: "Expired",
  is_open: false,
  is_expired_without_final: true,
  source: "expired",
  ...p,
});
const sp = (o: Partial<StreetPermit>): StreetPermit => ({
  block: 2800,
  type: null,
  subtype: null,
  description: "Reroof",
  contractor: "ACME ROOFING INC",
  valuation: null,
  issued_date: "2026-08-01",
  final_date: null,
  source: "active",
  is_expired_without_final: false,
  ...o,
});
const parcel = (permits: ParcelPermit[], street: StreetPermit[] = []): ParcelHistory => ({
  address_key: "k",
  apn: null,
  permits,
  contractors: [],
  permit_count: permits.length,
  open_permit_count: 0,
  expired_without_final_count: 0,
  most_recent_permit_date: null,
  oldest_permit_date: null,
  lookup_succeeded: true,
  last_checked_at: "2026-11-23T10:00:00Z",
  raw_response: { feeds: 3, street_name: "lexford ave", street },
});
const card = (signalIn: RiskSignal | null, p: ParcelHistory, hideNumber = false) =>
  houseCard(houseReport({ street: "2844 lexford ave", zip: "95124", signal: signalIn, parcel: p, reader: "owner", now }), {
    street: "2844 lexford ave",
    zip: "95124",
    hideNumber,
    now,
  });

describe("houseCard", () => {
  it("leads with what matters most: an unfinished permit", () => {
    const c = card(signal(), parcel([permit({}), permit({ permit_number: "x" })]));
    expect(c.place).toBe("2844 Lexford Ave");
    expect(c.city).toBe("San José 95124");
    expect(c.verdict).toEqual(["2 things to", "close out."]);
    expect(c.house).toEqual({ value: "2 unfinished", detail: "Never got a final", tone: "act" });
    expect(c.highlight).toEqual({ text: expect.stringContaining("Get them finaled before your next project or a sale"), tone: "act" });
    expect(c.ground.map((g) => `${g.label}:${g.status}`)).toEqual(["Fire:clear", "Flood:clear", "Quake:clear"]);
    expect(c.rows.map((r) => r.label)).toEqual(["Permits", "Ground", "Latest work"]);
    expect(c.checkedOn).toBe("Nov 23, 2026");
  });

  it("a hazard zone comes next, in one plain sentence", () => {
    const c = card(signal({ seismic_hazard_type: "Liquefaction" }), parcel([]));
    expect(c.highlight?.text).toMatch(/^Liquefaction zone\. The ground can behave like liquid in a strong quake\.$/);
  });

  it("a quiet house shows its street, and the line under it says something new", () => {
    const c = card(signal(), parcel([], [sp({}), sp({ description: "PV solar" }), sp({ issued_date: "2024-01-01" })]));
    expect(c.house).toMatchObject({ value: "None open", detail: "Nothing unfinished", tone: "clear" });
    expect(c.around).toEqual({ label: "Lexford Ave", value: "3 permits", detail: "Mostly roof" });
    expect(c.highlight?.text).toBe("Acme Roofing Inc has 3 permits on Lexford Ave: the crew your neighbors hire.");
  });

  it("an unrated flood map is explained, never left as a bare question mark", () => {
    const c = card(signal({ flood_zone: "D" }), parcel([], [sp({})]));
    expect(c.ground.find((g) => g.label === "Flood")?.status).toBe("unrated");
    expect(c.highlight?.text).toMatch(/^FEMA hasn't rated flood risk here/);
  });

  it("hides the house number for posting where neighbors can see", () => {
    const c = card(signal(), parcel([]), true);
    expect(c.place).toBe("Lexford Ave");
    expect(c.city).toBe("San José");
  });

  it("links back to the tool, never the address", () => {
    expect(cardLink("https://haleo.pages.dev/")).toBe("https://haleo.pages.dev/house?ref=card");
    expect(cardLinkLabel("https://haleo.pages.dev")).toBe("haleo.pages.dev/house");
    expect(cardFileName("2844 Lexford Ave")).toBe("haleo-2844-lexford-ave.png");
    expect(streetOnly("12b N 1st st")).toBe("N 1st St");
  });
});
