## Problem

The feasibility check has no source for the 4 critical fields (lot size, zoning, primary dwelling sqft, fire hazard zone), so every San Jose address gets "Insufficient data — cannot produce reliable feasibility." We're turning away every real customer.

## Fix — two layers

### Layer 1: Auto-fetch from free public GIS (no API keys, no new packages)

Create one new edge function `enrich-sj-parcel` that, given an address or lat/lng, hits these free ArcGIS REST endpoints in parallel:

1. **Santa Clara County Assessor parcels** (`https://www.sccgov.org/sites/scc/gis` ArcGIS feature service)  
   → `apn`, `lot_size_sqft` (from `Shape__Area` or `LotSize` attribute), `primary_dwelling_sqft` (from `BldgSqFt` / `LivingArea`), `year_built`
2. **San Jose Zoning GIS** (`https://gisdata-csj.opendata.arcgis.com/` Zoning Districts feature service)  
   → `zoning` code (e.g. `R-1-8`, `R-2`)
3. **Cal Fire FHSZ** (`https://egis.fire.ca.gov/arcgis/rest/services/FHSZ_SRA_LRA_Combined`)  
   → `fire_hazard_zone` (Moderate / High / Very High / none)
4. **San Jose building footprints** (open-data ArcGIS layer)  
   → `existing_footprints_sqft` (sum building polygons on parcel)

Each lookup is independent, wrapped in try/catch; partial success still beats today's all-nulls. Geocode once via the existing `lookup-address-risk` flow (already returns lat/lng), then spatial-query each layer by point.

Call `enrich-sj-parcel` from `ADU.tsx` between `lookup-parcel-history` and `check-adu-feasibility`. Merge enriched data into the `parcel` object before posting to feasibility.

### Layer 2: Manual override — "Help us fill the gaps"

If after Layer 1 anything is still missing, show a compact inline form on the feasibility screen *before* the verdict:

- Lot size (sqft) — number input
- Primary dwelling size (sqft) — number input
- Zoning code (if known) — text input, optional
- Fire hazard zone — yes / no / unsure toggle

A "Recheck feasibility" button re-posts to `check-adu-feasibility` with the user-supplied values. Mark these as `data_source: "user"` so the confidence badge labels them clearly ("based on your input").

This turns the dead-end into a 30-second self-serve recovery. Most owners know their lot size; the rest can pull it off Zillow/Redfin in one click.

## Files changed

- **New:** `supabase/functions/enrich-sj-parcel/index.ts`
- **New:** `src/components/adu/AduDataGapForm.tsx` (inline override form)
- **Edit:** `src/pages/ADU.tsx` — call enrich function; render gap form on low/medium confidence; wire "Recheck" button
- **Edit:** `supabase/config.toml` — register new function
- **Edit:** `src/lib/analytics.ts` — add `adu_data_enriched`, `adu_gaps_filled_manually` events

## Out of scope

- Coverage beyond San Jose / Santa Clara County (Layer 1 endpoints are SCC-specific)
- Paid data providers (Regrid, ATTOM) — these public sources are enough for the pilot
- Changing the hardcoded rules engine — only the *inputs* to it are changing

## Risks / verification

- Public ArcGIS endpoints can rate-limit or change URLs. Each one is isolated so a single failure doesn't break the whole call. I'll log each lookup's status.
- After implementation I'll test with a real San Jose address (e.g. 200 E Santa Clara St) and confirm at least lot_size + zoning + FHSZ come back populated and confidence rises to "medium" or "high".
