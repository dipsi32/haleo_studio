// ADU feasibility check — San Jose + CA AB 2221.
// CRITICAL: all zoning rules, size limits, setbacks, and height caps are
// HARDCODED below. Claude is invoked only to translate the structured JSON
// into a plain-English summary — it is forbidden by system prompt from
// adding any fact, cost, or rule not present in the JSON.
import { aiFetch } from "../_shared/ai.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Rules engine (duplicated from src/lib/aduRules.ts — edge functions cannot
// import from /src; keep these two files in sync). ─────────────────────────
type AduType = "JADU" | "attached" | "detached" | "garage_conversion";
type Confidence = "high" | "medium" | "low";

interface FeasibilityInput {
  apn: string | null;
  lot_size_sqft: number | null;
  zoning: string | null;
  primary_dwelling_sqft: number | null;
  existing_footprints_sqft: number | null;
  open_permits: Array<{ permit_number: string | null; type: string | null; status: string | null }>;
  violations: Array<{ type?: string | null; date?: string | null }>;
  fire_hazard_zone: boolean | null;
}

function deriveConfidence(input: FeasibilityInput): { confidence: Confidence; gaps: string[] } {
  const gaps: string[] = [];
  if (!input.apn) gaps.push("Assessor's Parcel Number could not be resolved");
  if (!input.lot_size_sqft) gaps.push("Lot size unavailable from parcel record");
  if (!input.zoning) gaps.push("Zoning classification unavailable");
  if (input.primary_dwelling_sqft == null)
    gaps.push("Primary dwelling square footage unavailable — affects max detached ADU size");
  if (input.fire_hazard_zone == null) gaps.push("Fire Hazard Severity Zone status unavailable");
  if (!input.apn) return { confidence: "low", gaps };
  if (!input.lot_size_sqft || !input.zoning) return { confidence: "medium", gaps };
  return { confidence: "high", gaps };
}

function evaluateAdu(input: FeasibilityInput) {
  const { confidence, gaps } = deriveConfidence(input);
  const flags: string[] = [];
  const allowed: Array<{ type: AduType; max_size_sqft: number | null; note: string }> = [];

  if (input.lot_size_sqft == null || input.lot_size_sqft >= 1200) {
    allowed.push({
      type: "JADU",
      max_size_sqft: 500,
      note:
        input.lot_size_sqft == null
          ? "Lot size unverified — JADU eligibility cannot be confirmed without it."
          : "Junior ADU built within the existing primary dwelling, capped at 500 sqft.",
    });
  }

  let detachedMax: number;
  if (input.primary_dwelling_sqft != null) {
    detachedMax = input.primary_dwelling_sqft < 800
      ? 800
      : Math.min(1200, Math.floor(input.primary_dwelling_sqft * 0.5));
  } else {
    detachedMax = 1200;
  }

  allowed.push({
    type: "detached",
    max_size_sqft: detachedMax,
    note:
      input.primary_dwelling_sqft == null
        ? "Ordinance ceiling shown (1,200 sqft). Actual max depends on primary dwelling size, which is unavailable."
        : input.primary_dwelling_sqft < 800
          ? "Primary dwelling is under 800 sqft, so an 800 sqft detached ADU is allowed under AB 2221."
          : "Lesser of 1,200 sqft or 50% of your primary dwelling.",
  });

  allowed.push({
    type: "attached",
    max_size_sqft: detachedMax,
    note: "Same size cap as detached ADU under AB 2221.",
  });

  allowed.push({
    type: "garage_conversion",
    max_size_sqft: null,
    note:
      "Garage conversions are allowed. Replacement parking is only required when within a half mile of major transit — verify with San Jose Planning.",
  });

  const setbacks = { rear: 4, sides: 4, front: "Front-yard placement not permitted" };
  const heightLimitFt = 16;
  const heightNote =
    "16ft baseline. If within a half mile of major transit, up to 18ft is allowed for a sloped roof — verify with San Jose Planning.";

  let lot_coverage_status: "within_limit" | "approaching_limit" | "unknown" = "unknown";
  if (input.lot_size_sqft != null && input.existing_footprints_sqft != null) {
    const coverage = input.existing_footprints_sqft / input.lot_size_sqft;
    if (coverage >= 0.45) {
      lot_coverage_status = "approaching_limit";
      flags.push(
        "Existing structures already cover ~45%+ of your lot — adding an ADU may push you over San Jose's lot-coverage limit. Verify before proceeding.",
      );
    } else {
      lot_coverage_status = "within_limit";
    }
  }

  const school_impact_fee_applies = (detachedMax ?? 0) > 500;
  if (school_impact_fee_applies) {
    flags.push(
      "ADUs over 500 sqft trigger California school impact fees (typically $4–$6/sqft, varies by district). Budget for this on top of construction cost.",
    );
  }

  if (input.fire_hazard_zone === true) {
    flags.push(
      "Property is in a designated Fire Hazard Severity Zone. California Building Code §R327 requires fire-resistant exterior materials. Typically adds 5–15% to construction cost.",
    );
  }

  if (input.open_permits.length > 0) {
    flags.push(
      `Property has ${input.open_permits.length} open or unfinaled permit${input.open_permits.length === 1 ? "" : "s"}. Resolve these before applying for an ADU.`,
    );
  }
  if (input.violations.length > 0) {
    flags.push(
      `Property has ${input.violations.length} open code violation${input.violations.length === 1 ? "" : "s"} on record. These must be cleared before permitting an ADU.`,
    );
  }

  return {
    feasible: confidence !== "low" && allowed.length > 0,
    confidence,
    data_gaps: gaps,
    adu_types_allowed: allowed,
    max_size_sqft: Math.max(...allowed.map((a) => a.max_size_sqft ?? 0)) || null,
    setbacks,
    height_limit_ft: heightLimitFt,
    height_note: heightNote,
    lot_coverage_status,
    fire_hazard_zone: input.fire_hazard_zone,
    open_permits: input.open_permits,
    violations: input.violations,
    school_impact_fee_applies,
    flags,
  };
}

// ─── Claude translation (plain-English explainer only). ─────────────────────
async function explainWithClaude(structured: Record<string, unknown>): Promise<string | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;

  const systemPrompt = [
    "You are explaining verified data to a homeowner who is considering building an ADU.",
    "STRICT RULES:",
    "1. Do NOT add any information not present in the provided JSON.",
    "2. Do NOT speculate about costs, rules, timelines, or anything else.",
    "3. If a field is null, missing, or empty, explicitly say that information is unavailable.",
    "4. Your role is translation, not analysis. Do not give opinions or advice.",
    "5. Do not invent numbers. Do not round or extrapolate.",
    "6. Keep it under 180 words, friendly but factual, no jargon.",
    "7. CRITICAL: 'feasible: false' combined with 'confidence: low' means we lack data to confirm — NOT that an ADU is disallowed. In that case say: 'An ADU is likely allowed under San Jose and California rules, but we couldn't pull enough parcel data to confirm the exact size and placement for this lot.' Then list what's missing. Never say 'not feasible' or 'cannot build' when confidence is low.",
  ].join(" ");


  try {
    const res = await aiFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "smart",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              "Translate this ADU feasibility result into a short plain-English summary for a homeowner. JSON:\n" +
              JSON.stringify(structured, null, 2),
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("claude explain failed", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("claude explain error", e);
    return null;
  }
}

// ─── Cost range from cost-guide-lookup (never AI-estimated). ────────────────
async function fetchCostRange(zip: string | null): Promise<{ min: number; max: number; source: "cost_guide" } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const r = await fetch(`${supabaseUrl}/functions/v1/cost-guide-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
      },
      body: JSON.stringify({ zipCode: zip ?? "95110", spaceType: "addition", scope: "redesign" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d?.low !== "number" || typeof d?.high !== "number") return null;
    return { min: d.low, max: d.high, source: "cost_guide" };
  } catch (e) {
    console.error("cost lookup failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const input: FeasibilityInput = {
      apn: body.apn ?? null,
      lot_size_sqft: body.lot_size_sqft ?? null,
      zoning: body.zoning ?? null,
      primary_dwelling_sqft: body.primary_dwelling_sqft ?? null,
      existing_footprints_sqft: body.existing_footprints_sqft ?? null,
      open_permits: Array.isArray(body.open_permits) ? body.open_permits : [],
      violations: Array.isArray(body.violations) ? body.violations : [],
      fire_hazard_zone: typeof body.fire_hazard_zone === "boolean" ? body.fire_hazard_zone : null,
    };

    // Missing APN is allowed — the rules engine will mark confidence as "low"
    // and surface the gap. We only require a request body we can parse.

    const structured = evaluateAdu(input);
    const costRange = await fetchCostRange(body.zip ?? null);
    const result = { ...structured, cost_range: costRange };

    const explanation = await explainWithClaude(result);

    return new Response(JSON.stringify({ result, explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("check-adu-feasibility failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
