// The contractor demo: /demo/:slug
//
// The contractor plays their own next lead, in the real product:
//   1. Pick how the lead reaches them: their text reply, or their website.
//   2. Tap the link or the button, as the lead would.
//   3. The real intake, with their real record answering each answer.
//   4. The real brief, then "Send", which flips to what lands on their phone.
// Everything is real except the last step: nothing is sent or saved to
// anyone's account. Pure logic lives here; the page is src/pages/Demo.tsx.
// See docs/contractor-demo.md.
import type { BriefSnapshot } from "@/lib/contractors";
import type { BuyBox } from "@/lib/dealRead";

export type DemoConfig = {
  slug: string;
  /** The name the homeowner sees: "US Creative Builders". */
  brand: string;
  /** What their clients call them ("Matt"), for both sides of the demo. */
  person: string | null;
  /** The name on San Jose permits, which is often the owner's, not the brand. */
  recordName: string;
  /** Their brand color, from their website. */
  brandColor?: string | null;
  /** Their CSLB license number, as they publish it. Checked live with the state. */
  licenseNumber?: string | null;
  /** Their website's address. */
  website?: string | null;
  /** Their website's own headline, so the preview reads like their site. */
  headline?: string | null;
  /** What they do, in their words, for the website preview. */
  services?: string[];
};

// Contractors Deepa is demoing to first. Any other contractor works through
// /demo?record=NAME&brand=BRAND&person=FIRST&color=%23HEX&license=N&site=HOST.
export const DEMOS: DemoConfig[] = [
  {
    slug: "us-creative-builders",
    brand: "US Creative Builders",
    // Clients know Mehdi Bakhtiary as Matt.
    person: "Matt",
    recordName: "BAKHTIARY, MEHDI",
    brandColor: "#E31B23",
    licenseNumber: "1025687",
    website: "uscbuilders.com",
    headline: "Make Your Dream Home A Reality",
    services: ["New Construction", "Home Addition & ADU", "Home Improvement"],
  },
];

const clean = (v: string | null | undefined, max = 60) => {
  const s = (v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "BAKHTIARY, MEHDI" → "Bakhtiary, Mehdi". */
export const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const CONFIG_KEY = "haleo:demo_config";

/** The demo for this URL: a known slug, one described in the query string, or the one in progress. */
export const resolveDemo = (slug: string | undefined, search: URLSearchParams): DemoConfig | null => {
  const known = slug ? DEMOS.find((d) => d.slug === slug.toLowerCase()) : undefined;
  if (known) return known;
  const recordName = clean(search.get("record"));
  if (recordName) {
    const brand = clean(search.get("brand")) ?? titleCase(recordName);
    const color = clean(search.get("color"), 7);
    const license = clean(search.get("license"), 10);
    const website = clean(search.get("site"), 60);
    const d: DemoConfig = {
      slug: slugify(brand),
      brand,
      person: clean(search.get("person"), 24),
      recordName,
      brandColor: color && /^#[0-9a-f]{6}$/i.test(color) ? color : null,
      licenseNumber: license && /^\d{5,8}$/.test(license) ? license : null,
      website: website ? website.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
    };
    try {
      sessionStorage.setItem(CONFIG_KEY, JSON.stringify(d));
    } catch {
      /* the query string still works */
    }
    return d;
  }
  // Later screens of a query-string demo (/demo/acme-builders/matt) keep it.
  try {
    const saved = JSON.parse(sessionStorage.getItem(CONFIG_KEY) ?? "null") as DemoConfig | null;
    if (saved && saved.slug === slug) return saved;
  } catch {
    /* fall through */
  }
  return null;
};

/** A link Deepa can send to any contractor. */
export const demoUrl = (d: DemoConfig, origin: string): string => {
  if (DEMOS.some((k) => k.slug === d.slug)) return `${origin}/demo/${d.slug}`;
  const q = new URLSearchParams({
    record: d.recordName,
    brand: d.brand,
    ...(d.person ? { person: d.person } : {}),
    ...(d.brandColor ? { color: d.brandColor } : {}),
    ...(d.licenseNumber ? { license: d.licenseNumber } : {}),
    ...(d.website ? { site: d.website } : {}),
  });
  return `${origin}/demo?${q.toString()}`;
};

// ───── The text door ─────

/** The homeowner the contractor plays in the demo: one name, the whole way through. */
export const DEMO_LEAD = {
  name: "Priya",
  where: "Willow Glen, San Jose",
  project: "A kitchen that's too dark and too cramped",
} as const;

/** The first text a lead sends. Ordinary on purpose: this is how most jobs start. */
export const leadText = (person?: string | null) =>
  `Hi${person ? ` ${person}` : ""}! This is ${DEMO_LEAD.name}. A neighbor gave me your number. We're thinking about redoing our kitchen. Could you come take a look?`;

// ───── After "Send": what lands on the contractor's phone ─────

/** What this contractor takes on, so visit prep can make the drive-or-not call. */
export const DEMO_BUY_BOX: BuyBox = { project_types: ["kitchen", "bathroom", "addition", "whole-home"], min_budget_k: 25 };

type SavedBrief = { snapshot: BriefSnapshot & { projectType?: string }; note: string | null; at: number };
const briefKey = (slug: string) => `haleo:demo_brief:${slug}`;

/** The brief the contractor just built as their lead. Kept in this tab only. */
export const saveDemoBrief = (slug: string, snapshot: SavedBrief["snapshot"], note: string | null) => {
  try {
    sessionStorage.setItem(briefKey(slug), JSON.stringify({ snapshot, note, at: Date.now() } satisfies SavedBrief));
  } catch {
    /* private mode: the inbox screen says there's nothing to show */
  }
};

export const loadDemoBrief = (slug: string): SavedBrief | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(briefKey(slug)) ?? "null") as SavedBrief | null;
    return v && v.snapshot && typeof v.snapshot === "object" ? v : null;
  } catch {
    return null;
  }
};
