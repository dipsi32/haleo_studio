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
const titleCase = (t: string) => t.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()).replace(/\bEv\b/g, "EV");
const describe = (name: string | null, work: string | null, type: string | null): string => {
  let raw = String(name ?? "").trim();
  // Leading trade codes: "(ME)", "(BEPM 100%)", "(E100%)", "(P)".
  const codes = new Set<string>();
  raw = raw.replace(/\(([A-Z]{1,5})\s*(?:\d+%)?\)/g, (_m, c: string) => {
    for (const ch of c) if (TRADES[ch]) codes.add(ch);
    return " ";
  }).replace(/\s+/g, " ").trim();
  const isAddress = /^\d+\s/.test(raw);
  const looksLikeWork = WORK_WORDS.test(raw);
  if (raw && !isAddress && looksLikeWork) {
    let t = raw;
    for (const [re, to] of ABBR) t = t.replace(re, to);
    t = t.replace(/\s*\/\s*/g, " and ").replace(/,\s*/g, ", ").replace(/\s+/g, " ").replace(/^[\s,/-]+|[\s,/-]+$/g, "");
    if (t) return titleCase(t).slice(0, 80);
  }
  const trades = [...codes].map((c) => TRADES[c]);
  if (trades.length) return `${trades.join(", ").replace(/, ([^,]*)$/, " and $1")} work`;
  if (work && /sub-?trades? only/i.test(work)) return "Plumbing, electrical or mechanical work";
  return (work && !/^other$/i.test(work) ? work : null) ?? type ?? "Permitted work";
};

const DIRECTIONS = new Set(["n", "s", "e", "w", "north", "south", "east", "west"]);
const SUFFIXES = new Set(["ave", "av", "avenue", "st", "street", "dr", "drive", "rd", "road", "ln", "lane", "ct", "court", "way", "wy", "blvd", "bl", "pl", "place", "cir", "circle", "ter", "pkwy"]);

/** "5343 Lenora Ave" → { num: "5343", street: "LENORA" } (the portal searches by the street's name alone). */
const parseStreet = (s: string) => {
  const m = s.trim().match(/^(\d+)[a-z]?\s+(.+)$/i);
  if (!m) return null;
  const words = m[2].toLowerCase().replace(/[.,#]/g, " ").split(/\s+/).filter(Boolean);
  const core = words.filter((w, i) => !(i === 0 && DIRECTIONS.has(w)) && !(i === words.length - 1 && SUFFIXES.has(w)));
  return core.length ? { num: m[1], street: core.join(" ").toUpperCase() } : null;
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
    const prop =
      props.find((p) => !zip || String(p?.address?.zipcode ?? "").startsWith(zip)) ?? (props.length === 1 ? props[0] : null);
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
          what: describe(f.name ?? null, r.validWork?.description ?? null, r.validFolder?.description ?? null),
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
