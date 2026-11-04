// A contractor's front door: one permanent link (/c/:slug) for their website,
// Google Business Profile and text replies, in their colors. Pure helpers;
// see docs/contractor-front-door.md.

export type FrontDoorSource = "website" | "google" | "text";

export const FRONT_DOOR_SOURCES: { id: FrontDoorSource; label: string; where: string }[] = [
  { id: "website", label: "Your website", where: "Your “Contact us” or “Get a quote” button" },
  { id: "google", label: "Google", where: "Your Google Business Profile booking or website link" },
  { id: "text", label: "Texts and email", where: "Your reply to new inquiries, and your email signature" },
];

export const frontDoorPath = (slug: string) => `/c/${slug}`;

export const frontDoorUrl = (slug: string, source: FrontDoorSource, origin: string) =>
  `${origin}${frontDoorPath(slug)}?src=${source}`;

export const parseSource = (raw: string | null): FrontDoorSource | "other" =>
  raw === "website" || raw === "google" || raw === "text" ? raw : "other";

// ───── Brand color → theme ─────

const HEX = /^#([0-9a-f]{6})$/i;

export const isBrandColor = (v: unknown): v is string => typeof v === "string" && HEX.test(v.trim());

export const hexToHsl = (hex: string): [number, number, number] => {
  const m = HEX.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
};

/**
 * The CSS variables that put a contractor's color on Haleo's pages. The
 * accent is used for buttons and for small text on white, so very light
 * colors are darkened until they read. Null for no (or a bad) color.
 */
export const brandThemeVars = (hex: string | null | undefined): Record<string, string> | null => {
  if (!isBrandColor(hex)) return null;
  const [h, s, rawL] = hexToHsl(hex);
  const l = Math.min(rawL, 48);
  const sat = Math.max(s, 20);
  return {
    "--accent": `${h} ${s}% ${l}%`,
    "--accent-foreground": "0 0% 100%",
    "--accent-soft": `${h} ${Math.min(sat, 90)}% 96%`,
    "--accent-soft-foreground": `${h} ${Math.min(sat, 70)}% ${Math.min(l, 32)}%`,
    "--ring": `${h} ${s}% ${l}%`,
    // Their main buttons are their color, like on their own site.
    "--primary": `${h} ${s}% ${l}%`,
    "--primary-foreground": "0 0% 100%",
  };
};

// ───── A button for their website ─────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Paste-anywhere HTML for a "Start your project" button in their color. */
export const websiteButtonHtml = (url: string, color: string | null | undefined, label = "Start your project"): string => {
  const bg = isBrandColor(color) ? color.trim() : "#111827";
  return `<a href="${esc(url)}" target="_blank" rel="noopener" style="display:inline-block;background:${bg};color:#ffffff;padding:14px 26px;border-radius:999px;font-weight:600;font-size:16px;text-decoration:none;font-family:inherit">${esc(label)} &rarr;</a>`;
};
