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
async function queryFireHazard(lat: number, lng: number, bufferMeters = 0) {
  const params = new URLSearchParams({
    f: "json",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
  });
  if (bufferMeters > 0) {
    params.set("distance", String(bufferMeters));
    params.set("units", "esriSRUnit_Meter");
  }
  async function hit(url: string) {
    try {
      const res = await fetch(`${url}?${params}`);
      if (!res.ok) return null;
      const json = await res.json();
      const feats = json?.features ?? [];
      if (!feats.length) return null;
      // Pick the most severe class if multiple polygons matched (buffer query).
      const rank = (a: Record<string, unknown>) => {
        const d = String(
          a.FHSZ_Description ?? a.HAZ_CLASS ?? a.FHSZ ?? a.HAZ_CODE ?? "",
        ).toUpperCase();
        if (/VERY HIGH|^3$/.test(d)) return 3;
        if (/^HIGH$|^2$/.test(d)) return 2;
        if (/MODERATE|^1$|MOD/.test(d)) return 1;
        return 0;
      };
      return feats
        .map((f: { attributes: Record<string, unknown> }) => f.attributes)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => rank(b) - rank(a))[0];
    } catch (e) {
      console.error("fhsz query failed", url, e);
      return null;
    }
  }
  const SRA =
    "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZSRA_23_3/FeatureServer/0/query";
  const LRA =
    "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZLRA0711_ByPhase/FeatureServer/0/query";
  const [sra, lra] = await Promise.all([hit(SRA), hit(LRA)]);
  const f = sra ?? lra;
  if (!f) return null;
  const desc = String(
    f.FHSZ_Description ?? f.HAZ_CLASS ?? f.FHSZ ?? f.HAZ_CODE ?? "",
  ).toUpperCase();
  let hazardClass: string | null = null;
  if (/VERY HIGH|^3$/.test(desc)) hazardClass = "Very High";
  else if (/^HIGH$|^2$/.test(desc)) hazardClass = "High";
  else if (/MODERATE|^1$|MOD/.test(desc)) hazardClass = "Moderate";
  return {
    zone: sra ? "State Responsibility Area" : "Local Responsibility Area",
    hazardClass,
    raw: f,
    approximate: bufferMeters > 0,
  };
}
}

// FEMA NFHL — flood hazard zones layer 28.
async function queryFlood(lat: number, lng: number) {
  const url =
    "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?" +
    new URLSearchParams({
      f: "json",
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      returnGeometry: "false",
    });
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const f = json?.features?.[0]?.attributes;
    if (!f) return null;
    const zone = f.FLD_ZONE ?? null;
    const sfha = f.SFHA_TF === "T" || f.SFHA_TF === true;
    let description: string | null = null;
    if (zone === "X") description = "Minimal flood hazard area.";
    else if (zone && /^A/.test(zone)) description = "1% annual chance flood (100-year floodplain).";
    else if (zone && /^V/.test(zone)) description = "Coastal high-hazard area with wave action.";
    else if (zone) description = `FEMA flood zone ${zone}.`;
    return { zone, description, sfha, raw: f };
  } catch (e) {
    console.error("flood query failed", e);
    return null;
  }
}

// CGS Seismic Hazard Zones — liquefaction & landslide overlays.
async function querySeismic(lat: number, lng: number) {
  const url =
    "https://gis.conservation.ca.gov/server/rest/services/CGS/MS48_SeismicHazardZones/MapServer/0/query?" +
    new URLSearchParams({
      f: "json",
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
    });
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const f = json?.features?.[0]?.attributes;
    if (!f) return null;
    const type = f.ZONE ?? f.HAZARD ?? f.Hazard ?? null;
    const typeStr = String(type ?? "").toLowerCase();
    let kind: string | null = null;
    if (typeStr.includes("liquefaction")) kind = "Liquefaction";
    else if (typeStr.includes("landslide")) kind = "Landslide";
    return { zone: type ? String(type) : "Mapped seismic hazard zone", type: kind, raw: f };
  } catch (e) {
    console.error("seismic query failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const [fire, flood, seismic] = await Promise.all([
      queryFireHazard(coords.lat, coords.lng, geocodeLevel === "zip" ? 3000 : 0),
      queryFlood(coords.lat, coords.lng),
      querySeismic(coords.lat, coords.lng),
    ]);

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
      raw_response: { fire, flood, seismic, geocodeLevel },
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
