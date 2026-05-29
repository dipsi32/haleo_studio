// San Jose ADU + California AB 2221 hardcoded rules engine.
// CRITICAL: this is the single source of truth for feasibility rules. Gemini
// is never allowed to determine, infer, or "fill in" any of these values.
// Sources:
//   - San Jose Municipal Code Title 20 (ADU regulations)
//   - California AB 2221 / SB 9 ADU statewide rules
//   - California Building Code §R327 (fire-hazard severity zone materials)

export type AduType = "JADU" | "attached" | "detached" | "garage_conversion";

export type Confidence = "high" | "medium" | "low";

export interface FeasibilityInput {
  apn: string | null;
  lot_size_sqft: number | null;
  zoning: string | null;
  primary_dwelling_sqft: number | null;
  existing_footprints_sqft: number | null;
  open_permits: Array<{ permit_number: string | null; type: string | null; status: string | null }>;
  violations: Array<{ type?: string | null; date?: string | null }>;
  fire_hazard_zone: boolean | null; // null = unknown
}

export interface FeasibilityResult {
  feasible: boolean;
  confidence: Confidence;
  data_gaps: string[];
  adu_types_allowed: Array<{
    type: AduType;
    max_size_sqft: number | null;
    note: string;
  }>;
  max_size_sqft: number | null;
  setbacks: { rear: number; sides: number; front: string };
  height_limit_ft: number;
  height_note: string;
  lot_coverage_status: "within_limit" | "approaching_limit" | "unknown";
  fire_hazard_zone: boolean | null;
  open_permits: FeasibilityInput["open_permits"];
  violations: FeasibilityInput["violations"];
  school_impact_fee_applies: boolean;
  flags: string[];
  cost_range: { min: number; max: number; source: "cost_guide" } | null;
}

export function deriveConfidence(input: FeasibilityInput): {
  confidence: Confidence;
  gaps: string[];
} {
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

export function evaluateAdu(input: FeasibilityInput): Omit<FeasibilityResult, "cost_range"> {
  const { confidence, gaps } = deriveConfidence(input);
  const flags: string[] = [];
  const allowed: FeasibilityResult["adu_types_allowed"] = [];

  // JADU — requires single-family lot; AB 2221 has no statewide minimum lot
  // but San Jose JADU rules historically apply to single-family parcels of
  // at least 1,200 sqft. Surface as eligible when lot data confirms it.
  if (input.lot_size_sqft != null) {
    if (input.lot_size_sqft >= 1200) {
      allowed.push({
        type: "JADU",
        max_size_sqft: 500,
        note: "Junior ADU built within the existing primary dwelling, capped at 500 sqft.",
      });
    }
  } else {
    allowed.push({
      type: "JADU",
      max_size_sqft: 500,
      note: "Lot size unverified — JADU eligibility cannot be confirmed without it.",
    });
  }

  // Detached ADU max size: AB 2221 — min(1,200, 50% of primary); if primary
  // is under 800 sqft, 800 sqft ADU is still allowed.
  let detachedMax: number | null = null;
  if (input.primary_dwelling_sqft != null) {
    const halfPrimary = Math.floor(input.primary_dwelling_sqft * 0.5);
    if (input.primary_dwelling_sqft < 800) {
      detachedMax = 800;
    } else {
      detachedMax = Math.min(1200, halfPrimary);
    }
  } else {
    // Honest gap — show ordinance ceiling but flag it.
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
      "Garage conversions are allowed. Replacement parking is only required when the property is within a half mile of major transit — verify with San Jose Planning.",
  });

  // Setbacks — AB 2221: 4ft rear, 4ft sides, no front-yard ADU placement.
  const setbacks = { rear: 4, sides: 4, front: "Front-yard placement not permitted" };

  // Height limit. Transit proximity is not in our current data source, so we
  // conservatively use the 16ft baseline and flag the 18ft transit allowance.
  const heightLimitFt = 16;
  const heightNote =
    "16ft baseline. If the property is within a half mile of major transit, up to 18ft is allowed for a sloped roof — verify with San Jose Planning.";

  // Lot coverage check (heuristic — flag only, never block).
  let lot_coverage_status: FeasibilityResult["lot_coverage_status"] = "unknown";
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

  // School impact fee — triggered for ADUs over 500 sqft.
  const school_impact_fee_applies = (detachedMax ?? 0) > 500;
  if (school_impact_fee_applies) {
    flags.push(
      "ADUs over 500 sqft trigger California school impact fees (typically $4–$6/sqft, varies by district). Budget for this on top of construction cost.",
    );
  }

  // Fire hazard zone
  if (input.fire_hazard_zone === true) {
    flags.push(
      "Property is in a designated Fire Hazard Severity Zone. California Building Code §R327 requires fire-resistant exterior materials (Class A roofing, ignition-resistant siding, ember-resistant vents). This typically adds 5–15% to construction cost.",
    );
  }

  // Open permits / violations
  if (input.open_permits.length > 0) {
    flags.push(
      `Property has ${input.open_permits.length} open or unfinaled permit${input.open_permits.length === 1 ? "" : "s"}. Resolve these before applying for an ADU — they will complicate or block your application.`,
    );
  }
  if (input.violations.length > 0) {
    flags.push(
      `Property has ${input.violations.length} open code violation${input.violations.length === 1 ? "" : "s"} on record. These must be cleared before permitting an ADU.`,
    );
  }

  const feasible = confidence !== "low" && allowed.length > 0;
  const max_size_sqft = Math.max(...allowed.map((a) => a.max_size_sqft ?? 0)) || null;

  return {
    feasible,
    confidence,
    data_gaps: gaps,
    adu_types_allowed: allowed,
    max_size_sqft,
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
