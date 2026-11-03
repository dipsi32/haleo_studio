import { beforeEach, describe, expect, it } from "vitest";
import { demoUrl, loadDemoBrief, resolveDemo, saveDemoBrief } from "./demo";
import { contractorFromActive, demoSlugOf, demoToken, getActiveInvite, isDemoActive, isDemoToken, setActiveInvite } from "./invites";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("resolveDemo", () => {
  it("knows US Creative Builders, as clients know him", () => {
    expect(resolveDemo("us-creative-builders", new URLSearchParams())).toMatchObject({
      brand: "US Creative Builders",
      person: "Matt",
      recordName: "BAKHTIARY, MEHDI",
      brandColor: "#E31B23",
      licenseNumber: "1025687",
    });
  });
  it("builds one from the link for anyone else, and keeps it for later screens", () => {
    const d = resolveDemo(undefined, new URLSearchParams("record=ACME BUILDERS INC&person=Sam&color=%23112233&license=123456&site=https://acme.com/x"));
    expect(d).toMatchObject({ brand: "Acme Builders Inc", slug: "acme-builders-inc", person: "Sam", brandColor: "#112233", licenseNumber: "123456", website: "acme.com" });
    expect(resolveDemo("acme-builders-inc", new URLSearchParams())).toMatchObject({ brand: "Acme Builders Inc" });
    expect(demoUrl(d!, "https://haleo.pages.dev")).toContain("/demo?record=ACME+BUILDERS+INC");
  });
  it("drops anything malformed, and needs a name", () => {
    expect(resolveDemo(undefined, new URLSearchParams("record=X&color=red&license=abc"))).toMatchObject({ brandColor: null, licenseNumber: null });
    sessionStorage.clear();
    expect(resolveDemo("nobody", new URLSearchParams())).toBeNull();
  });
});

describe("demo links never reach the server", () => {
  it("marks the active link as a demo only for demo tokens", () => {
    const c = { id: "c1", slug: "s", name: "US Creative Builders", company: "US Creative Builders", city: "San Jose", personName: "Matt", brandColor: "#E31B23", licenseNumber: "1025687" };
    setActiveInvite(demoToken("us-creative-builders"), c);
    const a = getActiveInvite()!;
    expect(a.demo).toBe(true);
    expect(isDemoActive()).toBe(true);
    expect(demoSlugOf(a.token)).toBe("us-creative-builders");
    expect(contractorFromActive(a)).toMatchObject({ id: "c1", personName: "Matt", licenseNumber: "1025687", brandColor: "#E31B23" });
    setActiveInvite("abc123realtoken0", c);
    expect(getActiveInvite()!.demo).toBe(false);
    expect(isDemoToken("abc123realtoken0")).toBe(false);
  });
});

describe("the brief the contractor builds as their lead", () => {
  it("stays in this tab", () => {
    expect(loadDemoBrief("x")).toBeNull();
    saveDemoBrief("x", { neighborhood: "San Jose", scope_summary: "Kitchen", vision: "", frustrations: [], rooms: ["Kitchen"], rendering_urls: [], room_photo_urls: [], floorplan_urls: [], trade_groups: [] }, "Before school");
    expect(loadDemoBrief("x")).toMatchObject({ note: "Before school", snapshot: { scope_summary: "Kitchen" } });
  });
});
