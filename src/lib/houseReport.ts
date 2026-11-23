// "What's on file for your house?", read for the person holding it.
//
// The same public facts mean different things to someone who lives there,
// someone planning a project, and someone buying or selling. This turns the
// home's record (permits, sign-offs, hazard maps) into:
//   - a verdict that leads with the answer,
//   - three vitals (permits, ground, latest work),
//   - up to three next steps for this reader, each ready to act on,
//   - the facts behind it, each labelled with its source.
// Nothing here is a code rule, a price, or a judgement of a person: every
// line is a public-record fact, or our read of one, labelled as such.
// Pure; tested in houseReport.test.ts.
import { floodMinimal, type ParcelHistory, type RiskSignal, type StreetPermit } from "./homeData";
import { homeRecord, whatOf, type InspectionIn, type RecordRow, CITY_PERMIT_ARCHIVE, HAZARD_MAPS } from "./homeRecord";

export type Reader = "owner" | "project" | "deal";

export const READERS: { id: Reader; label: string; hint: string }[] = [
  { id: "owner", label: "I live here", hint: "What to keep an eye on" },
  { id: "project", label: "Planning a project", hint: "What changes your bids" },
  { id: "deal", label: "Buying or selling", hint: "What to raise before closing" },
];

export type Tone = "clear" | "watch" | "act";
export type Source = "Public record" | "Our read";

export type Vital = { id: "permits" | "ground" | "latest"; label: string; value: string; tone: Tone | "unknown" };

export type Step = {
  id: string;
  title: string;
  why: string;
  /** What the button does. */
  action:
    | { kind: "copy"; label: string; text: string }
    | { kind: "link"; label: string; href: string }
    | { kind: "project"; label: string }
    | { kind: "check"; label: string; name: string };
};

export type Finding = { text: string; source: Source };

/** One hazard map, read: what it says about this lot and what that means. */
export type GroundRow = {
  id: "fire" | "flood" | "seismic";
  map: string;
  status: "clear" | "zone" | "unrated" | "unchecked";
  title: string;
  meaning: string;
  source: string;
  href: string;
};

/** What's being permitted on their street: the house has a context even when it has no current permits. */
export type StreetSummary = {
  name: string;
  total: number;
  lastYear: number;
  kinds: { kind: string; count: number }[];
  crew: { name: string; raw: string; count: number }[];
  recent: { block: string | null; what: string; when: string | null; contractor: string | null; done: boolean; expired: boolean }[];
};

export type HouseReport = {
  tone: Tone;
  /** The stamp on the verdict: never says more than was checked. */
  badge: { word: string; tone: Tone | "unknown" };
  /** "Clean on paper." — the plain part, then the italic turn. */
  verdict: [string, string];
  sub: string;
  vitals: Vital[];
  steps: Step[];
  findings: Finding[];
  rows: RecordRow[];
  /** Plain text for a listing packet, a text to a spouse, a client email. */
  summary: string;
  /** Hazard checks that didn't run, so the page never calls them clear. */
  unchecked: string[];
  ground: GroundRow[];
  street: StreetSummary | null;
};

// What kind of work a permit is, in the words a homeowner uses. Our read of the city's description.
const KINDS: [string, RegExp][] = [
  ["Solar", /solar|photovolt|\bpv\b/i],
  ["Roof", /re-?roof|roof/i],
  ["Kitchen", /kitchen/i],
  ["Bathroom", /bath/i],
  ["ADU or addition", /\badu\b|accessory dwelling|addition|garage conv/i],
  ["EV charger or panel", /ev charg|electric vehicle|panel upgrade|service upgrade|main panel/i],
  ["Heating and cooling", /hvac|furnace|heat pump|a\/c|air cond|mechanical/i],
  ["Water heater", /water heater/i],
  ["Windows and doors", /window|door/i],
  ["Pool or spa", /pool|spa\b/i],
  ["Plumbing", /plumb|sewer|repipe/i],
  ["Electrical", /electric/i],
  ["Remodel", /remodel|alteration|tenant improvement|\bti\b/i],
];
export const workKind = (p: { description?: string | null; subtype?: string | null; type?: string | null }): string => {
  const hay = `${p.description ?? ""} ${p.subtype ?? ""} ${p.type ?? ""}`;
  return KINDS.find(([, re]) => re.test(hay))?.[0] ?? "Other work";
};

/** The street's most common named kinds of work, in a sentence ("roof and ADU or addition"). "Other work" never counts. */
export const topKinds = (kinds: { kind: string; count: number }[], n = 2): string | null => {
  const named = kinds.filter((k) => k.kind !== "Other work").slice(0, n).map((k) => k.kind.toLowerCase().replace(/\badu\b/g, "ADU").replace(/\bev\b/g, "EV"));
  return named.length ? list(named) : null;
};

const titleStreet = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

const readStreet = (permits: StreetPermit[] | undefined, name: string | null | undefined, now: Date): StreetSummary | null => {
  if (!Array.isArray(permits) || !name) return null;
  const yearAgo = now.getTime() - 365 * 864e5;
  const kinds = new Map<string, number>();
  const crew = new Map<string, number>();
  for (const p of permits) {
    const k = workKind(p);
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
    if (p.contractor) crew.set(p.contractor, (crew.get(p.contractor) ?? 0) + 1);
  }
  return {
    name: titleStreet(name),
    total: permits.length,
    lastYear: permits.filter((p) => p.issued_date && new Date(p.issued_date).getTime() >= yearAgo).length,
    // "Other work" always last: it's the least telling.
    kinds: [...kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => (a.kind === "Other work" ? 1 : 0) - (b.kind === "Other work" ? 1 : 0) || b.count - a.count),
    crew: [...crew.entries()].map(([raw, count]) => ({ raw, name: tidyName(raw), count })).sort((a, b) => b.count - a.count).slice(0, 5),
    recent: permits.slice(0, 6).map((p) => ({
      block: p.block ? `${p.block} block` : null,
      what: workKind(p) === "Other work" ? whatOf({ ...p, permit_number: null, status: null, is_open: false }) : workKind(p),
      when: monthYear(p.issued_date),
      contractor: p.contractor ? tidyName(p.contractor) : null,
      done: !!p.final_date,
      expired: p.is_expired_without_final,
    })),
  };
};

const FLOOD_WORDS: Record<string, string> = {
  X: "Minimal flood risk",
  B: "Moderate flood risk",
  C: "Minimal flood risk",
};

const readGroundRows = (s: RiskSignal | null): GroundRow[] => {
  const ran = s?.raw_response?.checked;
  const exact = !!s?.lookup_succeeded && s?.raw_response?.geocodeLevel !== "zip";
  const map = (id: GroundRow["id"]) => HAZARD_MAPS.find((m) => m.id === id)!.href;
  const unchecked = (id: GroundRow["id"], mapName: string, source: string): GroundRow => ({
    id,
    map: mapName,
    status: "unchecked",
    title: "Not checked",
    meaning: exact ? "The map didn't answer just now. Check it yourself on the official map." : "We couldn't place the exact lot, so we don't call it either way.",
    source,
    href: map(id),
  });
  const fire: GroundRow =
    !exact || !ran?.fire
      ? unchecked("fire", "Wildfire", "CAL FIRE")
      : s?.fire_hazard_class
        ? { id: "fire", map: "Wildfire", status: "zone", title: `${s.fire_hazard_class} fire hazard zone`, meaning: "Exterior work usually calls for fire-rated roofing, siding and vents, and insurance can cost more. Ask contractors to price it in.", source: "CAL FIRE", href: map("fire") }
        : { id: "fire", map: "Wildfire", status: "clear", title: "Not in a fire hazard zone", meaning: "Standard roofing, siding and vents are fine for exterior work. No wildfire building rules to plan around.", source: "CAL FIRE", href: map("fire") };
  const zone = s?.flood_zone?.trim() ?? "";
  const flood: GroundRow =
    !exact || !ran?.flood
      ? unchecked("flood", "Flood", "FEMA")
      : s?.in_special_flood_hazard_area && zone
        ? { id: "flood", map: "Flood", status: "zone", title: `In a FEMA flood zone (${zone})`, meaning: "Lenders backed by the federal government require flood insurance, and some work triggers elevation and venting rules.", source: "FEMA", href: map("flood") }
        : floodMinimal(zone)
          ? { id: "flood", map: "Flood", status: "clear", title: `${FLOOD_WORDS[zone.charAt(0).toUpperCase()] ?? "Minimal flood risk"} (zone ${zone})`, meaning: "Outside FEMA's flood zones: no flood-insurance requirement from lenders, no elevation rules for your work.", source: "FEMA", href: map("flood") }
          : zone
            ? { id: "flood", map: "Flood", status: "unrated", title: `Not rated by FEMA (zone ${zone})`, meaning: "FEMA hasn't studied flood risk here. Not a flood zone, not cleared either. Worth asking about drainage before grading or foundation work.", source: "FEMA", href: map("flood") }
            : unchecked("flood", "Flood", "FEMA");
  const quake = s?.seismic_hazard_type ?? "";
  const seismic: GroundRow =
    !exact || !ran?.seismic
      ? unchecked("seismic", "Earthquake", "California Geological Survey")
      : quake
        ? {
            id: "seismic",
            map: "Earthquake",
            status: "zone",
            title: `${quake} zone`,
            meaning: /liquefaction/i.test(quake)
              ? "The ground can behave like liquid in a strong quake. Additions and foundation work usually need a soils report first, and it goes on a seller's disclosure."
              : "Mapped landslide risk in a strong quake. Grading and foundation work usually need a geotechnical review first.",
            source: "California Geological Survey",
            href: map("seismic"),
          }
        : { id: "seismic", map: "Earthquake", status: "clear", title: "No liquefaction or landslide zone", meaning: "Additions and foundation work usually don't need a state-required soils report: one less study before you build.", source: "California Geological Survey", href: map("seismic") };
  return [fire, flood, seismic];
};

type Ground = {
  label: string;
  tone: Tone | "unknown";
  hazards: { id: "fire" | "flood" | "seismic"; name: string; plain: string; forProject: string; forDeal: string }[];
  clear: string[];
  unchecked: string[];
  floodUnrated: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "BAY BUILDERS & REMODELING" → "Bay Builders & Remodeling" (and "BAKHTIARY, MEHDI" → "Mehdi Bakhtiary"). */
export const tidyName = (s: string): string => {
  const t = s.trim();
  const flipped = /^[A-Z'-]+, [A-Z'-]+$/.test(t) ? t.split(", ").reverse().join(" ") : t;
  if (flipped !== flipped.toUpperCase()) return flipped;
  return flipped
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Llc|Lp|Llp|Dba|Hvac|Us|Usa)\b/g, (m) => (m === "Dba" ? "dba" : m.toUpperCase()));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string | null | undefined) => {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return null;
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};

const readGround = (s: RiskSignal | null): Ground => {
  const ran = s?.raw_response?.checked;
  const exact = !!s?.lookup_succeeded && s?.raw_response?.geocodeLevel !== "zip";
  const hazards: Ground["hazards"] = [];
  const clear: string[] = [];
  const unchecked: string[] = [];
  if (!s || !exact || !ran) {
    return { label: "Not checked yet", tone: "unknown", hazards, clear, unchecked: ["fire", "flood", "earthquake"], floodUnrated: false };
  }

  if (!ran.fire) unchecked.push("fire");
  else if (s.fire_hazard_class) {
    hazards.push({
      id: "fire",
      name: `${s.fire_hazard_class} fire hazard zone`,
      plain: "CAL FIRE maps your lot in a fire hazard severity zone.",
      forProject: "Exterior work here usually calls for fire-rated roofing, siding and vents. Ask each contractor to price that in.",
      forDeal: "Ask about home insurance early: carriers price fire zones differently.",
    });
  } else clear.push("fire");

  let floodUnrated = false;
  if (!ran.flood) unchecked.push("flood");
  else if (s.in_special_flood_hazard_area && s.flood_zone) {
    hazards.push({
      id: "flood",
      name: `FEMA flood zone ${s.flood_zone}`,
      plain: "FEMA maps your lot in a Special Flood Hazard Area.",
      forProject: "Some work here triggers flood elevation and venting rules. Mention it before anyone bids.",
      forDeal: "Federally backed lenders require flood insurance here. Get a quote before you commit.",
    });
  } else if (floodMinimal(s.flood_zone)) clear.push("flood");
  else if (s.flood_zone) floodUnrated = true;
  else unchecked.push("flood");

  if (!ran.seismic) unchecked.push("earthquake");
  else if (s.seismic_hazard_type) {
    const liq = /liquefaction/i.test(s.seismic_hazard_type);
    const slide = /landslide/i.test(s.seismic_hazard_type);
    hazards.push({
      id: "seismic",
      name: `${list([liq && "Liquefaction", slide && "Landslide"].filter(Boolean) as string[]) || "Seismic hazard"} zone`,
      plain: liq
        ? "The state maps your lot on ground that can liquefy in a strong quake."
        : "The state maps your lot in an earthquake-induced landslide zone.",
      forProject: "Additions and foundation work here usually need a soils (geotechnical) report first. Ask for it early so it doesn't surprise the schedule.",
      forDeal: "In California this zone goes on the seller's Natural Hazard Disclosure. Ask what the foundation has been through.",
    });
  } else clear.push("seismic");

  const tone: Ground["tone"] = hazards.length ? "watch" : unchecked.length || floodUnrated ? "unknown" : "clear";
  const label = hazards.length
    ? hazards.map((h) => h.name).join(" · ")
    : unchecked.length === 3
      ? "Not checked yet"
      : floodUnrated
        ? "No hazard zones · flood unrated"
        : unchecked.length
          ? "No hazard zones found so far"
          : "No hazard zones";
  return { label, tone, hazards, clear, unchecked, floodUnrated };
};

export const houseReport = (input: {
  street: string;
  zip: string;
  signal: RiskSignal | null;
  parcel: ParcelHistory | null;
  inspections?: InspectionIn[];
  reader: Reader;
  now?: Date;
}): HouseReport => {
  const { street, zip, signal, parcel, reader } = input;
  const now = input.now ?? new Date();
  const permitsRead = !!parcel?.lookup_succeeded;
  const permits = permitsRead ? parcel?.permits ?? [] : [];
  const rec = homeRecord(permits, input.inspections ?? [], now);
  const rows = rec.rows;
  const ground = readGround(signal);

  const unfinished = rows.filter((r) => r.state === "expired" || r.state === "open");
  const underway = rows.filter((r) => r.state === "in_progress");
  const signedTrades = [...new Set(rows.flatMap((r) => r.signoffs))];
  const newest = [...permits].sort((a, b) => (b.issued_date ?? "").localeCompare(a.issued_date ?? ""))[0];

  // Who has worked here, by how many permits they pulled.
  const byContractor = new Map<string, number>();
  for (const r of rows) if (r.contractor) byContractor.set(r.contractor, (byContractor.get(r.contractor) ?? 0) + 1);
  const crew = [...byContractor.entries()].sort((a, b) => b[1] - a[1]);

  // ── Vitals
  const permitVital: Vital = !permitsRead
    ? { id: "permits", label: "Permits", value: "Not checked yet", tone: "unknown" }
    : rows.length === 0
      ? { id: "permits", label: "Permits", value: "None current", tone: "clear" }
      : unfinished.length
        ? { id: "permits", label: "Permits", value: `${plural(unfinished.length, "unfinished permit")}`, tone: "act" }
        : underway.length
          ? { id: "permits", label: "Permits", value: `${plural(underway.length, "permit")} in progress`, tone: "watch" }
          : { id: "permits", label: "Permits", value: `${plural(rows.length, "permit")}, all closed`, tone: "clear" };
  const latestVital: Vital = newest
    ? {
        id: "latest",
        label: "Latest work",
        value: [monthYear(newest.issued_date), newest.contractor ? tidyName(newest.contractor) : null].filter(Boolean).join(" · ") || "On file",
        tone: "clear",
      }
    : { id: "latest", label: "Latest work", value: permitsRead ? "Nothing current" : "Not checked yet", tone: permitsRead ? "clear" : "unknown" };
  const onStreet = readStreet(parcel?.raw_response?.street, parcel?.raw_response?.street_name, now);
  const streetVital: Vital | null =
    !newest && onStreet && onStreet.total > 0
      ? { id: "latest", label: `On ${onStreet.name}`, value: `${plural(onStreet.total, "permit")} on the street`, tone: "clear" }
      : null;
  const vitals: Vital[] = [permitVital, { id: "ground", label: "Ground", value: ground.label, tone: ground.tone }, streetVital ?? latestVital];

  // ── Verdict
  const tone: Tone = unfinished.length ? "act" : ground.hazards.length || underway.length || ground.floodUnrated ? "watch" : "clear";
  const nothingRead = !permitsRead && ground.tone === "unknown";
  const verdict: [string, string] = nothingRead
    ? ["We couldn't read", "the records just now."]
    : tone === "act"
      ? unfinished.length === 1
        ? ["One thing to", "close out."]
        : [`${unfinished.length} things to`, "close out."]
      : tone === "watch"
        ? ((n) => ["In good order,", `with ${n === 1 ? "one thing" : n === 2 ? "two things" : `${n} things`} to know.`] as [string, string])(
            ground.hazards.length + (underway.length ? 1 : 0) + (ground.floodUnrated ? 1 : 0),
          )
        : ground.unchecked.length === 3
          ? ["No permits", "left unfinished."]
          : ground.unchecked.length || !permitsRead
            ? ["Clean so far", "on paper."]
            : ["Clean", "on paper."];
  const badge: HouseReport["badge"] = nothingRead
    ? { word: "Not checked", tone: "unknown" }
    : tone === "act"
      ? { word: unfinished.length === 1 ? "One to close out" : `${unfinished.length} to close out`, tone }
      : tone === "watch"
        ? { word: "Worth knowing", tone }
        : ground.unchecked.length || !permitsRead
          ? { word: "So far, so good", tone: "unknown" }
          : { word: "Clean on paper", tone };

  const subParts: string[] = [];
  if (unfinished.length) subParts.push(`${plural(unfinished.length, "permit")} the city never signed off. Unfinished permits follow a house to the next job and to the sale.`);
  if (underway.length) subParts.push(`${underway.length === rows.length && rows.length > 1 ? "All" : plural(underway.length, "permit")} ${underway.length === 1 ? "is" : "are"} still open with the city, which is normal while work is underway.`);
  if (ground.floodUnrated) subParts.push(`FEMA hasn't rated flood risk for this lot (zone ${signal?.flood_zone}), so we don't call it clear.`);
  if (ground.hazards.length) subParts.push(`Your lot sits in a mapped ${list(ground.hazards.map((h) => h.name.replace(/^FEMA /, "").replace(/ zone$/, "").toLowerCase()))} zone${ground.hazards.length > 1 ? "s" : ""}. Not a reason to walk away; a reason to ask the right questions.`);
  if (!subParts.length && !nothingRead) {
    const permitsPart = !permitsRead ? "" : rows.length ? "Every permit on file is closed" : "No open or expired permits with the city";
    const checkedNames = ground.clear.map((c) => ({ fire: "fire", flood: "flood", seismic: "earthquake" })[c as "fire"]);
    const mapsPart = checkedNames.length ? `no ${list(checkedNames)} hazard zone on the state and federal maps` : "";
    const missing = ground.unchecked.length ? ` We couldn't check the ${ground.unchecked.join(ground.unchecked.length === 2 ? " or " : ", ").replace(/, ([^,]*)$/, " or $1")} map${ground.unchecked.length > 1 ? "s" : ""} for this address yet.` : "";
    subParts.push(`${[permitsPart, mapsPart].filter(Boolean).join(", and ")}.${missing}`.replace(/^\./, "").trim());
  }
  if (rows.length === 0 && onStreet && onStreet.total > 0)
    subParts.push(
      `Around you: ${plural(onStreet.total, "permit")} on ${onStreet.name}${onStreet.lastYear ? `, ${onStreet.lastYear} in the past year` : ""}${topKinds(onStreet.kinds) ? `, most often ${topKinds(onStreet.kinds)} work` : ""}.`,
    );
  if (nothingRead) subParts.push("The city's and the state's servers didn't answer. Try again in a minute.");
  const sub = subParts.join(" ");

  // ── Next steps, for this reader
  const steps: Step[] = [];
  const addressLine = `${street}, San Jose ${zip}`;

  for (const r of unfinished.slice(0, 1)) {
    const permitRef = r.permit ? ` (permit ${r.permit})` : "";
    const more = unfinished.length - 1;
    const them = unfinished.length === 1 ? "the unfinished permit" : `the ${unfinished.length} unfinished permits`;
    steps.push({
      id: "close-out",
      title: reader === "deal" ? `Get ${them} closed before closing` : `Close out ${them}`,
      why: `${more ? "The latest: " : ""}${r.what.toLowerCase()}${r.year ? `, ${r.year}` : ""}${permitRef}, ${r.state === "expired" ? "expired without a final inspection" : "open for over two years"}${more ? `, and ${more} more` : ""}. A buyer's inspector or the next permit will find ${unfinished.length === 1 ? "it" : "them"}. Often it only takes a final inspection.`,
      action:
        reader === "deal"
          ? {
              kind: "copy",
              label: "Copy a note for the other side",
              text:
                unfinished.length === 1
                  ? `The city's records show a permit at ${addressLine} (${r.what.toLowerCase()}${permitRef}) that ${r.state === "expired" ? "expired without a final inspection" : "has been open for over two years"}. Can we get it finaled, or priced in, before we close?`
                  : `The city's records show ${unfinished.length} permits at ${addressLine} that never got a final inspection, the latest ${r.what.toLowerCase()}${permitRef}. Can we get them finaled, or priced in, before we close?`,
            }
          : { kind: "link", label: `Find ${unfinished.length === 1 ? "it" : "them"} on sjpermits.org`, href: CITY_PERMIT_ARCHIVE },
    });
  }

  const openWithCrew = underway.find((r) => r.contractor);
  if (openWithCrew && steps.length < 3) {
    const who = tidyName(openWithCrew.contractor!);
    const permitRef = openWithCrew.permit ? ` for permit ${openWithCrew.permit}` : "";
    steps.push(
      reader === "deal"
        ? {
            id: "final",
            title: "Ask for the final sign-off before you close",
            why: `${who} has work open with the city${openWithCrew.signoffs.length ? `; inspectors have signed off ${list(openWithCrew.signoffs.map((t) => t.toLowerCase()))} so far` : ""}. A final inspection closes it.`,
            action: {
              kind: "copy",
              label: "Copy the question",
              text: `Before closing on ${addressLine}: the city shows open permit work by ${who}${permitRef}. When is the final inspection booked?`,
            },
          }
        : {
            id: "final",
            title: "Make sure the final inspection gets booked",
            why: `Work by ${who} is open with the city${openWithCrew.signoffs.length ? `, with ${list(openWithCrew.signoffs.map((t) => t.toLowerCase()))} signed off so far` : ""}. A permit that never gets its final follows the house.`,
            action: {
              kind: "copy",
              label: "Copy a text to send them",
              text: `Hi, this is the homeowner at ${street}. Quick one: when is the final inspection booked${permitRef}? Thanks!`,
            },
          },
    );
  }

  for (const h of ground.hazards) {
    if (steps.length >= 3) break;
    if (reader === "owner" && h.id !== "flood") continue;
    steps.push({
      id: `hazard-${h.id}`,
      title:
        h.id === "seismic"
          ? reader === "deal"
            ? "Ask about the foundation"
            : "Plan for a soils report"
          : h.id === "flood"
            ? "Get a flood insurance quote"
            : reader === "deal"
              ? "Ask about insurance early"
              : "Ask for fire-rated materials in every bid",
      why: reader === "deal" ? h.forDeal : reader === "project" ? h.forProject : h.forDeal,
      action: {
        kind: "link",
        label: "See the official map",
        href: HAZARD_MAPS.find((m) => m.id === h.id)?.href ?? CITY_PERMIT_ARCHIVE,
      },
    });
  }

  if (ground.floodUnrated && steps.length < 3 && reader !== "owner") {
    steps.push({
      id: "flood-unrated",
      title: "Ask about drainage",
      why: `FEMA rates this lot zone ${signal?.flood_zone}: flood risk it hasn't studied. Not a flood zone, not cleared either.`,
      action: { kind: "link", label: "See FEMA's map", href: HAZARD_MAPS.find((m) => m.id === "flood")!.href },
    });
  }

  // Only a crew with a real track record on the street (2+ permits) earns a step.
  const streetCrew = onStreet?.crew.find((c) => c.count >= 2 && !crew.some(([name]) => name === c.raw));
  if (reader !== "deal" && streetCrew && steps.length < 2) {
    steps.push({
      id: "street-crew",
      title: `See who's working on ${onStreet!.name}`,
      why: `${streetCrew.name} has ${plural(streetCrew.count, "permit")} on your street. Their record, read against your job.`,
      action: { kind: "check", label: "Check their record", name: streetCrew.raw },
    });
  }
  if (reader === "project" && steps.length < 3) {
    steps.push({
      id: "project",
      title: "See who has built jobs like yours near here",
      why: "From the same city records: who pulls permits for work like yours in this ZIP, and what similar jobs declared.",
      action: { kind: "project", label: "Start here" },
    });
  }
  // A buyer's best next move: the seller's own records fill what the city's open feed drops.
  if (reader === "deal" && steps.length < 3) {
    steps.push({
      id: "history",
      title: "Ask for the full permit history",
      why: "The city's open records show current work only. The seller (or their agent) can pull every permit, and any work done without one is worth asking about too.",
      action: {
        kind: "copy",
        label: "Copy the request",
        text: `Could you share the full permit history for ${addressLine}, including finished permits? And was any work done without a permit (a converted garage, an added bathroom, new electrical)?`,
      },
    });
  }
  if (crew[0] && steps.length < 3 && reader !== "deal") {
    const who = tidyName(crew[0][0]);
    steps.push({
      id: "crew",
      title: `See ${who}'s record`,
      why: `They pulled ${crew[0][1] === rows.length && rows.length > 1 ? "every" : plural(crew[0][1], "permit")} on this house. Their other San Jose permits and inspections, read for you.`,
      action: { kind: "check", label: "Check their record", name: crew[0][0] },
    });
  }
  if (permitsRead && rows.length === 0 && steps.length < 3) {
    steps.push({
      id: "archive",
      title: "See the full history",
      why: "The city's open records drop permits once they're finished. Its archive has every permit back decades.",
      action: { kind: "link", label: "Open sjpermits.org", href: CITY_PERMIT_ARCHIVE },
    });
  }
  // ── Findings: what the record says, each with its source
  const findings: Finding[] = [];
  if (signedTrades.length)
    findings.push({
      text: unfinished.length
        ? `Inspectors passed ${list(signedTrades.map((t) => t.toLowerCase()))} work along the way. What's missing is the final sign-off.`
        : `City inspectors have signed off ${list(signedTrades.map((t) => t.toLowerCase()))} work on recent permits here.`,
      source: "Public record",
    });
  if (crew.length) {
    const [who, n] = crew[0];
    findings.push({
      text:
        crew.length === 1
          ? `${tidyName(who)} pulled ${n === rows.length && n > 1 ? `all ${n} permits` : plural(n, "permit")} on file.`
          : `${plural(crew.length, "contractor")} on file: ${list(crew.slice(0, 3).map(([c]) => tidyName(c)))}.`,
      source: "Public record",
    });
  }
  const noCrew = rows.filter((r) => !r.contractor).length;
  if (noCrew && rows.length) findings.push({ text: `${plural(noCrew, "permit")} with no contractor named, usually pulled by the owner or a sub-trade.`, source: "Our read" });
  // The hazard maps have their own section (ground), each read in full.
  if (parcel?.apn) findings.push({ text: `Assessor's parcel ${parcel.apn}, if a title company or the city asks.`, source: "Public record" });

  // ── The plain-text summary
  const summary = [
    `${addressLine}: what the public record shows (via Haleo)`,
    "",
    `Permits: ${permitVital.value}.`,
    ...rows.slice(0, 6).map((r) => `  - ${r.year ?? ""} ${r.what}: ${r.stateLabel.toLowerCase()}${r.contractor ? ` (${tidyName(r.contractor)})` : ""}${r.signoffs.length ? `; ${r.state === "finaled" ? "signed off" : "inspections passed"}: ${r.signoffs.join(", ")}` : ""}`),
    `Hazard maps: ${ground.label}${ground.unchecked.length && ground.unchecked.length < 3 ? ` (${ground.unchecked.join(", ")} not checked)` : ""}.`,
    "",
    "Sources: City of San José permit and inspection records, CAL FIRE, FEMA, California Geological Survey.",
  ].join("\n");
  for (const s of steps) if (s.action.kind === "copy" && !s.action.text) s.action = { ...s.action, text: summary };

  return { tone, badge, verdict, sub, vitals, steps: steps.slice(0, 3), findings, rows, summary, unchecked: ground.unchecked, ground: readGroundRows(signal), street: onStreet };
};

/**
 * The text that goes out when they share the report: the answer itself, so
 * whoever gets it sees the results in the message, not just a link.
 */
export const shareMessage = (r: Pick<HouseReport, "verdict" | "vitals">, street: string, url: string): string =>
  [
    `${street}: ${r.verdict.join(" ")}`,
    ...r.vitals.filter((v) => v.tone !== "unknown").map((v) => `• ${v.label}: ${v.value}`),
    "",
    `The full record, from the city's permits and public hazard maps: ${url}`,
  ].join("\n");

/** A link that opens Messages with the text filled in (iOS and Android both read "sms:?&body="). */
export const smsLink = (text: string) => `sms:?&body=${encodeURIComponent(text)}`;
