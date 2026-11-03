import { describe, expect, it } from "vitest";
import { brandThemeVars, frontDoorUrl, hexToHsl, parseSource, websiteButtonHtml } from "./frontDoor";

describe("front door links", () => {
  it("tags each place it's posted", () => {
    expect(frontDoorUrl("bakhtiary-mehdi-1d0f", "google", "https://haleo.pages.dev")).toBe("https://haleo.pages.dev/c/bakhtiary-mehdi-1d0f?src=google");
    expect(parseSource("website")).toBe("website");
    expect(parseSource("<x>")).toBe("other");
    expect(parseSource(null)).toBe("other");
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
