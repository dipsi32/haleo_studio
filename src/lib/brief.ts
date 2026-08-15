// Pure brief generators — kept out of the page so they're testable and honest.
// Rule: every line must be grounded in user input. Anything inferred is tagged.
import {
  ROOM_LABELS,
  type IntakeData,
  hasKind,
  hasAnyMeasurements,
  formatDimensions,
  dimensionsArea,
  scopeFor,
} from "@/lib/intake";

export type ContractorLine = {
  text: string;
  /**
   * grounded  → directly stated by the homeowner (room, pain point they ticked, file they uploaded, etc.)
   * inferred  → reasonable next step a contractor would take given the input — must be verified on site
   * question  → an explicit unknown the contractor needs to answer before bidding
   */
  basis: "grounded" | "inferred" | "question";
  source?: string; // short tag of where it came from, e.g. "Pain: Too dark" or "Room: Kitchen"
  /**
   * Trade bucket so the page can group lines like a scope-of-work doc:
   * "Demo & structural", "Electrical", "Plumbing", "Cabinetry & finishes",
   * "Lighting", "Project context".
   */
  trade?: BriefTrade;
};

export type BriefTrade =
  | "structural"
  | "electrical"
  | "plumbing"
  | "cabinetry"
  | "lighting"
  | "ventilation"
  | "finishes"
  | "appliances"
  | "context";

export const TRADE_META: Record<BriefTrade, { label: string; blurb: string }> = {
  structural: { label: "Demo & structural", blurb: "Walls, headers, framing, anything load-path." },
  electrical: { label: "Electrical", blurb: "Circuits, outlets, panel, switching." },
  plumbing: { label: "Plumbing", blurb: "Supply, drain, fixtures, rough-in." },
  cabinetry: { label: "Cabinetry & built-ins", blurb: "Cabinets, islands, storage millwork." },
  lighting: { label: "Lighting", blurb: "Layered ambient, task, and accent." },
  ventilation: { label: "Ventilation", blurb: "Exhaust, make-up air, code minimums." },
  finishes: { label: "Finishes", blurb: "Tile, paint, flooring, hardware." },
  appliances: { label: "Appliances", blurb: "Owner-supplied vs included." },
  context: { label: "Project context", blurb: "Budget, timeline, jurisdiction, files on hand." },
};

export type BriefReadiness = {
  score: number; // 0–100
  level: "draft" | "shareable" | "biddable";
  have: { label: string; weight: number }[]; // what counted
  missing: { label: string; weight: number; nudge: string }[]; // what would sharpen it
};

const fmtMoney = (v?: number) => (v == null ? "" : v >= 500 ? "$500K+" : `$${v}K`);

// ───── Project title — "{Street} {Scope}: Project Brief" ─────
// Falls back gracefully when the homeowner skipped the address.
export const buildProjectTitle = (d: IntakeData): { title: string; sub: string } => {
  const scope = scopeFor(d.scope);
  // Pull just the first token of the street ("742 Lenora Ave" → "Lenora").
  const street = (() => {
    const raw = d.address?.street?.trim();
    if (!raw || d.address?.skipped) return "";
    const token = raw.replace(/^\d+\s*/, "").split(/\s+/)[0] ?? "";
    return token.replace(/[^a-zA-Z]/g, "");
  })();
  const room = d.room === "addition"
    ? "Addition"
    : d.room === "full-home"
      ? "Whole-home"
      : d.room
        ? ROOM_LABELS[d.room]
        : "Project";
  const action = scope?.value === "refresh"
    ? "Refresh"
    : scope?.value === "remodel"
      ? "Remodel"
      : scope?.value === "reconfigure"
        ? "Reconfigure"
        : scope?.value === "structural"
          ? "Addition"
          : "Brief";
  const titleStem = street ? `${street} ${action}` : `${room} ${action}`;
  const city = d.address?.city && !d.address.skipped
    ? `${d.address.city}${d.address.state ? `, ${d.address.state}` : ""}`
    : "Location pending";
  return { title: `${titleStem}: Project Brief`, sub: city };
};

// ───── Homeowner layer ─────
// First-person, only uses words/choices the user actually made.
export const buildHomeownerLayer = (d: IntakeData): string => {
  const room = d.room ? ROOM_LABELS[d.room].toLowerCase() : "space";
  const pains = d.painPoints.slice(0, 3).map((p) => p.toLowerCase());

  const opener =
    d.room === "addition"
      ? "We're adding on to our home."
      : d.room === "full-home"
        ? "We're remodeling our whole home."
        : d.room
          ? `We're remodeling the ${room}.`
          : "We're planning a remodel.";

  const painsLine =
    pains.length > 0
      ? `What's bugging us: ${pains.join(", ").replace(/, ([^,]*)$/, " and $1")}.`
      : "";

  return [opener, painsLine].filter(Boolean).join(" ");
};

// ───── Contractor layer (honest) ─────
// Each line is tagged with basis + trade. The brief page groups by trade so a
// contractor reads it like a real scope-of-work document.
export const buildContractorLayer = (d: IntakeData): ContractorLine[] => {
  const lines: ContractorLine[] = [];

  // Scope opener — grounded in room choice
  if (d.room === "addition") {
    const size = d.additionSize ? `${d.additionSize >= 1000 ? "1,000+" : d.additionSize} sq ft ` : "";
    const type = d.additionType ?? "addition";
    const where = d.additionLocation && d.additionLocation !== "unsure" ? ` on ${d.additionLocation} elevation` : "";
    lines.push({
      text: `New ${size}${type} addition${where}.`,
      basis: "grounded",
      source: "Addition: type / size / location",
      trade: "structural",
    });
    lines.push({
      text: "Full scope: foundation, framing, roof tie-in, MEP rough-in, insulation, finishes.",
      basis: "inferred",
      source: "Standard for any addition — verify with structural & Title 24 review",
      trade: "structural",
    });
  } else if (d.room === "full-home") {
    lines.push({
      text: "Whole-home renovation — phasing TBD.",
      basis: "grounded",
      source: "Room: Full home",
      trade: "structural",
    });
  } else if (d.room) {
    lines.push({
      text: `${ROOM_LABELS[d.room]} renovation.`,
      basis: "grounded",
      source: `Room: ${ROOM_LABELS[d.room]}`,
      trade: "context",
    });
  }

  // Scope tier
  const scope = scopeFor(d.scope);
  if (scope) {
    lines.push({
      text: `Scope tier: ${scope.label.toLowerCase()} — ${scope.oneLiner.toLowerCase()}`,
      basis: "grounded",
      source: "Scope of work",
      trade: "context",
    });
  }

  // Pain → scope mapping. Only when the user explicitly ticked the pain.
  const pain = (p: string) => d.painPoints.includes(p);

  if (pain("Too dark") || pain("Poor lighting") || pain("No natural light")) {
    lines.push({
      text: "Lighting plan in scope — fixture count, zoning, and dimming TBD on walkthrough.",
      basis: "inferred",
      source: `Pain: ${[pain("Too dark") && "Too dark", pain("Poor lighting") && "Poor lighting", pain("No natural light") && "No natural light"].filter(Boolean).join(", ")}`,
      trade: "lighting",
    });
  }
  if (pain("Cramped") || pain("Bad layout") || pain("Layout doesn't work") || pain("Bad flow")) {
    lines.push({
      text: "Layout reconfiguration on the table — load-path and header sizing to be confirmed.",
      basis: "inferred",
      source: "Pain: layout/flow",
      trade: "structural",
    });
  }
  if (pain("No island")) {
    lines.push({
      text: "Island addition — needs plumbing/electrical rough-in if relocating sink or prep zone.",
      basis: "inferred",
      source: "Pain: No island",
      trade: "cabinetry",
    });
  }
  if (pain("Dated cabinets") || pain("No storage") || pain("Not enough storage") || pain("No closet space")) {
    lines.push({
      text: "Cabinetry / built-in storage to be itemized separately from countertops.",
      basis: "inferred",
      source: "Pain: storage/cabinets",
      trade: "cabinetry",
    });
  }
  if (pain("Appliances need upgrading")) {
    lines.push({
      text: "Appliance package replacement — homeowner to spec models before final bid.",
      basis: "question",
      source: "Pain: Appliances need upgrading",
      trade: "appliances",
    });
  }
  if (pain("Tiny shower") || pain("No bathtub")) {
    lines.push({
      text: "Wet-area reconfiguration — waterproofing, drain relocation, supply lines.",
      basis: "inferred",
      source: "Pain: shower/tub",
      trade: "plumbing",
    });
  }
  if (pain("Single vanity")) {
    lines.push({
      text: "Double-vanity install — confirm minimum 60\" wall and dual P-traps.",
      basis: "inferred",
      source: "Pain: Single vanity",
      trade: "plumbing",
    });
  }
  if (pain("Bad ventilation")) {
    lines.push({
      text: "Exhaust ventilation upgrade — humidity-sensing fan recommended.",
      basis: "inferred",
      source: "Pain: Bad ventilation",
      trade: "ventilation",
    });
  }
  if (pain("Dated finishes") || pain("Ugly tile") || pain("Carpet needs to go")) {
    lines.push({
      text: "Finish replacement — selections pending homeowner.",
      basis: "question",
      source: "Pain: dated finishes",
      trade: "finishes",
    });
  }
  if (pain("Energy inefficient")) {
    lines.push({
      text: "Insulation / envelope upgrade — Title 24 calcs likely required.",
      basis: "inferred",
      source: "Pain: Energy inefficient",
      trade: "structural",
    });
  }

  // What we have on file
  if (hasKind(d, "video")) {
    lines.push({
      text: "Walkthrough video on file — review before site visit for flow, ceiling, finishes.",
      basis: "grounded",
      source: "Walkthrough video",
      trade: "context",
    });
  }
  if (hasKind(d, "floorplan")) {
    lines.push({
      text: "Floor plan on file — dimensions to be field-verified.",
      basis: "grounded",
      source: "Floor plan",
      trade: "context",
    });
  }
  // Structured dimensions
  const dimText = formatDimensions(d.dimensions);
  if (dimText) {
    const area = dimensionsArea(d.dimensions);
    lines.push({
      text: `Homeowner-reported dimensions: ${dimText}${area ? ` (~${area} sq ft)` : ""}.`,
      basis: "grounded",
      source: "Measurements",
      trade: "context",
    });
  } else if (d.measurements?.trim()) {
    lines.push({
      text: `Homeowner notes on size: "${d.measurements.trim().slice(0, 140)}${d.measurements.length > 140 ? "…" : ""}"`,
      basis: "grounded",
      source: "Measurements (notes)",
      trade: "context",
    });
  }

  // The homeowner's own words about the job (pool fill-in, demo, re-roof…)
  if (d.goalNote?.trim()) {
    lines.push({
      text: `In the homeowner's words: "${d.goalNote.trim().slice(0, 220)}${d.goalNote.trim().length > 220 ? "…" : ""}"`,
      basis: "grounded",
      source: "Homeowner description",
      trade: "context",
    });
  }

  // Address — city/state only for contractor view (PII rule).
  if (d.address?.city && !d.address.skipped) {
    lines.push({
      text: `Project location: ${d.address.city}${d.address.state ? `, ${d.address.state}` : ""}.`,
      basis: "grounded",
      source: "Address (PII redacted)",
      trade: "context",
    });
  }

  // Constraints
  if (!d.budgetSkipped && d.budgetMin != null) {
    lines.push({
      text: `Target budget: ${fmtMoney(d.budgetMin)} – ${fmtMoney(d.budgetMax)}.`,
      basis: "grounded",
      source: "Budget",
      trade: "context",
    });
  }
  if (d.timeline) {
    const t =
      d.timeline === "asap"
        ? "Ready to start"
        : d.timeline === "1-3"
          ? "Start in 1–3 months"
          : d.timeline === "3-6"
            ? "Start in 3–6 months"
            : "Exploring — no firm start";
    lines.push({ text: `Timeline: ${t}.`, basis: "grounded", source: "Timeline", trade: "context" });
  }

  // Open questions
  if (!hasKind(d, "video") && !hasKind(d, "floorplan") && !hasAnyMeasurements(d)) {
    lines.push({
      text: "No walkthrough, floor plan, or measurements on file — site visit required before any line-item bid.",
      basis: "question",
      trade: "context",
    });
  }
  if (d.budgetSkipped || d.budgetMin == null) {
    lines.push({
      text: "Budget not shared — homeowner will share range after first conversation.",
      basis: "question",
      trade: "context",
    });
  }

  return lines;
};

// ───── Trade grouping for the scope-of-work display ─────
export type TradeGroup = { trade: BriefTrade; meta: typeof TRADE_META[BriefTrade]; lines: ContractorLine[] };

const TRADE_ORDER: BriefTrade[] = [
  "structural",
  "electrical",
  "plumbing",
  "cabinetry",
  "lighting",
  "ventilation",
  "finishes",
  "appliances",
  "context",
];

export const groupContractorLinesByTrade = (lines: ContractorLine[]): TradeGroup[] => {
  const groups = new Map<BriefTrade, ContractorLine[]>();
  for (const line of lines) {
    const trade = line.trade ?? "context";
    const arr = groups.get(trade) ?? [];
    arr.push(line);
    groups.set(trade, arr);
  }
  return TRADE_ORDER
    .filter((t) => groups.has(t))
    .map((trade) => ({ trade, meta: TRADE_META[trade], lines: groups.get(trade)! }));
};

// ───── Permit flag ─────
export const buildPermitFlag = (d: IntakeData): { likely: boolean; reason: string } => {
  const scope = scopeFor(d.scope);
  if (scope?.permitLikely) {
    const city = d.address?.city && !d.address.skipped ? d.address.city : "your jurisdiction";
    return {
      likely: true,
      reason: `${scope.label} typically requires permits in ${city}. We'll cross-check the records once your project is filed.`,
    };
  }
  if (scope && !scope.permitLikely) {
    return {
      likely: false,
      reason: "A design refresh stays inside finishes — usually permit-exempt. Always verify with your city.",
    };
  }
  // Fallback to the old heuristic
  const heavy =
    d.room === "addition" ||
    d.room === "full-home" ||
    d.painPoints.includes("Layout doesn't work") ||
    d.painPoints.includes("Bad flow") ||
    d.painPoints.includes("No island");
  return heavy
    ? { likely: true, reason: "Structural or MEP changes typically require city permits." }
    : { likely: false, reason: "Mostly cosmetic — likely permit-exempt, but always verify." };
};

// ───── Per-asset Space Analysis ─────
// Each block is keyed to a specific asset (or "general" if it's a holistic note).
// Designed to feel like a contractor's first read of the file, not generic copy.
export type SpaceAnalysisBlock = {
  id: string;
  scope: "video" | "photo" | "floorplan" | "measurements" | "general";
  title: string;
  body: string;
  observations?: string[];
  unknowns?: string[];
};

export const buildSpaceAnalysis = (d: IntakeData): SpaceAnalysisBlock[] => {
  const blocks: SpaceAnalysisBlock[] = [];
  const room = d.room ? ROOM_LABELS[d.room].toLowerCase() : "space";

  // Video walkthrough — the contractor-lens block
  const videos = d.media.filter((m) => m.kind === "video");
  videos.forEach((v, i) => {
    blocks.push({
      id: v.id,
      scope: "video",
      title: videos.length > 1 ? `Walkthrough video ${i + 1}` : "Walkthrough video",
      body: `What a contractor reads from this clip when they bid on your ${room}.`,
      observations: [
        "Flow & circulation — how the space connects to adjacent rooms.",
        "Approximate ceiling height and any soffits or beams visible.",
        "Natural light direction and time of day in the clip.",
        "Condition of existing finishes (cabinets, tile, flooring) at a glance.",
        "Visible MEP cues — outlets, vents, light fixtures, plumbing access.",
      ],
      unknowns: [
        "Wall construction (load-bearing vs partition) — confirmed only on site.",
        "Sub-floor and behind-wall condition.",
        "Exact dimensions — video is for read, not measurement.",
      ],
    });
  });

  // Photos
  const photos = d.media.filter((m) => m.kind === "photo");
  if (photos.length > 0) {
    blocks.push({
      id: "photos",
      scope: "photo",
      title: `${photos.length} reference photo${photos.length > 1 ? "s" : ""}`,
      body: `Photos pin down the trouble spots you flagged in the ${room}, so contractors aren't guessing on materials or condition.`,
      observations: [
        "Existing finishes and their wear — informs replace vs. refurbish.",
        "Trouble spots you specifically pointed the camera at.",
        "Surrounding context (adjacent rooms, sightlines) when included.",
      ],
      unknowns: photos.length < 3 ? ["More angles would help — corners, ceiling, the wall opposite the camera."] : undefined,
    });
  }

  // Floor plan
  const plans = d.media.filter((m) => m.kind === "floorplan");
  if (plans.length > 0) {
    blocks.push({
      id: "floorplan",
      scope: "floorplan",
      title: "Floor plan",
      body: "Floor plan lets contractors validate dimensions against scope before pricing.",
      observations: [
        "Room footprint and adjacencies.",
        "Window and door placement (light, egress, code).",
        "Probable wet-wall and electrical panel locations.",
      ],
      unknowns: ["Field-verify all dimensions — drawings and reality differ."],
    });
  }

  // Measurements (structured first, fallback to free text)
  const dimText = formatDimensions(d.dimensions);
  if (dimText) {
    const area = dimensionsArea(d.dimensions);
    blocks.push({
      id: "measurements",
      scope: "measurements",
      title: "Your measurements",
      body: `${dimText}${area ? ` · ~${area} sq ft` : ""}`,
      observations: ["Anchors the brief in real dimensions even without a formal plan."],
      unknowns: ["Contractor will field-verify on the walkthrough."],
    });
  } else if (d.measurements?.trim()) {
    blocks.push({
      id: "measurements",
      scope: "measurements",
      title: "Your measurements",
      body: d.measurements.trim(),
      observations: ["Anchors the brief in real dimensions even without a formal plan."],
      unknowns: ["Contractor will field-verify on the walkthrough."],
    });
  }

  // General / fallback
  if (blocks.length === 0) {
    blocks.push({
      id: "general",
      scope: "general",
      title: "Add media to sharpen this",
      body: "A 30-second walkthrough video is the single highest-leverage thing you can share — it lets your contractor read the space before they ever set foot in it.",
    });
  }

  return blocks;
};

// ───── Detailed Space Analysis (ClearContract-style sections) ─────
// This is the block that goes into the contractor's hands. Sections mirror
// how a GC actually reads a project: structure → finishes → constraints →
// opportunities → code. Items are derived deterministically from intake so
// nothing is fabricated.
export type AnalysisItem = { text: string; basis: "grounded" | "inferred" | "question" };
export type AnalysisSection = {
  key: string;
  title: string;
  description: string;
  items: AnalysisItem[];
};

export const buildAnalysisSections = (d: IntakeData): AnalysisSection[] => {
  const sections: AnalysisSection[] = [];
  const pain = (p: string) => d.painPoints.includes(p);
  const scope = scopeFor(d.scope);

  // 0. Walkthrough video read — what a contractor extracts from a 30–90s clip.
  // Mirrors the ClearContract approach: detected scene objects, structural cues,
  // light sources, condition flags. Honest about what the video CAN'T tell us.
  if (hasKind(d, "video")) {
    const videoItems: AnalysisItem[] = [
      { text: "Flow & circulation read — adjacencies, sightlines, choke points.", basis: "inferred" },
      { text: "Approximate ceiling height, soffits, and visible beams.", basis: "inferred" },
      { text: "Natural light direction and time-of-day cues.", basis: "inferred" },
      { text: "Existing finish condition at a glance — cabinets, tile, flooring.", basis: "inferred" },
      { text: "Visible MEP cues — outlets, vents, light fixtures, plumbing access.", basis: "inferred" },
      { text: "Sub-floor and behind-wall condition — verify on site.", basis: "question" },
      { text: "Exact dimensions — video reads, doesn't measure.", basis: "question" },
    ];
    sections.push({
      key: "video",
      title: "Walkthrough video read",
      description: "What a contractor extracts from the clip before the site visit. Best with a slow 30–90s pan in good daylight.",
      items: videoItems,
    });
  }

  // 1. Structural read
  const structural: AnalysisItem[] = [];
  if (d.room === "addition" || d.room === "full-home" || d.scope === "structural" || d.scope === "reconfigure") {
    structural.push({
      text: "Load-bearing assessment likely required — engage structural engineer before final bid.",
      basis: "inferred",
    });
  }
  if (pain("Cramped") || pain("Bad layout") || pain("Layout doesn't work") || pain("Bad flow")) {
    structural.push({
      text: "Possible wall removal — confirm header sizing and load path on site.",
      basis: "inferred",
    });
  }
  if (hasKind(d, "floorplan")) {
    structural.push({
      text: "Floor plan on file — use it as a baseline, then field-verify dimensions.",
      basis: "grounded",
    });
  }
  if (formatDimensions(d.dimensions)) {
    const area = dimensionsArea(d.dimensions);
    structural.push({
      text: `Footprint declared by homeowner: ${formatDimensions(d.dimensions)}${area ? ` (~${area} sq ft)` : ""}.`,
      basis: "grounded",
    });
  }
  if (structural.length === 0) {
    structural.push({
      text: "No structural changes implied yet — confirm on walkthrough.",
      basis: "question",
    });
  }
  sections.push({
    key: "structural",
    title: "Structural read",
    description: "What the bones of the project look like before you set foot inside.",
    items: structural,
  });

  // 2. Visible items & finishes
  const finishes: AnalysisItem[] = [];
  if (hasKind(d, "photo")) {
    finishes.push({
      text: "Reference photos on file — assess existing cabinets, tile, flooring, fixtures.",
      basis: "grounded",
    });
  }
  if (pain("Dated cabinets")) finishes.push({ text: "Cabinetry: replace (homeowner flagged dated).", basis: "grounded" });
  if (pain("Ugly tile")) finishes.push({ text: "Tile: full replacement, selections TBD.", basis: "grounded" });
  if (pain("Carpet needs to go")) finishes.push({ text: "Flooring: remove carpet, new substrate evaluation.", basis: "grounded" });
  if (pain("Dated finishes")) finishes.push({ text: "Hardware, fixtures, paint — refresh-level finishes pending homeowner spec.", basis: "inferred" });
  if (pain("Appliances need upgrading")) finishes.push({ text: "Appliance package: homeowner to spec models before final bid.", basis: "question" });
  if (finishes.length === 0) {
    finishes.push({
      text: "Existing finishes: condition unknown — request photos before bidding finish line items.",
      basis: "question",
    });
  }
  sections.push({
    key: "finishes",
    title: "Visible items & finishes",
    description: "Materials and finishes the homeowner wants kept, swapped, or replaced.",
    items: finishes,
  });

  // 3. Constraints
  const constraints: AnalysisItem[] = [];
  if (!d.budgetSkipped && d.budgetMin != null) {
    constraints.push({
      text: `Budget envelope: ${fmtMoney(d.budgetMin)} – ${fmtMoney(d.budgetMax)}.`,
      basis: "grounded",
    });
  } else {
    constraints.push({ text: "Budget not yet shared.", basis: "question" });
  }
  if (d.timeline) {
    const t = d.timeline === "asap" ? "Ready to start" : d.timeline === "1-3" ? "1–3 months" : d.timeline === "3-6" ? "3–6 months" : "Exploring";
    constraints.push({ text: `Timeline: ${t}.`, basis: "grounded" });
  }
  if (d.address?.city && !d.address.skipped) {
    constraints.push({
      text: `Jurisdiction: ${d.address.city}${d.address.state ? `, ${d.address.state}` : ""} — apply local permit rules and inspection cadence.`,
      basis: "grounded",
    });
  } else {
    constraints.push({
      text: "Address withheld — permit calendar and county fees can't be projected yet.",
      basis: "question",
    });
  }
  sections.push({
    key: "constraints",
    title: "Constraints",
    description: "What boxes the project must fit inside.",
    items: constraints,
  });

  // 4. Design opportunities
  const opps: AnalysisItem[] = [];
  if (pain("Too dark") || pain("Poor lighting") || pain("No natural light")) {
    opps.push({ text: "Layered lighting plan — ambient, task, accent zones.", basis: "inferred" });
  }
  if (pain("No island")) opps.push({ text: "Add island — define prep, seating, and rough-ins.", basis: "inferred" });
  if (pain("No bathtub")) opps.push({ text: "Reintroduce tub — soaking vs alcove decision.", basis: "inferred" });
  if (pain("No storage") || pain("Not enough storage") || pain("No closet space")) {
    opps.push({ text: "Built-in storage — itemize separately from base cabinetry.", basis: "inferred" });
  }
  if (opps.length === 0) {
    opps.push({ text: "Design direction TBD — explore on first walkthrough.", basis: "question" });
  }
  sections.push({
    key: "opportunities",
    title: "Design opportunities",
    description: "Where this project earns its keep aesthetically.",
    items: opps,
  });

  // 5. Code & permitting
  const code: AnalysisItem[] = [];
  if (scope?.permitLikely) {
    code.push({
      text: `${scope.label} typically requires city permits — plan submittal time into the schedule.`,
      basis: "inferred",
    });
  }
  if (d.room === "addition" || d.scope === "structural") {
    code.push({ text: "Title 24 energy compliance applies to additions.", basis: "inferred" });
  }
  if (pain("Bad ventilation")) {
    code.push({ text: "Code-compliant exhaust required for kitchens/baths.", basis: "inferred" });
  }
  if (pain("Energy inefficient")) {
    code.push({ text: "Insulation upgrade triggers Title 24 verification.", basis: "inferred" });
  }
  if (code.length === 0) {
    code.push({ text: "Likely permit-exempt — always verify locally.", basis: "inferred" });
  }
  sections.push({
    key: "code",
    title: "Code & permitting",
    description: "What the city is going to ask about.",
    items: code,
  });

  return sections;
};

// ───── Brief Readiness (the score) ─────
// Honest checklist. The score IS the sum of weights. Total possible = 100.
export const buildReadiness = (d: IntakeData): BriefReadiness => {
  const checks: { key: string; label: string; weight: number; have: boolean; nudge: string }[] = [
    { key: "room",     label: "The room you're working on",       weight: 10, have: Boolean(d.room),                                                        nudge: "Tell us which room — it grounds everything else." },
    { key: "video",    label: "A short walkthrough video",         weight: 22, have: hasKind(d, "video"),                                                    nudge: "A 30-second video is the single most helpful thing you can add." },
    { key: "photo",    label: "A few photos",                      weight: 12, have: hasKind(d, "photo"),                                                    nudge: "Snap a few photos of the trouble spots." },
    { key: "plan",     label: "Floor plan or rough measurements",  weight: 14, have: hasKind(d, "floorplan") || hasAnyMeasurements(d),                       nudge: "Drop a floor plan or jot a few measurements." },
    { key: "pain",     label: "What's bugging you about the space",weight: 10, have: d.painPoints.length >= 3,                                               nudge: "Name 3 things you'd love to fix." },
    { key: "scope",    label: "The kind of project this is",       weight: 10, have: Boolean(d.scope),                                                       nudge: "Pick the type of project that fits best." },
    { key: "budget",   label: "A budget you have in mind",         weight: 8,  have: !d.budgetSkipped && d.budgetMin != null,                                nudge: "Share a number if you have one — totally optional." },
    { key: "timeline", label: "When you'd like to start",          weight: 6,  have: Boolean(d.timeline),                                                    nudge: "Even 'just exploring' is helpful to know." },
    { key: "address",  label: "Your project address",              weight: 8,  have: Boolean(d.address?.city) && !d.address?.skipped,                        nudge: "Add the address to unlock neighborhood and permit info." },
  ];
  const score = checks.reduce((s, c) => s + (c.have ? c.weight : 0), 0);
  const have = checks.filter((c) => c.have).map(({ label, weight }) => ({ label, weight }));
  const missing = checks.filter((c) => !c.have).map(({ label, weight, nudge }) => ({ label, weight, nudge }));
  const level: BriefReadiness["level"] = score >= 75 ? "biddable" : score >= 50 ? "shareable" : "draft";
  return { score, level, have, missing };
};

export const readinessCopy = (level: BriefReadiness["level"]) =>
  level === "biddable"
    ? { headline: "Ready for contractors.", sub: "There's enough here for a contractor to quote with confidence." }
    : level === "shareable"
      ? { headline: "Good to share.", sub: "Solid enough to start a conversation — a few more details would lock it in." }
      : { headline: "Just getting started.", sub: "A couple more details and contractors will be able to bid with real confidence." };
