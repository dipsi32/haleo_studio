// Best-effort parcel enrichment from free public GIS sources.
// Pulls lot size, zoning, primary dwelling sqft, and fire hazard zone for a
// San Jose / Santa Clara County address. Every lookup is isolated — a single
// failure never blocks the others. Returns partial data plus a `sources` map
// so the client can show which fields were resolved vs. still missing.
//
// Endpoints (all public ArcGIS REST, no API key):
//   • SCC Assessor Parcels       — apn, lot_size_sqft, primary_dwelling_sqft
//   • San Jose Zoning Districts  — zoning code
//   • Cal Fire FHSZ              — fire_hazard_zone (Moderate/High/Very High)
//   • San Jose Building Footprints — existing_footprints_sqft
//
// Geocoding is done via OpenStreetMap Nominatim (free, no key).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface EnrichInput {
  address?: { street?: string; city?: string; state?: string; zip?: string };
  lat?: number;
  lng?: number;
}

interface EnrichResult {
  lat: number | null;
  lng: number | null;
  apn: string | null;
  lot_size_sqft: number | null;
  zoning: string | null;
  primary_dwelling_sqft: number | null;
  existing_footprints_sqft: number | null;
  fire_hazard_zone: boolean | null;
  fire_hazard_class: string | null;
  sources: Record<string, "ok" | "error" | "empty">;
}

// ─── Public ArcGIS endpoints ───────────────────────────────────────────────
const PARCEL_URL =
  "https://services2.arcgis.com/0WTQK0bhVl3WnGcG/arcgis/rest/services/Parcels/FeatureServer/0/query";
const ZONING_URL =
  "https://services2.arcgis.com/0WTQK0bhVl3WnGcG/arcgis/rest/services/Zoning_Districts/FeatureServer/0/query";
const FHSZ_URL =
  "https://egis.fire.ca.gov/arcgis/rest/services/FHSZ/FHSZ_SRA_LRA_Combined/MapServer/0/query";
const FOOTPRINTS_URL =
  "https://services2.arcgis.com/0WTQK0bhVl3WnGcG/arcgis/rest/services/Building_Footprints/FeatureServer/0/query";

async function geocode(address: EnrichInput["address"]): Promise<{ lat: number; lng: number } | null> {
  if (!address?.street) return null;
  const q = [address.street, address.city ?? "San Jose", address.state ?? "CA", address.zip]
    .filter(Boolean)
    .join(", ");
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "haleo-adu/1.0 (contact: support@haleo.studio)" } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!Array.isArray(d) || d.length === 0) return null;
    return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch {
    return null;
  }
}

async function queryPoint(url: string, lat: number, lng: number, outFields = "*") {
  const params = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    outSR: "4326",
  });
  const r = await fetch(`${url}?${params}`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message ?? "arcgis error");
  return d.features ?? [];
}

function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

function pick(attrs: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const found = Object.keys(attrs).find((a) => a.toLowerCase() === k.toLowerCase());
    if (found && attrs[found] != null && attrs[found] !== "") return attrs[found];
  }
  return null;
}

async function fetchParcel(lat: number, lng: number) {
  const features = await queryPoint(PARCEL_URL, lat, lng);
  if (features.length === 0) return null;
  const a = features[0].attributes ?? {};
  return {
    apn: (pick(a, ["APN", "PARCEL_ID", "ParcelNum", "APN_FORMATTED"]) as string | null) ?? null,
    lot_size_sqft: num(pick(a, ["LotSize", "LOT_SIZE", "LotSizeSF", "Shape__Area", "AREA"])),
    primary_dwelling_sqft: num(pick(a, ["BldgSqFt", "LivingArea", "BLDG_AREA", "LivingSqFt", "BUILDING_SQ_FT"])),
  };
}

async function fetchZoning(lat: number, lng: number) {
  const features = await queryPoint(ZONING_URL, lat, lng);
  if (features.length === 0) return null;
  const a = features[0].attributes ?? {};
  return (pick(a, ["ZONING", "ZONE_CODE", "ZONE", "ZoningCode", "DISTRICT"]) as string | null) ?? null;
}

async function fetchFhsz(lat: number, lng: number) {
  const features = await queryPoint(FHSZ_URL, lat, lng);
  if (features.length === 0) return { is_hazard: false, hazard_class: null };
  const a = features[0].attributes ?? {};
  const cls = (pick(a, ["HAZ_CLASS", "HAZARD", "FHSZ", "CLASS"]) as string | null) ?? null;
  const is_hazard = cls ? /moderate|high|very high/i.test(cls) : true; // any FHSZ polygon = hazard
  return { is_hazard, hazard_class: cls };
}

async function fetchFootprints(lat: number, lng: number) {
  const features = await queryPoint(FOOTPRINTS_URL, lat, lng);
  if (features.length === 0) return null;
  let total = 0;
  for (const f of features) {
    const a = f.attributes ?? {};
    const sqft = num(pick(a, ["AREA", "Shape__Area", "SqFt", "BLDG_AREA"]));
    if (sqft) total += sqft;
  }
  return total > 0 ? Math.round(total) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as EnrichInput;
    let lat = body.lat ?? null;
    let lng = body.lng ?? null;

    if (lat == null || lng == null) {
      const g = await geocode(body.address);
      if (g) { lat = g.lat; lng = g.lng; }
    }

    const result: EnrichResult = {
      lat, lng,
      apn: null,
      lot_size_sqft: null,
      zoning: null,
      primary_dwelling_sqft: null,
      existing_footprints_sqft: null,
      fire_hazard_zone: null,
      fire_hazard_class: null,
      sources: {},
    };

    if (lat == null || lng == null) {
      result.sources.geocode = "error";
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    result.sources.geocode = "ok";

    const [parcelR, zoningR, fhszR, footprintsR] = await Promise.allSettled([
      fetchParcel(lat, lng),
      fetchZoning(lat, lng),
      fetchFhsz(lat, lng),
      fetchFootprints(lat, lng),
    ]);

    if (parcelR.status === "fulfilled" && parcelR.value) {
      result.apn = parcelR.value.apn;
      result.lot_size_sqft = parcelR.value.lot_size_sqft;
      result.primary_dwelling_sqft = parcelR.value.primary_dwelling_sqft;
      result.sources.parcel = "ok";
    } else {
      result.sources.parcel = parcelR.status === "rejected" ? "error" : "empty";
      if (parcelR.status === "rejected") console.error("parcel lookup failed", parcelR.reason);
    }

    if (zoningR.status === "fulfilled" && zoningR.value) {
      result.zoning = zoningR.value;
      result.sources.zoning = "ok";
    } else {
      result.sources.zoning = zoningR.status === "rejected" ? "error" : "empty";
      if (zoningR.status === "rejected") console.error("zoning lookup failed", zoningR.reason);
    }

    if (fhszR.status === "fulfilled" && fhszR.value) {
      result.fire_hazard_zone = fhszR.value.is_hazard;
      result.fire_hazard_class = fhszR.value.hazard_class;
      result.sources.fhsz = "ok";
    } else {
      result.sources.fhsz = "error";
      if (fhszR.status === "rejected") console.error("fhsz lookup failed", fhszR.reason);
    }

    if (footprintsR.status === "fulfilled" && footprintsR.value) {
      result.existing_footprints_sqft = footprintsR.value;
      result.sources.footprints = "ok";
    } else {
      result.sources.footprints = footprintsR.status === "rejected" ? "error" : "empty";
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("enrich-sj-parcel failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
