// Pure brief generators — kept out of the page so they're testable and honest.
// Rule: every line must be grounded in user input. Anything inferred is tagged.
import { ROOM_LABELS, type IntakeData, hasKind } from "@/lib/intake";

export type ContractorLine = {
  text: string;
  /**
   * grounded  → directly stated by the homeowner (room, pain point they ticked, file they uploaded, etc.)
   * inferred  → reasonable next step a contractor would take given the input — must be verified on site
   * question  → an explicit unknown the contractor needs to answer before bidding
   */
  basis: "grounded" | "inferred" | "question";
  source?: string; // short tag of where it came from, e.g. "Pain: Too dark" or "Room: Kitchen"
};

export type BriefReadiness = {
  score: number; // 0–100
  level: "draft" | "shareable" | "biddable";
  have: { label: string; weight: number }[]; // what counted
  missing: { label: string; weight: number; nudge: string }[]; // what would sharpen it
};

const fmtMoney = (v?: number) => (v == null ? "" : v >= 500 ? "$500K+" : `$${v}K`);

// ───── Homeowner layer ─────
// First-person, only uses words/choices the user actually made.
export const buildHomeownerLayer = (d: IntakeData): string => {
  const room = d.room ? ROOM_LABELS[d.room].toLowerCase() : "space";
  const pains = d.painPoints.slice(0, 3).map((p) => p.toLowerCase());
  const vibes = d.vibes.slice(0, 2).map((v) => v.toLowerCase());

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

  const vibeLine =
    vibes.length > 0
      ? `We want it to feel ${vibes.join(" and ")}.`
      : "";

  return [opener, painsLine, vibeLine].filter(Boolean).join(" ");
};

// ───── Contractor layer (honest) ─────
// Each line is tagged. Page renders the tag as a chip so the homeowner can see what's grounded vs inferred.
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
    });
    lines.push({
      text: "Full scope: foundation, framing, roof tie-in, MEP rough-in, insulation, finishes.",
      basis: "inferred",
      source: "Standard for any addition — verify with structural & Title 24 review",
    });
  } else if (d.room === "full-home") {
    lines.push({
      text: "Whole-home renovation — phasing TBD.",
      basis: "grounded",
      source: "Room: Full home",
    });
  } else if (d.room) {
    lines.push({
      text: `${ROOM_LABELS[d.room]} renovation.`,
      basis: "grounded",
      source: `Room: ${ROOM_LABELS[d.room]}`,
    });
  }

  // Pain → scope mapping. Only when the user explicitly ticked the pain.
  // Each line phrased as "homeowner reports X → contractor should investigate Y"
  const pain = (p: string) => d.painPoints.includes(p);

  if (pain("Too dark") || pain("Poor lighting") || pain("No natural light")) {
    lines.push({
      text: "Lighting plan in scope — fixture count, zoning, and dimming TBD on walkthrough.",
      basis: "inferred",
      source: `Pain: ${[pain("Too dark") && "Too dark", pain("Poor lighting") && "Poor lighting", pain("No natural light") && "No natural light"].filter(Boolean).join(", ")}`,
    });
  }
  if (pain("Cramped") || pain("Bad layout") || pain("Layout doesn't work") || pain("Bad flow")) {
    lines.push({
      text: "Layout reconfiguration on the table — load-path and header sizing to be confirmed.",
      basis: "inferred",
      source: "Pain: layout/flow",
    });
  }
  if (pain("No island")) {
    lines.push({
      text: "Island addition — needs plumbing/electrical rough-in if relocating sink or prep zone.",
      basis: "inferred",
      source: "Pain: No island",
    });
  }
  if (pain("Dated cabinets") || pain("No storage") || pain("Not enough storage") || pain("No closet space")) {
    lines.push({
      text: "Cabinetry / built-in storage to be itemized separately from countertops.",
      basis: "inferred",
      source: "Pain: storage/cabinets",
    });
  }
  if (pain("Appliances need upgrading")) {
    lines.push({
      text: "Appliance package replacement — homeowner to spec models before final bid.",
      basis: "question",
      source: "Pain: Appliances need upgrading",
    });
  }
  if (pain("Tiny shower") || pain("No bathtub")) {
    lines.push({
      text: "Wet-area reconfiguration — waterproofing, drain relocation, supply lines.",
      basis: "inferred",
      source: "Pain: shower/tub",
    });
  }
  if (pain("Single vanity")) {
    lines.push({
      text: "Double-vanity install — confirm minimum 60\" wall and dual P-traps.",
      basis: "inferred",
      source: "Pain: Single vanity",
    });
  }
  if (pain("Bad ventilation")) {
    lines.push({
      text: "Exhaust ventilation upgrade — humidity-sensing fan recommended.",
      basis: "inferred",
      source: "Pain: Bad ventilation",
    });
  }
  if (pain("Dated finishes") || pain("Dated cabinets") || pain("Ugly tile") || pain("Carpet needs to go")) {
    lines.push({
      text: "Finish replacement — selections pending homeowner.",
      basis: "question",
      source: "Pain: dated finishes",
    });
  }
  if (pain("Energy inefficient")) {
    lines.push({
      text: "Insulation / envelope upgrade — Title 24 calcs likely required.",
      basis: "inferred",
      source: "Pain: Energy inefficient",
    });
  }

  // What we have on file
  if (hasKind(d, "video")) {
    lines.push({
      text: "Walkthrough video on file — review before site visit for flow, ceiling, finishes.",
      basis: "grounded",
      source: "Walkthrough video",
    });
  }
  if (hasKind(d, "floorplan")) {
    lines.push({
      text: "Floor plan on file — dimensions to be field-verified.",
      basis: "grounded",
      source: "Floor plan",
    });
  }
  if (d.measurements?.trim()) {
    lines.push({
      text: `Homeowner measurements provided: "${d.measurements.trim().slice(0, 140)}${d.measurements.length > 140 ? "…" : ""}"`,
      basis: "grounded",
      source: "Measurements",
    });
  }

  // Constraints
  if (!d.budgetSkipped && d.budgetMin != null) {
    lines.push({
      text: `Target budget: ${fmtMoney(d.budgetMin)} – ${fmtMoney(d.budgetMax)}.`,
      basis: "grounded",
      source: "Budget",
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
    lines.push({ text: `Timeline: ${t}.`, basis: "grounded", source: "Timeline" });
  }

  // Open questions — the things we genuinely don't know
  if (!hasKind(d, "video") && !hasKind(d, "floorplan") && !d.measurements?.trim()) {
    lines.push({
      text: "No walkthrough, floor plan, or measurements on file — site visit required before any line-item bid.",
      basis: "question",
    });
  }
  if (d.budgetSkipped || d.budgetMin == null) {
    lines.push({
      text: "Budget not shared — homeowner will share range after first conversation.",
      basis: "question",
    });
  }

  return lines;
};

// ───── Permit flag ─────
export const buildPermitFlag = (d: IntakeData): { likely: boolean; reason: string } => {
  const heavy =
    d.room === "addition" ||
    d.room === "full-home" ||
    d.painPoints.includes("Layout doesn't work") ||
    d.painPoints.includes("Bad flow") ||
    d.painPoints.includes("No island");
  return heavy
    ? { likely: true, reason: "Structural or MEP changes typically require San Jose permits." }
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

  // Measurements
  if (d.measurements?.trim()) {
    blocks.push({
      id: "measurements",
      scope: "measurements",
      title: "Your measurements",
      body: d.measurements.trim(),
      observations: ["Anchors the brief in real dimensions even without a formal plan."],
      unknowns: ["Contractor will still field-verify on the walkthrough."],
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

// ───── Brief Readiness (the score) ─────
// Honest checklist. The score IS the sum of weights. Total possible = 100.
export const buildReadiness = (d: IntakeData): BriefReadiness => {
  const checks: { key: string; label: string; weight: number; have: boolean; nudge: string }[] = [
    { key: "room", label: "Room or scope chosen", weight: 10, have: Boolean(d.room), nudge: "Pick a room to anchor the brief." },
    { key: "video", label: "Walkthrough video", weight: 22, have: hasKind(d, "video"), nudge: "Add a 30s video — the single biggest signal for contractors." },
    { key: "photo", label: "Reference photos", weight: 12, have: hasKind(d, "photo"), nudge: "Snap a few photos of the trouble spots." },
    { key: "plan", label: "Floor plan or measurements", weight: 14, have: hasKind(d, "floorplan") || Boolean(d.measurements?.trim()), nudge: "Add a floor plan or rough measurements." },
    { key: "pain", label: "Pain points named", weight: 12, have: d.painPoints.length >= 3, nudge: "Tag at least 3 things bugging you about the space." },
    { key: "vibe", label: "Vibe direction", weight: 10, have: d.vibes.length >= 2, nudge: "Pick 2+ vibes so contractors get the feel." },
    { key: "budget", label: "Budget range", weight: 10, have: !d.budgetSkipped && d.budgetMin != null, nudge: "A range — even rough — keeps bids realistic." },
    { key: "timeline", label: "Timeline anchored", weight: 10, have: Boolean(d.timeline), nudge: "Even 'just exploring' counts." },
  ];
  const score = checks.reduce((s, c) => s + (c.have ? c.weight : 0), 0);
  const have = checks.filter((c) => c.have).map(({ label, weight }) => ({ label, weight }));
  const missing = checks.filter((c) => !c.have).map(({ label, weight, nudge }) => ({ label, weight, nudge }));
  const level: BriefReadiness["level"] = score >= 75 ? "biddable" : score >= 50 ? "shareable" : "draft";
  return { score, level, have, missing };
};

export const readinessCopy = (level: BriefReadiness["level"]) =>
  level === "biddable"
    ? { headline: "Biddable.", sub: "Contractors can quote the same scope from this brief." }
    : level === "shareable"
      ? { headline: "Shareable.", sub: "Good enough to start a conversation — a few additions would lock it down." }
      : { headline: "Draft.", sub: "Add a couple more details and contractors will bid with real confidence." };
