import { describe, expect, it } from "vitest";
import { RESERVED_HANDLES, brandThemeVars, checkHandle, frontDoorHandle, frontDoorKey, frontDoorUrl, hexToHsl, parseSource, websiteButtonHtml } from "./frontDoor";

describe("front door links", () => {
  it("is his business name, and the texted link is bare", () => {
    expect(frontDoorKey("US Creative Builders")).toBe("us-creative-builders");
    expect(frontDoorUrl("us-creative-builders", "text", "https://haleo.pages.dev")).toBe("https://haleo.pages.dev/us-creative-builders");
    expect(frontDoorUrl("us-creative-builders", "google", "https://haleo.pages.dev")).toBe("https://haleo.pages.dev/us-creative-builders?src=google");
  });
  it("reads where a visitor came from", () => {
    expect(parseSource(null)).toBe("text");
    expect(parseSource("website")).toBe("website");
    expect(parseSource("<x>")).toBe("other");
  });
  it("prefers the name they chose, then their business name, then the old slug", () => {
    expect(frontDoorHandle({ chosen: "uscb", companyName: "US Creative Builders", slug: "bakhtiary-mehdi-1d0f" })).toBe("uscb");
    expect(frontDoorHandle({ companyName: "US Creative Builders", slug: "x" })).toBe("us-creative-builders");
    expect(frontDoorHandle({ companyName: "", slug: "bakhtiary-mehdi-1d0f" })).toBe("bakhtiary-mehdi-1d0f");
  });
  it("only accepts names that make a clean link and aren't ours", () => {
    expect(checkHandle("  USCB ")).toEqual({ ok: true, handle: "uscb" });
    expect(checkHandle("Matt's Builds!")).toEqual({ ok: true, handle: "matt-s-builds" });
    expect(checkHandle("ab").ok).toBe(false);
    expect(checkHandle("brief").ok).toBe(false);
    expect(checkHandle("Pro").ok).toBe(false);
  });
});

describe("brand theme", () => {
  it("turns US Creative Builders red into the accent", () => {
    expect(hexToHsl("#E31B23")).toEqual([358, 79, 50]);
    expect(brandThemeVars("#E31B23")).toMatchObject({ "--accent": "358 79% 48%", "--accent-foreground": "0 0% 100%" });
  });
  it("darkens a pale color so small text still reads", () => {
    expect(brandThemeVars("#FFE066")!["--accent"]).toMatch(/ 48%$/);
  });
  it("ignores anything that isn't a color", () => {
    expect(brandThemeVars("red")).toBeNull();
    expect(brandThemeVars(null)).toBeNull();
  });
});

describe("website button", () => {
  it("is plain HTML in their color, and escapes what goes in", () => {
    const html = websiteButtonHtml("https://haleo.pages.dev/c/x?src=website&a=1", "#E31B23");
    expect(html).toContain('href="https://haleo.pages.dev/c/x?src=website&amp;a=1"');
    expect(html).toContain("background:#E31B23");
    expect(websiteButtonHtml("u", "javascript:x")).toContain("background:#111827");
    expect(websiteButtonHtml("u", null, '"><script>')).not.toContain("<script>");
  });
});

describe("link names never shadow the app's own pages", () => {
  it("reserves every first path segment the router uses", async () => {
    const { readFileSync } = await import("node:fs");
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, "utf8");
    const firsts = [...app.matchAll(/path="\/([^/":]+)/g)].map((m) => m[1]).filter((s) => !s.startsWith("."));
    expect(firsts.length).toBeGreaterThan(10);
    for (const s of firsts) expect(RESERVED_HANDLES.has(s), `"${s}" must be reserved`).toBe(true);
  });
});
