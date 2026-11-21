// Phase 1 City Intelligence — Address risk lookup.
// Public function (verify_jwt = false). Given a street+city+state+zip, geocodes
// via the free US Census geocoder, then queries public ArcGIS endpoints for:
//   - CAL FIRE Fire Hazard Severity Zones (FHSZ) — SRA + LRA
//   - FEMA NFHL flood hazard zones
//   - CA Geological Survey Seismic Hazard Zones
// Best-effort: a failure in one source doesn't block the others. Results are
// cached in public.address_risk_signals keyed on a normalized address string.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

function normalizeKey(a: Address): string {
  return [a.street, a.city, a.state, a.zip]
    .map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

async function geocode(a: Address): Promise<{ lat: number; lng: number } | null> {
  const oneLine = [a.street, a.city, a.state, a.zip].filter(Boolean).join(", ");
  if (!oneLine) return null;
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" +
    new URLSearchParams({
      address: oneLine,
      benchmark: "Public_AR_Current",
      format: "json",
    });
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const match = json?.result?.addressMatches?.[0];
    if (!match) return null;
    return { lat: match.coordinates.y, lng: match.coordinates.x };
  } catch (e) {
    console.error("geocode failed", e);
    return null;
  }
}

// CAL FIRE Fire Hazard Severity Zones — current (2023) authoritative service
// hosted by CAL FIRE on the public ArcGIS hub. SRA (state lands) and the LRA
// rollout layer cover the state between them.
// A lookup that couldn't run returns FAILED, so it is never mistaken for
// "checked, and nothing found" (null).
const FAILED = { failed: true } as const;
const failed = (r: unknown): r is typeof FAILED => r === FAILED;

// Why each check failed, so a failure is never a mystery (saved in raw_response.errors).
const errors: Record<string, string> = {};
// Public map servers often reject requests with no user agent, and some hang:
// identify ourselves and give up after 12 seconds.
const getJson = async (name: string, url: string): Promise<Record<string, unknown> | typeof FAILED> => {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Haleo/1.0 (homeowner address check; https://haleo.studio)", Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      errors[name] = `HTTP ${res.status}`;
      return FAILED;
    }
    const json = await res.json();
    if (json?.error) {
      errors[name] = `service error: ${JSON.stringify(json.error).slice(0, 200)}`;
      return FAILED;
    }
    return json;
  } catch (e) {
    errors[name] = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e).slice(0, 200);
    return FAILED;
  }
};

// Map services move. Each check lists the current home of its layer first and
// known mirrors after; the first that answers is used. Only when every one
// fails is the check "not checked", with each failure saved in errors.
const firstAnswer = async (name: string, urls: string[]): Promise<Record<string, unknown> | typeof FAILED> => {
  const why: string[] = [];
  for (const [i, url] of urls.entries()) {
    let json = await getJson(`${name}_${i}`, url);
    // A dropped connection or a timeout gets one more try before the next mirror.
    if (failed(json) && !/HTTP 4|service error/.test(errors[`${name}_${i}`] ?? "")) json = await getJson(`${name}_${i}`, url);
    const e = errors[`${name}_${i}`];
    delete errors[`${name}_${i}`];
    if (!failed(json)) return json;
    why.push(`${new URL(url).host}: ${e ?? "failed"}`);
  }
  errors[name] = why.join(" | ").slice(0, 600);
  return FAILED;
};

// Layer field names differ in case and spelling between hosts.
const pick = (a: Record<string, unknown>, ...names: string[]) => {
  const keys = Object.keys(a);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase() === n.toLowerCase());
    if (k && a[k] != null && a[k] !== "") return a[k];
  }
  return undefined;
};

const pointQuery = (lat: number, lng: number, bufferMeters = 0) => {
  const p = new URLSearchParams({
    f: "json",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
  });
  if (bufferMeters > 0) {
    p.set("distance", String(bufferMeters));
    p.set("units", "esriSRUnit_Meter");
  }
  return p.toString();
};

const featuresOf = (json: Record<string, unknown>) =>
  ((json?.features as { attributes: Record<string, unknown> }[] | undefined) ?? []).map((f) => f.attributes ?? {});

// CAL FIRE severity class, wherever the layer keeps it.
const fireClass = (a: Record<string, unknown>): 0 | 1 | 2 | 3 => {
  const d = String(pick(a, "FHSZ_Description", "Hazard_Class", "HAZ_CLASS", "FHSZ_Desc", "FHSZ", "HAZ_CODE", "Haz_Class") ?? "")
    .trim()
    .toUpperCase();
  if (/VERY HIGH|^3$/.test(d)) return 3;
  if (/^HIGH$|^2$/.test(d)) return 2;
  if (/MODERATE|^1$|^MOD/.test(d)) return 1;
  return 0;
};
const CLASS_NAME = { 3: "Very High", 2: "High", 1: "Moderate" } as const;

// State Responsibility Area (CAL FIRE's own layer) and the 2025 local maps.
const FIRE_SRA = [
  "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZSRA_23_3/FeatureServer/0/query",
];
const FIRE_LRA = [
  "https://services3.arcgis.com/i2dkYWmb4wHvYPda/ArcGIS/rest/services/FHSZ_2025/FeatureServer/0/query",
  "https://socogis.sonomacounty.ca.gov/map/rest/services/CALFIREPublic/Local_Responsibility_Area_Fire_Hazard_Severity_Zones/FeatureServer/0/query",
  "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZLRA0711_ByPhase/FeatureServer/0/query",
];

async function queryFireHazard(lat: number, lng: number, bufferMeters = 0) {
  const q = pointQuery(lat, lng, bufferMeters);
  const read = async (name: string, urls: string[]) => {
    const json = await firstAnswer(name, urls.map((u) => `${u}?${q}`));
    if (failed(json)) return FAILED;
    // Pick the most severe class if several polygons matched (buffer query).
    const feats = featuresOf(json).sort((a, b) => fireClass(b) - fireClass(a));
    return feats[0] ?? null;
  };
  const [sra, lra] = await Promise.all([read("fire_sra", FIRE_SRA), read("fire_lra", FIRE_LRA)]);
  const f = (!failed(sra) && sra) || (!failed(lra) && lra) || null;
  // Either map failing means we can't say "not in a fire zone".
  if (!f) return failed(sra) || failed(lra) ? FAILED : null;
  const c = fireClass(f);
  return {
    zone: !failed(sra) && sra ? "State Responsibility Area" : "Local Responsibility Area",
    hazardClass: c ? CLASS_NAME[c] : null,
    raw: f,
    approximate: bufferMeters > 0,
  };
}

// FEMA National Flood Hazard Layer, flood hazard zones.
const FLOOD = [
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
  "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query",
  "https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/national_flood_hazard/MapServer/5/query",
];

async function queryFlood(lat: number, lng: number) {
  const q = pointQuery(lat, lng);
  const json = await firstAnswer("flood", FLOOD.map((u) => `${u}?${q}`));
  if (failed(json)) return FAILED;
  const f = featuresOf(json)[0];
  if (!f) return null;
  const zone = (pick(f, "FLD_ZONE") as string | undefined) ?? null;
  const sf = pick(f, "SFHA_TF");
  const sfha = sf === "T" || sf === true;
  let description: string | null = null;
  if (zone === "X") description = "Minimal flood hazard area.";
  else if (zone && /^A/.test(zone)) description = "1% annual chance flood (100-year floodplain).";
  else if (zone && /^V/.test(zone)) description = "Coastal high-hazard area with wave action.";
  else if (zone) description = `FEMA flood zone ${zone}.`;
  return { zone, description, sfha, raw: f };
}

// California Geological Survey seismic hazard zones: liquefaction and
// earthquake-induced landslide are separate layers, so both are asked.
const LIQUEFACTION = [
  "https://services2.arcgis.com/zr3KAIbsRSUyARHG/ArcGIS/rest/services/CGS_Liquefaction_Zones/FeatureServer/0/query",
  "https://services.gis.ca.gov/arcgis/rest/services/GeoscientificInformation/Liquefaction/MapServer/0/query",
];
const LANDSLIDE = [
  "https://services2.arcgis.com/zr3KAIbsRSUyARHG/ArcGIS/rest/services/CGS_Landslide_Zones/FeatureServer/0/query",
];

async function querySeismic(lat: number, lng: number) {
  const q = pointQuery(lat, lng);
  const [liq, slide] = await Promise.all([
    firstAnswer("seismic_liquefaction", LIQUEFACTION.map((u) => `${u}?${q}`)),
    firstAnswer("seismic_landslide", LANDSLIDE.map((u) => `${u}?${q}`)),
  ]);
  const liqHit = failed(liq) ? undefined : featuresOf(liq)[0];
  const slideHit = failed(slide) ? undefined : featuresOf(slide)[0];
  if (liqHit || slideHit) {
    const kinds = [liqHit && "Liquefaction", slideHit && "Landslide"].filter(Boolean) as string[];
    return { zone: `${kinds.join(" and ")} zone of required investigation`, type: kinds.join(" and "), raw: liqHit ?? slideHit };
  }
  // Nothing found counts only if both layers answered.
  if (failed(liq) || failed(slide)) return FAILED;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  for (const k of Object.keys(errors)) delete errors[k];

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const address: Address = body.address ?? {};
    const force = body.force === true;

    if (!address.zip && (!address.street || !address.city)) {
      return new Response(
        JSON.stringify({ error: "address.zip or (street + city) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const key = normalizeKey(address);

    // Cache check
    if (!force) {
      const { data: cached } = await supabase
        .from("address_risk_signals")
        .select("*")
        .eq("address_key", key)
        .maybeSingle();
      // Treat fully-empty results as stale (probably a broken endpoint last
      // time) and re-run the lookup rather than serving the empty cache.
      const stale =
        (cached && !(cached.raw_response as { checked?: unknown } | null)?.checked) ||
        cached &&
        !cached.fire_hazard_class &&
        !cached.flood_zone &&
        !cached.seismic_hazard_type &&
        !cached.seismic_hazard_zone;
      if (cached && !stale) {
        return new Response(JSON.stringify({ cached: true, signals: cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Try full address first, fall back to ZIP centroid (zippopotam.us) so
    // vague streets ("almaden hills") still surface something useful when the
    // ZIP is real.
    let coords = await geocode(address);
    let geocodeLevel: "address" | "zip" = "address";
    if (!coords && address.zip && /^\d{5}$/.test(address.zip)) {
      try {
        const r = await fetch(`https://api.zippopotam.us/us/${address.zip}`);
        if (r.ok) {
          const j = await r.json();
          const p = j?.places?.[0];
          if (p?.latitude && p?.longitude) {
            coords = { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) };
            geocodeLevel = "zip";
          }
        }
      } catch (e) {
        console.warn("zip fallback failed", e);
      }
    }
    if (!coords) {
      const fallback = {
        address_key: key,
        street: address.street ?? null,
        city: address.city ?? null,
        state: address.state ?? null,
        zip: address.zip ?? null,
        lookup_succeeded: false,
        raw_response: { error: "geocoding_failed" },
      };
      await supabase.from("address_risk_signals").upsert(fallback, { onConflict: "address_key" });
      return new Response(JSON.stringify({ cached: false, signals: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [fireR, floodR, seismicR] = await Promise.all([
      queryFireHazard(coords.lat, coords.lng, geocodeLevel === "zip" ? 3000 : 0),
      queryFlood(coords.lat, coords.lng),
      querySeismic(coords.lat, coords.lng),
    ]);
    // Which checks actually ran. The brief only calls a hazard "clear" when its check ran.
    const checked = { fire: !failed(fireR), flood: !failed(floodR), seismic: !failed(seismicR) };
    const fire = failed(fireR) ? null : fireR;
    const flood = failed(floodR) ? null : floodR;
    const seismic = failed(seismicR) ? null : seismicR;

    const row = {
      address_key: key,
      street: address.street ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      zip: address.zip ?? null,
      lat: coords.lat,
      lng: coords.lng,
      fire_hazard_zone: fire?.zone ?? null,
      fire_hazard_class: fire?.hazardClass ?? null,
      flood_zone: flood?.zone ?? null,
      flood_zone_description: flood?.description ?? null,
      in_special_flood_hazard_area: !!flood?.sfha,
      seismic_hazard_zone: seismic?.zone ?? null,
      seismic_hazard_type: seismic?.type ?? null,
      raw_response: { fire, flood, seismic, geocodeLevel, checked, ...(Object.keys(errors).length ? { errors: { ...errors } } : {}) },
      lookup_succeeded: true,
      last_checked_at: new Date().toISOString(),
    };

    const { data: saved, error: saveErr } = await supabase
      .from("address_risk_signals")
      .upsert(row, { onConflict: "address_key" })
      .select()
      .single();

    if (saveErr) {
      console.error("save failed", saveErr);
      return new Response(JSON.stringify({ cached: false, signals: row, save_error: saveErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ cached: false, signals: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    console.error("lookup-address-risk failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
