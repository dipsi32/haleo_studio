// The contractor demo: /demo/:slug
//
// A contractor sees their own business, not a sample one. Step 1 is their
// real public record. Steps 2 and 3 use a made-up client, said plainly on the
// page, so nothing is sent, saved or signed up for. Pure logic lives here;
// the page is src/pages/Demo.tsx. See docs/contractor-demo.md.
import type { IntakeData, Room } from "@/lib/intake";
import type { DealSnapshot, BuyBox } from "@/lib/dealRead";
import type { Finding } from "@/lib/spaceFindings";

export type DemoConfig = {
  slug: string;
  /** The name the homeowner sees: "US Creative Builders". */
  brand: string;
  /** First name for the greeting, when we know it. */
  person: string | null;
  /** The name on San Jose permits, which is often the owner's, not the brand. */
  recordName: string;
  /** Their brand color, from their website, so the demo looks like them. */
  brandColor?: string | null;
  /** Their CSLB license number, as they publish it. Checked live with the state. */
  licenseNumber?: string | null;
  /** Their website's address, for the "your site, one new button" screen. */
  website?: string | null;
};

// Contractors Deepa is demoing to first. Any other contractor works through
// /demo?record=NAME&brand=BRAND&person=FIRST without a code change.
export const DEMOS: DemoConfig[] = [
  {
    slug: "us-creative-builders",
    brand: "US Creative Builders",
    person: "Mehdi",
    recordName: "BAKHTIARY, MEHDI",
    brandColor: "#E31B23",
    licenseNumber: "1025687",
    website: "uscbuilders.com",
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

/** The demo for this URL: a known slug, or one described in the query string. */
export const resolveDemo = (slug: string | undefined, search: URLSearchParams): DemoConfig | null => {
  const known = slug ? DEMOS.find((d) => d.slug === slug.toLowerCase()) : undefined;
  if (known) return known;
  const recordName = clean(search.get("record"));
  if (!recordName) return null;
  const brand = clean(search.get("brand")) ?? titleCase(recordName);
  const color = clean(search.get("color"), 7);
  const license = clean(search.get("license"), 10);
  const website = clean(search.get("site"), 60);
  return {
    slug: slugify(brand),
    brand,
    person: clean(search.get("person"), 24),
    recordName,
    brandColor: color && /^#[0-9a-f]{6}$/i.test(color) ? color : null,
    licenseNumber: license && /^\d{5,8}$/.test(license) ? license : null,
    website: website ? website.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
  };
};

/** "BAKHTIARY, MEHDI" → "Bakhtiary, Mehdi". */
export const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

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

// ───── Step 2: the client's side ─────

export type DemoProject = "kitchen" | "bathroom" | "addition" | "full-home";

export const DEMO_PROJECTS: { id: DemoProject; label: string }[] = [
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "addition", label: "Addition or ADU" },
  { id: "full-home", label: "Whole home" },
];

export type DemoAnswers = { project: DemoProject | null; zip: string; visitTimes: string[] };

/** The answers as the brief flow would hold them, so the real record logic runs on them. */
export const demoIntake = (a: DemoAnswers): IntakeData => {
  const room = (a.project ?? undefined) as Room | undefined;
  return {
    room,
    rooms: room ? [room] : [],
    goals: [],
    painPoints: [],
    media: [],
    notes: "",
    address: /^\d{5}$/.test(a.zip) ? { city: "San Jose", state: "CA", zip: a.zip } : undefined,
    scope: a.project === "addition" ? "structural" : undefined,
  } as IntakeData;
};

/** The ZIP codes this contractor works in most, for one-tap answers. */
export const topZips = (permits: { zip?: string | null }[], n = 3): string[] => {
  const counts = new Map<string, number>();
  for (const p of permits) {
    const z = (p.zip ?? "").slice(0, 5);
    if (/^\d{5}$/.test(z)) counts.set(z, (counts.get(z) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([z]) => z);
};

// ───── Step 1: a few facts straight from the record ─────

const titleWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Plain facts read from the permits, for the record screen. Counts and names
 * only: no valuations (they understate real job size) and nothing inferred.
 */
export const recordFacts = (permits: { zip?: string | null; status?: string | null; description?: string | null }[]) => {
  const zips = topZips(permits, 6);
  const active = permits.filter((p) => /^active$/i.test(p.status ?? "")).length;
  const kinds: string[] = [];
  for (const p of permits) {
    const d = p.description ?? "";
    const job = d.includes(" · ") ? d.split(" · ")[0] : d.split("—").pop() ?? "";
    const k = job.trim().replace(/\//g, " and ").toLowerCase();
    if (!k || /sub-trades|^n\/?a$/.test(k)) continue;
    if (!kinds.includes(k)) kinds.push(k);
  }
  return { zips, active, kinds: kinds.slice(0, 3).map(titleWord) };
};

// ───── Step 3: what lands on the contractor's phone ─────

const SAMPLE: Record<DemoProject, { label: string; budget: string; scope: string; vision: string; frustrations: string[]; findings: Finding[] }> = {
  kitchen: {
    label: "Kitchen",
    budget: "$60K – $90K",
    scope: "Open the kitchen to the family room, new cabinets and counters, move the range to the island.",
    vision: "Bright, easy to cook in with the kids around. Warm wood, white counters.",
    frustrations: ["Too dark", "Not enough counter space"],
    findings: [
      { title: "Soffit above the upper cabinets", detail: "Runs the length of the wall the family wants to open.", why: "Often hides ductwork or a vent run.", next_step: "Check what's inside before pricing the wall removal.", kind: "attention", audience: "contractor", basis: "inferred", photo_url: null },
      { title: "Stain on the sink-base floor", detail: "Dark ring left of the trap.", why: "Could be an old drip or an active leak.", next_step: "Feel the subfloor and check the shutoffs.", kind: "attention", audience: "both", basis: "grounded", photo_url: null },
      { title: "Range on an outside wall", detail: "Moving it to the island means a new gas or 240V run.", why: "Panel capacity and the route decide the cost.", next_step: "Open the panel and note the main breaker size.", kind: "check", audience: "contractor", basis: "question", photo_url: null },
    ],
  },
  bathroom: {
    label: "Bathroom",
    budget: "$30K – $45K",
    scope: "Replace the tub with a walk-in shower, new vanity and tile.",
    vision: "Calm, easy to clean, curbless shower if possible.",
    frustrations: ["Dated", "Hard to clean"],
    findings: [
      { title: "No exhaust fan visible", detail: "Window only.", why: "A new shower usually needs a vented fan.", next_step: "Check the attic route for a duct.", kind: "check", audience: "contractor", basis: "inferred", photo_url: null },
      { title: "Soft-looking grout at the tub edge", detail: "Darker grout along the floor line.", why: "Can mean water got under the tile.", next_step: "Press the floor by the tub and look for give.", kind: "attention", audience: "both", basis: "grounded", photo_url: null },
    ],
  },
  addition: {
    label: "Addition or ADU",
    budget: "$250K – $350K",
    scope: "A detached ADU in the backyard, about 750 sq ft, for a parent moving in.",
    vision: "One bedroom, step-free, its own small patio.",
    frustrations: ["Not enough space"],
    findings: [
      { title: "Mature tree near the likely footprint", detail: "Large oak about 20 ft from the back fence.", why: "Protected trees can shift where an ADU can go.", next_step: "Measure the trunk and check the city's tree rules.", kind: "check", audience: "contractor", basis: "inferred", photo_url: null },
      { title: "Side yard wide enough for access", detail: "Gate looks about 8 ft wide.", why: "Room for equipment keeps the build simpler.", next_step: "Confirm the width with a tape.", kind: "working", audience: "both", basis: "grounded", photo_url: null },
    ],
  },
  "full-home": {
    label: "Whole home",
    budget: "$200K – $300K",
    scope: "Update the whole house: kitchen, two baths, floors, and open up the living area.",
    vision: "A 1960s ranch that feels open and modern, done before school starts.",
    frustrations: ["Dated", "Feels closed in"],
    findings: [
      { title: "Original-looking electrical panel", detail: "Older style, in the garage.", why: "A whole-home update often needs a bigger service.", next_step: "Note the brand and amperage.", kind: "check", audience: "contractor", basis: "inferred", photo_url: null },
      { title: "Wood floors under the carpet edge", detail: "Visible at the hallway transition.", why: "Refinishing could save on new flooring.", next_step: "Lift a corner to check the condition.", kind: "working", audience: "both", basis: "grounded", photo_url: null },
    ],
  },
};

export const demoSample = (p: DemoProject) => SAMPLE[p];

/** What this contractor takes on, so the prep can make the drive-or-not call. */
export const DEMO_BUY_BOX: BuyBox = { project_types: ["kitchen", "bathroom", "addition", "whole-home"], min_budget_k: 25 };

export const DEMO_CLIENT = "Priya";

/** The brief Priya sends, built from the answers in step 2. Clearly a sample on the page. */
export const demoSnapshot = (a: DemoAnswers): DealSnapshot => {
  const project = a.project ?? "kitchen";
  const s = SAMPLE[project];
  const zip = /^\d{5}$/.test(a.zip) ? a.zip : "95125";
  return {
    homeowner_name: DEMO_CLIENT,
    neighborhood: `San Jose ${zip}`,
    scope_summary: s.scope,
    vision: s.vision,
    frustrations: s.frustrations,
    rooms: [s.label],
    projectType: s.label,
    scope_label: project === "addition" ? "New space" : "Remodel",
    timeline: "In the next 3 months",
    budget: s.budget,
    is_addition: project === "addition",
    addition_size_sqft: project === "addition" ? 750 : undefined,
    permit_status: project === "addition" ? "not-yet" : undefined,
    rendering_urls: [],
    room_photo_urls: ["sample-1", "sample-2", "sample-3"],
    floorplan_urls: [],
    trade_groups: [],
    parcel: {
      zoning: "R-1-8",
      lot_size_sqft: 6200,
      primary_dwelling_sqft: 1480,
      existing_footprints_sqft: 2050,
      permit_count: 3,
      open_permit_count: 0,
      expired_without_final_count: 1,
      oldest_permit_date: "1987-05-01",
      permits: [
        { permit_number: null, description: "Garage conversion to family room", type: null, valuation: null, issued_date: "2004-03-01", status: "Expired", is_open: false, is_expired_without_final: true },
      ],
    },
    context: {
      why_now: "improve",
      who_decides: "partner",
      funding: project === "addition" ? "heloc" : "cash",
      shopping: "few",
      visit_times: a.visitTimes,
    },
  };
};

/** Two or three easy visit times to tap, starting a few days out. */
export const demoVisitOptions = (from: Date = new Date()): string[] => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (offset: number) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return [`${day(2)}|evening`, `${day(4)}|morning`, `${day(5)}|afternoon`];
};
