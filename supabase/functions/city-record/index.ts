/* eslint-disable @typescript-eslint/no-explicit-any -- the city portal's JSON is untyped; every field is read defensively with ?? fallbacks. */
// city-record: a San José home's complete record, straight from the city's
// own permit portal (permits.sanjoseca.gov, the public "SJPermits" search).
//
// The open-data feeds only carry current permits; the portal has every permit
// on the parcel, its full scope of work, who did it, and the imaged documents
// (permits, inspection notices, plans) as direct PDFs.
//
// Input:  { street: "5343 Lenora Ave", zip: "95124" }
// Output: { ok, property: {...}, permits: [...] }
//
// Privacy: the portal's "people" records include owners' and applicants'
// names and emails. Only people listed as Contractor ever leave this
// function; everything else is dropped here, on the server.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API = "https://permits.sanjoseca.gov/api/public-portal";
const DOC_URL = (docId: string) => `${API}/permit/document?docId=${encodeURIComponent(docId)}`;

// Folder types that are paperwork, not work on the house.
const NOT_WORK = new Set(["TM", "IR"]);

// Property facts a homeowner can use, in their words.
const FACTS: [string, string][] = [
  ["Area", "Lot size"],
  ["Soil Type", "Soil"],
  ["Ground Water Depth", "Groundwater depth"],
  ["Flood Zone", "Flood zone (city)"],
  ["General Plan 2040", "General plan"],
  ["School District", "School district"],
  ["Water Company", "Water"],
  ["Council District", "Council district"],
  ["Near a Park / Trail (500 ft)", "Near a park or trail"],
  ["Annexation Date", "Part of San José since"],
  ["Historic", "Historic"],
  ["Historic District", "Historic district"],
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const get = async (path: string): Promise<any> => {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Haleo/1.0 (homeowner permit lookup; https://haleo.studio)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`portal ${res.status} ${path.split("?")[0]}`);
  return res.json();
};

/** "06/11/2021" → "2021-06-11" */
const iso = (d?: string | null) => {
  const m = (d ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

// ── What the permit was for, in plain words.
// The portal's permit "name" is often the applicant's or owner's name
// ("ANN RILEY (M)", "GOKUL (ME)"), sometimes the address, sometimes a real
// description ("(E) EVCS / Service", "(BEPM100%) KITCHEN REMODEL"). Only
// descriptions get through: a name never leaves this function.
const TRADES: Record<string, string> = { B: "Building", E: "Electrical", M: "Mechanical", P: "Plumbing" };
const WORK_WORDS =
  /remodel|addition|alteration|kitchen|bath|roof|solar|photovoltaic|\bpv\b|evcs|ev charg|service|panel|meter|water heater|\bwh\b|repipe|rpip|duct|furnace|hvac|heat pump|a\/c|condens|window|door|demo|garage|adu|pool|spa|fence|deck|patio|foundation|seismic|retrofit|sewer|gas|appliance|fireplace|stair|porch|skylight|siding|stucco|change|replace|install|new|conversion/i;
const ABBR: [RegExp, string][] = [
  [/\bEVCS\b/gi, "EV charger"],
  [/\bPHOTOVOLTAIC\b|\bPV\b/gi, "Solar"],
  [/\bWH-R\b/gi, "water heater replacement"],
  [/\bWH\b/gi, "water heater"],
  [/\bRPIP\b/gi, "repipe"],
  [/\bAPL\b/gi, "appliance"],
  [/\bR\/M\b/gi, "replace or move"],
  [/\bGAS-R\b/gi, "gas line"],
  [/\bFAU\b/gi, "furnace"],
  [/\(E\)|\(N\)/g, ""],
];
// Every word in a title must be one of these, or the title is dropped: an
// unknown word may be a person's name ("MCPHEE SPA", "SMITH RESIDENCE REROOF").
const VOCAB = new Set(
  `remodel remodeling addition additions alteration alterations kitchen kitchens bath baths bathroom bathrooms master
  roof reroof re-roof roofing solar ev charger chargers charging station service upgrade upgrades panel panels main sub meter
  water heater heaters replacement replacements repipe duct ducts ductwork furnace furnaces hvac heat pump pumps a/c ac air
  conditioner conditioning condenser window windows door doors demo demolition garage garages adu jadu pool pools spa spas
  fence fences deck decks patio patios foundation seismic retrofit sewer lateral gas line lines appliance appliances fireplace
  stair stairs porch skylight skylights siding stucco change changeout replace install installation installed new conversion
  convert converted to and or of with for in on at the a an habitable space room rooms bedroom bedrooms interior exterior
  structural story second first floor single family residence residential dwelling unit units sfd sfr detached attached
  accessory battery batteries storage system systems kw electrical electric plumbing mechanical building permit repair repairs
  dry rot termite wall walls bearing non load beam beams laundry shower showers tub tile cabinets counter counters ceiling attic
  insulation drywall framing rebuild fire damage amp amps sq ft minor major partial full whole house home existing legalize
  legalization as-built sunroom carport shed pergola trellis retaining cover covered awning balcony driveway landscape
  irrigation tank tankless hot mini split mini-split relocate relocation move outlet outlets lighting light lights circuit
  circuits car generator backup photovoltaic pv evcs wh rpip apl gas-r fau r/m wh-r tenant improvement ti only like kind
  in-kind same remove removal add adding addl additional level upper lower front rear side yard back new-roof re-pipe
  residence's bath/laundry plan plans revision revisions`.split(/\s+/),
);
const allKnown = (t: string) =>
  t
    .toLowerCase()
    .replace(/[(),.;:&+]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => VOCAB.has(w) || /^\d+(\.\d+)?(%|kw|a|amp|sf|sqft|st|nd|rd|th)?$/.test(w) || /^[-/]+$/.test(w));

// What the job was, read from the city's description when the name doesn't say.
const JOBS: [RegExp, string][] = [
  [/seismic retrofit|brace (&|and) bolt/i, "Seismic retrofit"],
  [/garage[^.]{0,40}(habitable|adu|living|office|bedroom)|convert[^.]{0,30}garage/i, "Garage conversion"],
  [/\bj?adu\b|accessory dwelling/i, "ADU"],
  [/\baddition\b|\bextend\b/i, "Addition"],
  [/kitchen/i, "Kitchen remodel"],
  [/\bbath/i, "Bathroom remodel"],
  [/re-?roof/i, "New roof"],
  [/solar|pv system|photovolt/i, "Solar"],
  [/fire damage/i, "Fire damage repair"],
  [/pool[^.]{0,20}demo|demo[^.]{0,20}pool/i, "Pool removal"],
  [/\bpool\b/i, "Pool"],
  [/\bspa\b|hot tub/i, "Spa"],
  [/ev charg|\bevcs\b/i, "EV charger"],
  [/panel upgrade|service upgrade|main panel|service change/i, "Electrical panel upgrade"],
  [/water heater/i, "Water heater"],
  [/furnace|hvac|heat pump|\ba\/c\b|air condition/i, "Heating and cooling"],
  [/window/i, "Windows"],
  [/repipe|re-pipe/i, "Repipe"],
  [/sewer/i, "Sewer line"],
  [/foundation/i, "Foundation work"],
];
const jobsIn = (s: string | null) => {
  const found: string[] = [];
  for (const [re, label] of JOBS) if (re.test(s ?? "") && !found.includes(label)) found.push(label);
  // "Pool removal" already says pool; an addition that's a garage conversion is one job.
  const clean = found.filter((l) => !(l === "Pool" && found.includes("Pool removal")) && !(l === "Addition" && found.includes("Garage conversion")));
  return clean.length ? clean.slice(0, 2).join(" and ").replace(/ and (\w)/, (_m, c: string) => ` and ${c.toLowerCase()}`) : null;
};

const titleCase = (t: string) => t.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()).replace(/\bEv\b/g, "EV");
const describe = (name: string | null, work: string | null, type: string | null, scope: string | null = null): string => {
  let raw = String(name ?? "").trim();
  // Leading trade codes: "(ME)", "(BEPM 100%)", "(E100%)", "(P)".
  const codes = new Set<string>();
  raw = raw.replace(/\(([A-Z]{1,5})\s*(?:\d+%)?\)/g, (_m, c: string) => {
    for (const ch of c) if (TRADES[ch]) codes.add(ch);
    return " ";
  }).replace(/\s+/g, " ").trim();
  const isAddress = /^\d+\s/.test(raw);
  const tidy = (s: string) => {
    let t = s;
    for (const [re, to] of ABBR) t = t.replace(re, to);
    t = t.replace(/\s*\/\s*/g, " and ").replace(/,\s*/g, ", ").replace(/\s+/g, " ").replace(/^[\s,/-]+|[\s,/-]+$/g, "");
    return t ? titleCase(t).slice(0, 80) : null;
  };
  // The permit's name, only when every word is about the work.
  if (raw && !isAddress && WORK_WORDS.test(raw) && allKnown(raw)) {
    const t = tidy(raw);
    if (t) return t;
  }
  // Else what the city's description says the job was.
  const job = jobsIn(scope);
  if (job) return job;
  // Else its first line, on the same every-word rule.
  const first = String(scope ?? "").split(/[\n.;]/)[0].trim();
  if (first && first.length <= 70 && !/^\d+\s/.test(first) && WORK_WORDS.test(first) && allKnown(first)) {
    const t = tidy(first);
    if (t) return t;
  }
  const trades = [...codes].map((c) => TRADES[c]);
  if (trades.length) return `${trades.join(", ").replace(/, ([^,]*)$/, " and $1")} work`;
  if (work && /sub-?trades? only/i.test(work)) return "Plumbing, electrical or mechanical work";
  return (work && !/^other$/i.test(work) ? work : null) ?? type ?? "Permitted work";
};

const DIRECTIONS = new Set(["n", "s", "e", "w", "north", "south", "east", "west"]);
// Street types, as people write them → the city's code. "1691 Merrill Dr" and
// "1691 Merrill Loop" are different houses in the same ZIP.
const TYPES: Record<string, string> = {
  ave: "AV", av: "AV", avenue: "AV", st: "ST", street: "ST", dr: "DR", drive: "DR", rd: "RD", road: "RD",
  ln: "LN", lane: "LN", ct: "CT", court: "CT", way: "WY", wy: "WY", blvd: "BL", bl: "BL", boulevard: "BL",
  pl: "PL", place: "PL", cir: "CR", cr: "CR", circle: "CR", ter: "TR", tr: "TR", terrace: "TR",
  pkwy: "PY", py: "PY", parkway: "PY", loop: "LP", lp: "LP", sq: "SQ", square: "SQ", hwy: "HY", expy: "EX",
};

/** "5343 Lenora Ave" → { num: "5343", street: "LENORA", type: "AV" } (the portal searches by the street's name alone). */
export const parseStreet = (s: string) => {
  const m = s.trim().match(/^(\d+)[a-z]?\s+(.+)$/i);
  if (!m) return null;
  const words = m[2].toLowerCase().replace(/[.,#]/g, " ").split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  const type = words.length > 1 ? TYPES[last] ?? null : null;
  const core = words.filter((w, i) => !(i === 0 && DIRECTIONS.has(w) && words.length > 1) && !(i === words.length - 1 && type));
  return core.length ? { num: m[1], street: core.join(" ").toUpperCase(), type } : null;
};

/** The property that is this address: same ZIP and, when they told us, the same street type. Never a near miss. */
export const pickProperty = (props: any[], zip: string, type: string | null) => {
  const inZip = props.filter((p) => !zip || String(p?.address?.zipcode ?? "").startsWith(zip));
  const pool = inZip.length ? inZip : props.length === 1 ? props : [];
  if (type) {
    const typed = pool.find((p) => String(p?.address?.streetType ?? "").trim().toUpperCase() === type);
    if (typed) return typed;
    // A different street type is a different house: don't show its record.
    if (pool.some((p) => String(p?.address?.streetType ?? "").trim())) return null;
  }
  // Two houses share this number and street name, and we don't know which: don't guess.
  return pool.length === 1 ? pool[0] : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const street = String(body.street ?? "");
    const zip = String(body.zip ?? "").trim();
    const parsed = parseStreet(street);
    if (!parsed) return json({ ok: false, error: "Add the house number and street." }, 400);

    // 1. The property.
    const found = await get(`/property/search?offset=0&limit=20&houseNumber=${encodeURIComponent(parsed.num)}&street=${encodeURIComponent(parsed.street)}`);
    const props: any[] = found?.data?.records ?? [];
    const prop = pickProperty(props, zip, parsed.type);
    if (!prop?.rsn) return json({ ok: true, found: false, property: null, permits: [] });

    // 2. Every permit on it, its documents, and the lot's facts, together.
    const [permitsRes, docsRes, infoRes] = await Promise.allSettled([
      get(`/permit/rsn/${prop.rsn}`),
      get(`/property/documents?rsn=${prop.rsn}`),
      get(`/property/info?rsn=${prop.rsn}`),
    ]);
    const records: any[] = permitsRes.status === "fulfilled" ? permitsRes.value?.data?.records ?? [] : [];
    const docs: any[] = docsRes.status === "fulfilled" ? docsRes.value?.data?.records ?? [] : [];
    const info: Record<string, string> = infoRes.status === "fulfilled" ? infoRes.value?.data?.records ?? {} : {};

    const work = records.filter((r) => r?.folder?.rsn && !NOT_WORK.has(String(r.folder.type ?? "").toUpperCase()));

    // 3. Who did each job: Contractor entries only. Owners and applicants never leave this function.
    const people = await Promise.all(
      work.map(async (r) => {
        try {
          const p = await get(`/permit/people?folderRSN=${r.folder.rsn}`);
          const contractors = ((p?.data?.records ?? []) as any[])
            .filter((x) => /^contractor$/i.test(String(x?.type ?? "").trim()))
            .map((x) => String(x.orgName ?? "").trim() || String(x.name ?? "").trim())
            .filter(Boolean);
          return [...new Set(contractors)];
        } catch {
          return [];
        }
      }),
    );

    const docsBy = new Map<string, any[]>();
    for (const d of docs) {
      if (!d?.docId || d.viewOk === false) continue;
      const k = String(d.folderRSN ?? "");
      docsBy.set(k, [...(docsBy.get(k) ?? []), d]);
    }

    const permits = work
      .map((r, i) => {
        const f = r.folder;
        const number = r.permitNumber || `${f.century ?? ""}${f.year ?? ""}-${f.sequence ?? ""}-${f.type ?? ""}`;
        const fdocs = (docsBy.get(String(f.rsn)) ?? [])
          .map((d) => ({
            id: String(d.docId),
            kind: [d.docType, d.subDocType].filter(Boolean).join(" · ") || d.category || "Document",
            category: d.category ?? null,
            date: iso(d.docDate),
            url: DOC_URL(String(d.docId)),
          }))
          .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
        return {
          permit: number,
          rsn: String(f.rsn),
          // Plain words; never the applicant's or owner's name (see describe()).
          what: describe(f.name ?? null, r.validWork?.description ?? null, r.validFolder?.description ?? null, f.description ?? null),
          scope: String(f.description ?? "").trim() || null,
          type: r.validFolder?.description ?? null,
          work: r.validWork?.description ?? null,
          sub: r.validSub?.description ?? null,
          status: r.validStatus?.description ?? null,
          applied: iso(f.inDate),
          issued: iso(f.issueDate),
          finaled: iso(f.finalDate),
          expires: iso(f.expiryDate),
          contractors: people[i],
          docs: fdocs,
        };
      })
      .sort((a, b) => String(b.issued ?? b.applied ?? "").localeCompare(String(a.issued ?? a.applied ?? "")));

    const facts: { label: string; value: string }[] = [];
    for (const [key, label] of FACTS) {
      const raw = String(info[key] ?? "").replace(/^"|"$/g, "").trim();
      if (!raw || raw === "N/A" || (raw === "No" && !/park|historic/i.test(key))) continue;
      facts.push({ label, value: key === "Area" && /^\d+$/.test(raw) ? `${Number(raw).toLocaleString()} sq ft` : raw });
    }

    return json({
      ok: true,
      found: true,
      property: {
        apn: prop.apn ?? null,
        zoning: prop.zone ?? null,
        lot: prop.lot ?? null,
        tract: prop.tract ?? null,
        facts,
        documents: docs.length,
      },
      permits,
      portal: "https://permits.sanjoseca.gov/search/",
    });
  } catch (e) {
    console.error("city-record failed", e);
    return json({ ok: false, error: "The city's permit portal didn't answer just now." }, 502);
  }
});
