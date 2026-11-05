// analyze-space — Vision-grounded Space Analysis for the homeowner brief.
//
// Adapted from ClearContract Flow's `analyze-room` function, simplified for
// Haleo's brief use-case: we don't need furniture layouts, we need a
// contractor-readable read of the space (structure, finishes, constraints,
// opportunities, code) grounded in the actual photos / video frame / floor
// plan the homeowner uploaded.
//
// Input: { sessionId, intake, mediaUrls: [{ kind, url, mime }] }
// Output: { sections: [{ key, title, description, items: [{ text, basis }] }], summary, raw }
import { aiFetch } from "../_shared/ai.ts";
import { checkImage, MAX_TOTAL_BASE64, skippedNote } from "../_shared/images.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reading photos accurately is the moment homeowners judge Haleo by: use the stronger model.
const MODEL = "smart";
const MAX_PHOTOS = 6;
const MAX_FLOORPLANS = 2;
const MAX_VIDEO_FRAMES = 6;

type Basis = "grounded" | "inferred" | "question";

interface AnalysisItem {
  text: string;
  basis: Basis;
}
interface AnalysisSection {
  key: string;
  title: string;
  description: string;
  items: AnalysisItem[];
}
interface Finding {
  title: string;
  detail: string;
  why: string;
  next_step: string;
  kind: "working" | "attention" | "check";
  audience: "homeowner" | "contractor" | "both";
  basis: Basis;
  /** The image this came from, as a public URL the page can show. */
  photo_url: string | null;
}
interface AnalysisResult {
  summary: string;
  sections: AnalysisSection[];
  findings?: Finding[];
  /** Plain notes for the homeowner, e.g. a photo that couldn't be read. */
  notes?: string[];
}

const SYSTEM_PROMPT = `You are a senior general-contractor's estimator reviewing a homeowner's project brief (interior remodel OR addition / ADU / JADU).

Your job is to read the uploaded photos AND/OR architectural plans (floor plans, site plans, elevations) — combined with the homeowner's stated intake — and produce a CONTRACTOR-READABLE read of the project, grounded STRICTLY in what was provided.

WHEN ARCHITECTURAL PLANS ARE PROVIDED (additions / ADU / JADU):
- Read the plans like a permit-set reviewer. Call out: footprint and approximate square footage IF labeled, number of rooms, room program (bed/bath/kitchen/living), door & window schedule cues, ceiling heights if noted, foundation type if shown, structural callouts (shear walls, beams, posts), MEP routing if shown (panel, water heater, plumbing stacks), site setbacks, lot coverage, easements.
- Quote labels and dimensions you can literally read from the sheet (e.g. "Sheet A1.0 shows 24'-0" × 32'-0" footprint, ~768 sq ft").
- Note sheet types you see (A-series architectural, S-series structural, T-24 energy, etc.) and what's missing.
- For ADU/JADU specifically: flag state ADU law cues (parking exemption proximity to transit, owner-occupancy for JADU, kitchen requirements for JADU, separate entrance, fire-rated separation from primary dwelling).
- If plans are blurry, low-res, or partial, say so and mark items "question".

OUTPUT STRUCTURE — return exactly these 5 sections, in this order, using the keys provided:
1. key: "structural"      — title: "Structural read"             — bones, walls, openings, load paths, ceiling, floor system, foundation. For plans: framing callouts, beams, shear, foundation type.
2. key: "finishes"        — title: "Visible items & finishes"     — cabinetry, tile, flooring, counters, fixtures, hardware, appliances, condition. For plans: schedules / specs if shown, otherwise mark TBD.
3. key: "constraints"     — title: "Constraints"                  — timeline, jurisdiction, MEP access, site access, setbacks, lot coverage, anything that boxes the project in.
4. key: "opportunities"   — title: "Design opportunities"         — where the project earns its keep — light, layout, storage, flow, indoor-outdoor, rental income for ADUs.
5. key: "code"            — title: "Code & permitting"            — likely permits, code triggers (Title 24, egress, ventilation, electrical, ADU state law, fire separation), inspection cadence.

For each item set "basis":
- "grounded"  — directly visible in the photo / plan, OR explicitly stated by the homeowner. Quote what you see when relevant.
- "inferred"  — a reasonable read a contractor would make from what's visible/stated; must be field-verified.
- "question"  — an explicit unknown the contractor must answer before bidding.

ANTI-HALLUCINATION RULES (CRITICAL):
- Stick to the FACTS in the intake and what is literally visible in the supplied images / plans. Nothing else.
- Do NOT extrapolate scope. If the homeowner has not said "gut", "full remodel", "down to studs", "reconfigure", "move walls", "add fixtures", etc., DO NOT use those words or concepts. A single photo is NOT evidence of a gut remodel.
- Do NOT invent fixtures, rooms, dimensions, or features that are not visible or labeled.
- Do NOT invent finishes, materials, ages ("dated", "original 1970s tile") unless clearly visible. Avoid judgment words unless the user said so.
- The number and kind of media supplied bounds your confidence. With only 1 photo or a partial plan, most claims about the rest of the project are "question", not "grounded" or "inferred".
- If the scope tier is generic (e.g. "refresh", "mid", "premium") DO NOT translate that into specific work items the homeowner didn't ask for. Treat scope as a budget signal, not a work order.
- When in doubt, mark it as a "question". Under-claiming is always safer than over-claiming.

STYLE RULES:
- Be specific about what IS visible. "Sheet A2.1: 12'-0" wide great room with 9'-0" plate, two 6'-0" sliders to rear yard" beats "open layout" — but only say this if you actually see it.
- Detect 4–10 items per section when the inputs support it. With sparse inputs, fewer items is correct. Quality over count.
- Reference the homeowner's pain points, vision, permit status, and stated scope when they shape your read — don't go beyond them.
- If video frames are provided, treat them as time-of-day-anchored snapshots — call out lighting, finish condition, visible MEP cues; note exact dimensions can't come from video.
- NEVER mention budget, dollars, price ranges, or cost figures.
- The "summary" is one tight paragraph (≤ 80 words) — what a GC would tell their PM after glancing at the photos / plans. For an ADU/JADU plan set, lead with the project type, footprint if visible, and permit posture.

WHAT AN EXPERIENCED CONTRACTOR SCANS FOR IN EVERY PHOTO (look for each; report only what you can actually see):
- Water: stains or rings on ceilings and walls, bubbling paint, warped or swollen cabinet bases and flooring, rust at fixtures, failed caulk or grout at tubs, showers and sinks.
- Structure: cracks (note whether hairline or wider, and their direction), sagging ceilings, doors or windows out of square, sloping floors.
- Electrical: outlets near sinks or water and whether they look like GFCI (test buttons), two-prong outlets, few outlets along counters, extension cords or power strips doing permanent work, single ceiling fixture lighting a whole room.
- Air: bathroom exhaust fan present or not, range hood and whether it seems to vent outside, window ventilation.
- Plumbing and gas: visible shutoff valves, exposed or corroded pipes, gas range (knobs, pilot, flex line) versus electric, water heater type and venting if visible.
- Layout and light: walkways and clearances that look tight, where natural light comes from, ceiling height cues (soffits, low beams), storage that's missing or wasted.
- Finishes: what the surfaces are (tile, laminate, hardwood, LVP, stone), and visible condition (chips, wear, lifting, mismatched transitions).
- Signs of past work: patched drywall, mismatched materials, DIY-looking wiring or plumbing. Word these as questions ("worth asking whether this was permitted"), never accusations.
Never state a hidden condition as fact ("there is mold", "the wiring is unsafe"). Say what is visible and what it could mean: "dark staining under the sink, which can mean an old or active leak — worth checking before new cabinets go in".

FINDINGS — the homeowner-facing layer (also used by the contractor):
Return 4 to 10 "findings", the most useful things from the photos, written for a homeowner who is not in the trades:
- "title": short and plain, under 10 words ("Staining on the ceiling by the window").
- "detail": what you see, specifically, and where ("Brown ring about a foot wide, top left of photo 2").
- "why": why it matters for this project, in one sentence a homeowner understands.
- "next_step": one concrete action ("Ask your contractor to check for an active leak before you choose ceiling finishes").
- "kind": "working" for something good to keep or build on (great natural light, solid hardwood worth saving), "attention" for something likely to need work or change the bid, "check" for an unknown that someone should look at in person.
- "audience": "homeowner", "contractor" or "both".
- "basis": as above. "photo": the 1-based image number it comes from, or null.
Include at least one "working" finding when anything genuinely is (people should hear what's good about their home), but never invent praise. Order by usefulness. No prices, no brands, no code citations by number.

Return ONLY the tool call. No prose.`;

const ANALYZE_TOOL = {
  type: "function",
  function: {
    name: "emit_space_analysis",
    description: "Return the structured contractor-readable space analysis.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-paragraph GC summary, ≤80 words." },
        findings: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              why: { type: "string" },
              next_step: { type: "string" },
              kind: { type: "string", enum: ["working", "attention", "check"] },
              audience: { type: "string", enum: ["homeowner", "contractor", "both"] },
              basis: { type: "string", enum: ["grounded", "inferred", "question"] },
              photo: { type: ["integer", "null"] },
            },
            required: ["title", "detail", "why", "next_step", "kind", "audience", "basis"],
            additionalProperties: false,
          },
        },
        sections: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                enum: ["structural", "finishes", "constraints", "opportunities", "code"],
              },
              title: { type: "string" },
              description: { type: "string" },
              items: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    basis: { type: "string", enum: ["grounded", "inferred", "question"] },
                  },
                  required: ["text", "basis"],
                  additionalProperties: false,
                },
              },
            },
            required: ["key", "title", "description", "items"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "sections", "findings"],
      additionalProperties: false,
    },
  },
};

// ───── helpers ─────
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function buildIntakeBrief(intake: Record<string, unknown>): string {
  const room = asString(intake.room, "unspecified room");
  const scope = asString(intake.scope, "unspecified scope");
  const painPoints = Array.isArray(intake.painPoints) ? intake.painPoints.join(", ") : "";
  const dim = intake.dimensions as Record<string, unknown> | undefined;
  const dimText = dim
    ? [dim.length, dim.width, dim.height]
        .filter((v) => typeof v === "number" && v > 0)
        .join(" × ") + ` ${asString(dim.unit, "ft")}`
    : "not provided";
  const addr = intake.address as Record<string, unknown> | undefined;
  const addrText = addr && !addr.skipped
    ? [addr.city, addr.state, addr.zip].filter(Boolean).join(", ")
    : "withheld";
  const timeline = asString(intake.timeline, "unspecified");

  const lines = [
    `Project type: ${room}`,
    `Scope tier: ${scope}`,
    `Pain points: ${painPoints || "none stated"}`,
    `Stated dimensions: ${dimText}`,
    `Address / jurisdiction: ${addrText}`,
    `Timeline: ${timeline}`,
  ];

  // Addition / ADU / JADU specific context
  if (room === "addition") {
    const kind = asString(intake.additionKind);
    const permit = asString(intake.permitStatus);
    const size = typeof intake.additionSize === "number" ? `${intake.additionSize} sq ft` : "not provided";
    const vision = asString(intake.visionNote);
    lines.push(`Addition kind: ${kind || "unspecified"} (ADU = standalone accessory dwelling, JADU = junior ADU carved from existing home, addition = extra square footage attached to home)`);
    lines.push(`Permit status: ${permit || "unspecified"}`);
    lines.push(`Target size: ${size}`);
    if (vision) lines.push(`Homeowner vision: ${vision}`);
  }

  // NOTE: Budget is intentionally omitted from the model context. Haleo's
  // read should describe the space and the work — never the price tag.
  return lines.join("\n");
}

type FetchedImage =
  | { ok: true; dataUrl: string; base64Bytes: number }
  | { ok: false; reason: "unreachable" | "unsupported" | "too_large" };

// Fetch one image and check it the way Claude will: the real type from its
// bytes (not the label it was uploaded with) and its encoded size. A bad image
// is skipped with a reason, so it can't sink the whole read.
async function fetchImage(url: string): Promise<FetchedImage> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: "unreachable" };
    const buf = new Uint8Array(await res.arrayBuffer());
    const check = checkImage(buf);
    if (!check.ok) {
      console.warn(`Skipping image (${check.reason}, ${buf.byteLength} bytes): ${url}`);
      return { ok: false, reason: check.reason === "empty" ? "unreachable" : check.reason };
    }
    return { ok: true, dataUrl: `data:${check.type};base64,${encodeBase64(buf)}`, base64Bytes: check.base64Bytes };
  } catch (err) {
    console.error(`fetchImage failed for ${url}:`, err);
    return { ok: false, reason: "unreachable" };
  }
}

// Architectural plans frequently arrive as PDFs. Vision models can't render
// PDF data URLs reliably through the OpenAI-compatible shim, so we extract
// the textual layer (sheet titles, schedules, dimensions, callouts, notes)
// and surface it to the model as structured text. This is what lets Haleo
// actually "read" the plan and tell the homeowner what it sees.
async function extractPlanText(
  url: string,
  name: string,
): Promise<{ name: string; pages: number; text: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 80 * 1024 * 1024) {
      console.warn(`Skipping oversize PDF (${buf.byteLength} bytes): ${url}`);
      return null;
    }
    const pdf = await getDocumentProxy(buf);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const cleaned = (Array.isArray(text) ? text.join("\n") : text)
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 8000); // keep prompt reasonable
    return { name, pages: totalPages, text: cleaned };
  } catch (err) {
    console.error(`extractPlanText failed for ${url}:`, err);
    return null;
  }
}

function fallbackSections(
  intake: Record<string, unknown>,
  reason: "no_media" | "plan_unreadable" = "no_media",
): AnalysisResult {
  const summary =
    reason === "plan_unreadable"
      ? "Haleo couldn't read your plan PDF — it may be a scanned image or too large to parse. Try exporting a smaller PDF or adding a few photos so we can ground the read."
      : "No analyzable visuals on file yet. Add at least one photo, a short video, or a plan PDF to generate a grounded read.";
  const placeholder =
    reason === "plan_unreadable"
      ? "Awaiting a readable plan or a few photos."
      : "Awaiting photos to read.";
  return {
    summary,
    sections: [
      {
        key: "structural",
        title: "Structural read",
        description: "What the bones look like before site visit.",
        items: [{ text: placeholder, basis: "question" }],
      },
      {
        key: "finishes",
        title: "Visible items & finishes",
        description: "Materials and condition.",
        items: [{ text: placeholder, basis: "question" }],
      },
      {
        key: "constraints",
        title: "Constraints",
        description: "What boxes the project must fit inside.",
        items: [{ text: `Scope: ${asString(intake.scope, "TBD")}.`, basis: "grounded" }],
      },
      {
        key: "opportunities",
        title: "Design opportunities",
        description: "Where the project earns its keep aesthetically.",
        items: [{ text: "Design direction TBD — pending media.", basis: "question" }],
      },
      {
        key: "code",
        title: "Code & permitting",
        description: "What the city is going to ask about.",
        items: [{ text: "Verify locally based on scope.", basis: "inferred" }],
      },
    ],
  };
}

const FINDING_KINDS = ["working", "attention", "check"];
const AUDIENCES = ["homeowner", "contractor", "both"];

function normalizeFindings(raw: unknown, photoUrls: string[]): Finding[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .map((f) => {
      const title = asString(f?.title);
      const detail = asString(f?.detail);
      if (!title || !detail) return null;
      const n = typeof f.photo === "number" && Number.isInteger(f.photo) ? f.photo : null;
      return {
        title,
        detail,
        why: asString(f.why),
        next_step: asString(f.next_step),
        kind: (FINDING_KINDS.includes(asString(f.kind)) ? asString(f.kind) : "check") as Finding["kind"],
        audience: (AUDIENCES.includes(asString(f.audience)) ? asString(f.audience) : "both") as Finding["audience"],
        basis: (["grounded", "inferred", "question"].includes(asString(f.basis)) ? asString(f.basis) : "inferred") as Basis,
        photo_url: n && n >= 1 && n <= photoUrls.length ? photoUrls[n - 1] : null,
      } as Finding;
    })
    .filter(Boolean)
    .slice(0, 10) as Finding[];
}

function normalize(raw: unknown, intake: Record<string, unknown>): AnalysisResult {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sections = Array.isArray(src.sections) ? src.sections : [];
  const ALLOWED_KEYS = ["structural", "finishes", "constraints", "opportunities", "code"];
  const cleaned: AnalysisSection[] = sections
    .map((s) => {
      const sec = s as Record<string, unknown>;
      const key = asString(sec.key);
      if (!ALLOWED_KEYS.includes(key)) return null;
      const items = Array.isArray(sec.items)
        ? (sec.items as unknown[])
            .map((it) => {
              const i = it as Record<string, unknown>;
              const basis = ["grounded", "inferred", "question"].includes(asString(i.basis))
                ? (asString(i.basis) as Basis)
                : "inferred";
              const text = asString(i.text);
              return text ? { text, basis } : null;
            })
            .filter(Boolean) as AnalysisItem[]
        : [];
      if (items.length === 0) return null;
      return {
        key,
        title: asString(sec.title) || key,
        description: asString(sec.description),
        items,
      } as AnalysisSection;
    })
    .filter(Boolean) as AnalysisSection[];
  if (cleaned.length === 0) return fallbackSections(intake);
  return { summary: asString(src.summary), sections: cleaned };
}

// ───── handler ─────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      // Logged for us; the homeowner gets a plain sentence and a retry.
      JSON.stringify({ success: false, error: "Haleo's photo reader is offline for a moment. Try again shortly.", retryable: true, detail: "ANTHROPIC_API_KEY not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let analysisId: string | null = null;
  try {
    const body = await req.json();
    const sessionId = asString(body.sessionId);
    const intake = (body.intake ?? {}) as Record<string, unknown>;
    const mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls : [];

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: "sessionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Create analysis row (status=running)
    const { data: inserted, error: insertErr } = await supabase
      .from("space_analyses")
      .insert({
        session_id: sessionId,
        intake,
        media_urls: mediaUrls,
        status: "running",
        model: MODEL,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) throw new Error(`DB insert failed: ${insertErr?.message}`);
    analysisId = inserted.id;

    // 2. Build vision payload — photos, floor plans, then video frames
    const photos = mediaUrls.filter((m: { kind: string }) => m.kind === "photo").slice(0, MAX_PHOTOS);
    const allPlans = mediaUrls.filter((m: { kind: string }) => m.kind === "floorplan").slice(0, MAX_FLOORPLANS);
    // Image-format plans (jpg/png) go through vision. PDFs go through text
    // extraction since the OpenAI-compatible shim can't render PDF data URLs.
    const imagePlans = allPlans.filter((m: { mime?: string }) => (m.mime || "").startsWith("image/"));
    const pdfPlans = allPlans.filter((m: { mime?: string }) => (m.mime || "").includes("pdf"));
    const videoFrames = mediaUrls
      .filter((m: { kind: string }) => m.kind === "video_frame")
      .slice(0, MAX_VIDEO_FRAMES);
    const videos = mediaUrls.filter((m: { kind: string }) => m.kind === "video");

    const imageInputs: Array<{ url: string; mime?: string }> = [
      ...photos,
      ...imagePlans,
      ...videoFrames,
    ];
    const dataUrls: string[] = [];
    // The public URL of each image we actually send, in order, so a finding's
    // "photo 3" can show the homeowner that exact photo.
    const sentUrls: string[] = [];
    const sentKinds: string[] = [];
    const skipped = { too_large: 0, unsupported: 0, unreachable: 0, over_budget: 0 };
    let total = 0;
    for (const img of imageInputs as Array<{ url: string; kind?: string }>) {
      const got = await fetchImage(img.url);
      if (!got.ok) {
        skipped[got.reason]++;
        continue;
      }
      if (total + got.base64Bytes > MAX_TOTAL_BASE64) {
        skipped.over_budget++;
        continue;
      }
      total += got.base64Bytes;
      dataUrls.push(got.dataUrl);
      sentUrls.push(img.url);
      sentKinds.push(img.kind === "video_frame" ? "video still" : img.kind === "floorplan" ? "plan" : "photo");
    }
    const note = skippedNote(skipped);

    // Pull the textual layer out of any PDF plans so Haleo can actually
    // read sheet titles, schedules, dimensions, and notes.
    const planTexts: Array<{ name: string; pages: number; text: string }> = [];
    for (const p of pdfPlans) {
      const extracted = await extractPlanText(p.url, (p as { name?: string }).name || "Plan.pdf");
      if (extracted && extracted.text.length > 20) planTexts.push(extracted);
    }

    if (dataUrls.length === 0 && imageInputs.length > 0 && planTexts.length === 0) {
      // Everything they sent failed the checks: say so plainly, don't pretend.
      const msg = note ?? "We couldn't read those photos. Re-add them and Haleo will resize them automatically.";
      await supabase.from("space_analyses").update({ status: "error", error: msg }).eq("id", analysisId);
      return new Response(JSON.stringify({ success: false, error: msg, retryable: false, analysisId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dataUrls.length === 0 && videos.length === 0 && planTexts.length === 0) {
      // If the user attached PDFs but we couldn't extract any text, tell them
      // it's the PDF that's the problem — not "you uploaded nothing".
      const reason = pdfPlans.length > 0 ? "plan_unreadable" : "no_media";
      const result = fallbackSections(intake, reason);
      await supabase
        .from("space_analyses")
        .update({ status: "done", result, error: null })
        .eq("id", analysisId);
      return new Response(
        JSON.stringify({ success: true, analysisId, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let userText = `HOMEOWNER INTAKE:\n${buildIntakeBrief(intake)}\n\nMEDIA PROVIDED:\n- Photos attached: ${photos.length}\n- Image-format plans attached: ${imagePlans.length}\n- PDF plan sets parsed: ${planTexts.length}\n- Video walkthroughs sampled into ${videoFrames.length} still frame(s) (treat as time-anchored snapshots; do not estimate exact dimensions from them).`;

    if (planTexts.length > 0) {
      userText += `\n\n=== PLAN SHEET TEXT (extracted from uploaded PDF plans) ===\n`;
      for (const pt of planTexts) {
        userText += `\n--- File: ${pt.name} (${pt.pages} page${pt.pages === 1 ? "" : "s"}) ---\n${pt.text}\n`;
      }
      userText += `\n=== END PLAN SHEET TEXT ===\n\nIMPORTANT: The text above is extracted directly from the homeowner's plan PDFs. Quote sheet numbers, dimensions, room labels, and schedule entries you can literally read. Lead the "summary" with what kind of plan set this is (architectural, site, structural) and the headline footprint / room program if visible. Use the "structural" and "code" sections to specifically narrate what the plans show.`;
    }

    if (dataUrls.length > 0) {
      userText += `\n\nIMAGES ATTACHED, IN ORDER (use these numbers for "photo"):\n${sentKinds.map((k, i) => `${i + 1}. ${k}`).join("\n")}`;
    }
    userText += `\n\nRead every image closely before answering. Produce the structured analysis now: the 5 contractor sections and the homeowner findings.`;

    const userContent: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
    for (const url of dataUrls) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    // 3. Call Claude
    const aiRes = await aiFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANTHROPIC_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [ANALYZE_TOOL],
        tool_choice: { type: "function", function: { name: "emit_space_analysis" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText.slice(0, 400));
      // The homeowner sees a plain sentence and a Try again button; the
      // technical detail stays in the logs and the analyses table.
      const userMsg =
        aiRes.status === 429 || aiRes.status === 529 || aiRes.status >= 500
          ? "Haleo is busy right now. Try again in a moment."
          : "Haleo couldn't read these photos this time. Try again, or re-add the photos.";
      await supabase
        .from("space_analyses")
        .update({ status: "error", error: `AI ${aiRes.status}: ${errText.slice(0, 300)}` })
        .eq("id", analysisId);
      // `detail` is Anthropic's own error message (never the key): the page
      // doesn't show it, but it makes the next failure a one-minute diagnosis.
      let detail = `AI ${aiRes.status}`;
      try {
        const m = (JSON.parse(errText) as { error?: { message?: string } }).error?.message;
        if (m) detail = `AI ${aiRes.status}: ${m.slice(0, 200)}`;
      } catch {
        /* not JSON */
      }
      return new Response(
        JSON.stringify({ success: false, error: userMsg, retryable: true, analysisId, detail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const choice = Array.isArray(aiJson.choices) ? aiJson.choices[0] : undefined;
    const toolCalls = Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : [];
    const args = toolCalls[0]?.function?.arguments;
    let parsedRaw: unknown = null;
    if (typeof args === "string") {
      try {
        parsedRaw = JSON.parse(args);
      } catch (err) {
        console.error("Tool args JSON parse failed:", err);
      }
    } else if (typeof choice?.message?.content === "string") {
      const m = choice.message.content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsedRaw = JSON.parse(m[0]);
        } catch (err) {
          console.error("Content JSON parse failed:", err);
        }
      }
    }

    const result = normalize(parsedRaw, intake);
    const findings = normalizeFindings((parsedRaw as Record<string, unknown> | null)?.findings, sentUrls);
    if (findings.length) result.findings = findings;
    if (note) result.notes = [note];

    await supabase
      .from("space_analyses")
      .update({ status: "done", result, error: null })
      .eq("id", analysisId);

    return new Response(
      JSON.stringify({ success: true, analysisId, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("analyze-space error:", err);
    if (analysisId) {
      await supabase
        .from("space_analyses")
        .update({ status: "error", error: detail })
        .eq("id", analysisId)
        .then(() => undefined, () => undefined);
    }
    return new Response(
      JSON.stringify({ success: false, error: "Haleo couldn't finish reading your photos. Try again in a moment.", retryable: true, analysisId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
