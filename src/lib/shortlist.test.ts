import { describe, expect, it } from "vitest";
import type { Contractor, LicenseStatus } from "@/lib/contractors";
import {
  bidRequestMessage,
  cleanLicense,
  type CheckedCandidate,
  fitLine,
  fromAsk,
  fromExtraction,
  isLicenseOnlyName,
  isRealLicense,
  licensePeople,
  licenseState,
  manualCandidate,
  neighborCount,
  neighborRead,
  mergeCandidates,
  normalizeName,
  phoneDigits,
  personSearches,
  pickPermitMatch,
  rankShortlist,
  redFlag,
  sharedBy,
  smsHref,
  tidyBusinessName,
} from "./shortlist";

const contractor = (over: Partial<Contractor>): Contractor => ({
  id: over.id ?? "x",
  license_number: "SJ-X",
  name: "x",
  company: null,
  specialty: null,
  phone: null,
  email: null,
  website: null,
  city: null,
  state: null,
  zip: null,
  lat: null,
  lng: null,
  permit_count: 0,
  last_permit_date: null,
  ...over,
});

const license = (over: Partial<LicenseStatus>): LicenseStatus => ({
  license_number: "123456",
  status: "Active",
  business_name: null,
  classifications: null,
  issue_date: null,
  expiration_date: "2099-01-01",
  has_disciplinary_action: false,
  disciplinary_notes: null,
  workers_comp_status: null,
  bond_status: null,
  scrape_succeeded: true,
  last_checked_at: "",
  deep_link: "",
  ...over,
});

const checked = (over: Partial<CheckedCandidate> & { name?: string }): CheckedCandidate => ({
  candidate: manualCandidate({ name: over.name ?? "Acme" }),
  status: "done",
  contractor: null,
  permits: [],
  license: null,
  score: null,
  likeYours: 0,
  ...over,
});

describe("cleaning", () => {
  it("normalizes business names", () => {
    expect(normalizeName("K&E Kitchen & Bath, Inc.")).toBe("k and e kitchen and bath");
    expect(normalizeName("Mike's Plumbing LLC")).toBe("mikes plumbing");
  });

  it("reads US phone numbers and CSLB numbers", () => {
    expect(phoneDigits("+1 (408) 555-0199")).toBe("4085550199");
    expect(phoneDigits("555-0199")).toBeNull();
    expect(cleanLicense("Lic #1023456")).toBe("1023456");
    expect(cleanLicense("12")).toBeNull();
    expect(isRealLicense("SJ-ACME-BUILDERS")).toBe(false);
    expect(isRealLicense("1023456")).toBe(true);
  });

  it("keeps only usable extractor entries and caps quotes", () => {
    const out = fromExtraction(
      [
        { name: "  Acme Builders ", mention_count: 3, quotes: [{ text: "great", sentiment: "positive" }, { text: "", sentiment: "positive" }], license_number: "Lic 998877" },
        { name: "", mention_count: 1, quotes: [] },
        { nope: true },
      ],
      "pasted",
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Acme Builders");
    expect(out[0].quotes).toHaveLength(1);
    expect(out[0].license_number).toBe("998877");
    expect(fromExtraction("garbage", "pasted")).toEqual([]);
  });

  it("merges the same contractor seen twice, by name, phone or license", () => {
    const a = fromExtraction([{ name: "Acme Builders Inc", mention_count: 2, quotes: [{ text: "on time", sentiment: "positive" }] }], "pasted");
    const b = fromExtraction([{ name: "ACME BUILDERS", mention_count: 1, phone: "408-555-0199", quotes: [{ text: "on time", sentiment: "positive" }, { text: "pricey", sentiment: "mixed" }] }], "screenshot");
    const c = fromExtraction([{ name: "Mike", phone: "(408) 555 0199", mention_count: 1, quotes: [] }], "screenshot");
    const merged = mergeCandidates([...a, ...b, ...c]);
    expect(merged).toHaveLength(1);
    expect(merged[0].mention_count).toBe(4);
    expect(merged[0].phone).toBe("408-555-0199");
    expect(merged[0].quotes.map((q) => q.text)).toEqual(["on time", "pricey"]);
  });
});

describe("pickPermitMatch", () => {
  const rows = [
    contractor({ id: "1", company: "ACME BUILDERS INC", name: "JOHN DOE", permit_count: 4 }),
    contractor({ id: "2", company: "ACME BUILDERS & DESIGN", permit_count: 40 }),
    contractor({ id: "3", company: "PACIFIC ROOFING", permit_count: 9 }),
  ];

  it("prefers an exact name over a bigger near match", () => {
    expect(pickPermitMatch("Acme Builders", rows)?.id).toBe("1");
  });

  it("refuses weak overlaps rather than guess", () => {
    expect(pickPermitMatch("Acme Plumbing", rows)).toBeNull();
    expect(pickPermitMatch("Roofing", rows)).toBeNull();
    expect(pickPermitMatch("Acme", [])).toBeNull();
  });
});

describe("licenseState", () => {
  const now = new Date("2026-10-29");
  it("reads active, expiring, expired and suspended", () => {
    expect(licenseState(license({}), now)).toBe("active");
    expect(licenseState(license({ expiration_date: "2026-12-01" }), now)).toBe("expiring");
    expect(licenseState(license({ expiration_date: "2026-01-01" }), now)).toBe("expired");
    expect(licenseState(license({ status: "Suspended" }), now)).toBe("suspended");
  });
  it("never calls an unread license active", () => {
    expect(licenseState(null, now)).toBe("not_checked");
    expect(licenseState(license({ scrape_succeeded: false }), now)).toBe("not_checked");
    expect(licenseState(license({ status: "Pending review" }), now)).toBe("not_checked");
  });
});

describe("ranking", () => {
  it("puts flags last, then verified license, then work like yours", () => {
    const flagged = checked({ name: "Flagged", license: license({ status: "Suspended" }), likeYours: 9 });
    const verified = checked({ name: "Verified", license: license({}), likeYours: 1 });
    const unverifiedBusy = checked({ name: "Busy", likeYours: 7 });
    const out = rankShortlist([flagged, unverifiedBusy, verified]).map((c) => c.candidate.name);
    expect(out).toEqual(["Verified", "Busy", "Flagged"]);
  });

  it("flags negative neighbor comments without touching the record score", () => {
    const c = checked({});
    c.candidate.quotes = [{ text: "never finished", sentiment: "negative" }];
    expect(redFlag(c)).toMatch(/negative/);
  });

  it("never counts a contractor's own post as a neighbor's word", () => {
    const [ad] = fromExtraction(
      [{ name: "Ace Remodel", mention_count: 1, self_promoted: true, neighbor_count: 0, quotes: [{ text: "We do kitchens, DM me!", sentiment: "positive", speaker: "self" }] }],
      "screenshot",
    );
    expect(sharedBy(ad)).toBe("Posted their own details in the thread");
    expect(neighborRead(ad).positive).toBe(0);
    expect(neighborCount(ad)).toBe(0);
    const [both] = fromExtraction(
      [{ name: "Oak & Stone", mention_count: 3, neighbor_count: 2, quotes: [{ text: "great crew", sentiment: "positive", speaker: "neighbor" }, { text: "Happy to help, call us", sentiment: "positive", speaker: "self" }] }],
      "screenshot",
    );
    expect(sharedBy(both)).toBe("Named by 2 neighbors · also posted their own details");
    expect(sharedBy(manualCandidate({ name: "Typed" }))).toBeNull();
    // A self-posted ad doesn't outrank a neighbor's recommendation.
    const a = checked({ name: "Ad" });
    a.candidate = ad;
    const b = checked({ name: "Named" });
    b.candidate = { ...both, self_promoted: false };
    expect(rankShortlist([a, b]).map((x) => x.candidate.name)).toEqual(["Oak & Stone", "Ace Remodel"]);
  });

  it("reads the homeowner's own question from the thread", () => {
    expect(fromAsk({ text: "Anyone redo a kitchen recently?", project: "kitchen", zip: "95125", neighborhood: "Willow Glen" })).toEqual({
      text: "Anyone redo a kitchen recently?",
      project: "kitchen",
      zip: "95125",
      neighborhood: "Willow Glen",
    });
    expect(fromAsk({ text: null, project: "patio", zip: "9512" })).toBeNull();
    expect(fromAsk(null)).toBeNull();
  });

  it("explains the position in plain facts", () => {
    const c = checked({ license: license({}), likeYours: 2, permits: [] });
    c.candidate.quotes = [{ text: "great", sentiment: "positive", speaker: "neighbor" }];
    c.candidate.source = "pasted";
    expect(fitLine(c, "kitchen")).toBe("License active · 2 kitchen permits in San Jose · named by 1 neighbor");
    expect(fitLine(checked({}), "kitchen")).toMatch(/Ask for their license number/);
  });
});

describe("bid request", () => {
  it("asks for an itemized bid and license number, with the project explained once", () => {
    const msg = bidRequestMessage({
      contractorName: "Acme Builders",
      personName: "John Doe",
      homeownerName: "Deepa",
      projectLabel: "kitchen remodel",
      snapshot: {
        neighborhood: "Willow Glen",
        scope_summary: "Full kitchen, keep the layout",
        vision: "",
        frustrations: [],
        rooms: ["Kitchen"],
        scope_label: "Remodel",
        budget: "$60K – $90K",
        timeline: "1–3 months",
        rendering_urls: [],
        room_photo_urls: [],
        floorplan_urls: [],
        trade_groups: [{ trade: "Plumbing", lines: ["Move sink to island"] }],
      },
    });
    expect(msg).toMatch(/^Hi John,/);
    expect(msg).toMatch(/kitchen remodel in Willow Glen/);
    expect(msg).toMatch(/- Move sink to island/);
    expect(msg).toMatch(/CSLB license number/);
    expect(msg).toMatch(/Deepa$/);
  });

  it("works without a brief", () => {
    const msg = bidRequestMessage({ contractorName: "Acme", projectLabel: "remodel" });
    expect(msg).toMatch(/^Hi Acme,/);
    expect(msg).not.toMatch(/The project:/);
  });

  it("builds a text link only for a real phone number", () => {
    expect(smsHref("408 555 0199", "hi there")).toBe("sms:+14085550199?&body=hi%20there");
    expect(smsHref("call me", "hi")).toBeNull();
  });
});

describe("name orders", () => {
  it("tries a person's name both ways, a business name as written", async () => {
    const { nameOrders } = await import("@/lib/shortlist");
    expect(nameOrders("Mehdi Bakhtiary")).toEqual(["mehdi bakhtiary", "bakhtiary mehdi"]);
    expect(nameOrders("Pacific Remodeling Inc")).toEqual(["pacific remodeling"]);
  });
});

describe("who holds the license", () => {
  const page =
    "| Bond of Qualifying Individual | The qualifying individual MEHDI BAKHTIARY KHANEGHAH certified that he/she owns 10 percent or more | ## Miscellaneous Information | - 02/02/2026 - LICENSE REISSUED TO ANOTHER ENTITY |";
  it("reads the qualifying individual off the license page", () => {
    expect(licensePeople(page)).toEqual(["MEHDI BAKHTIARY KHANEGHAH"]);
    expect(licensePeople("This license is current and active.")).toEqual([]);
    expect(licensePeople(null)).toEqual([]);
  });
  it("searches a full name as first name plus each family name", () => {
    expect(personSearches("MEHDI BAKHTIARY KHANEGHAH")).toEqual(["mehdi bakhtiary", "mehdi khaneghah"]);
    expect(personSearches("Prince")).toEqual([]);
  });
  it("finds the person's permit record under the flipped name", () => {
    const row = { id: "m", company: "BAKHTIARY, MEHDI", name: "BAKHTIARY, MEHDI", permit_count: 6 } as Contractor;
    expect(pickPermitMatch(personSearches("MEHDI BAKHTIARY KHANEGHAH")[0], [row])?.id).toBe("m");
  });
  it("tidies a business name without shouting", () => {
    expect(tidyBusinessName("US CREATIVE BUILDER CORPORATION")).toBe("US Creative Builder Corporation");
    expect(tidyBusinessName("BAY BUILDERS & REMODELING")).toBe("Bay Builders & Remodeling");
    expect(isLicenseOnlyName("License #1025687")).toBe(true);
    expect(isLicenseOnlyName("Acme")).toBe(false);
  });
});
