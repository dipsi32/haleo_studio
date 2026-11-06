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
import { normalizeSpaceRead, siteBriefSections, SPACE_READ_TOOL, type SpaceRead } from "../_shared/spaceRead.ts";
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
  /** The compact read: headline, what we noticed, one-tap questions, the site brief. */
  read?: SpaceRead;
}

const SYSTEM_PROMPT = `You are a senior general contractor looking at a homeowner's photos (and any plans) before a first site visit. You write a SHORT read with two readers in mind:
- The homeowner, who should understand it in 15 seconds and answer a few one-tap questions.
- The contractor, who should walk in prepared: likely work by trade, watch-outs, what to check on site, a rough size and duration.

Brevity is the product. Every line must help someone decide or act. Leave out anything that doesn't: furniture, generic advice, obvious facts, and anything you would have to guess at.

WHAT TO LOOK FOR (report only what you can actually see, and only the few things that matter most):
- Water: stains, bubbling paint, swollen cabinet bases or floors, failed caulk or grout.
- Structure: cracks, sagging, out-of-square openings, exposed framing that likely carries load.
- Electrical: lighting that can't serve the room, outlets near water (GFCI?), few outlets, cords doing permanent work.
- Air: missing exhaust fans or range hoods.
- Plumbing and gas: visible shutoffs, corroded pipes, gas vs electric cooking.
- Layout and light: where daylight comes from, tight clearances, wasted or missing storage.
- Finishes worth keeping, and finishes that will likely be replaced.
- Signs of past work, worded as questions, never accusations.
Never state a hidden condition as fact. Say what is visible and what it could mean.

PLANS (additions, ADUs, JADUs): read them like a permit reviewer. Quote dimensions, sheet numbers and room labels you can literally read. Put what matters into likely_work, watch_outs and check_on_site. If plans are blurry or partial, say so in a question.

STAY HONEST:
- Use only the homeowner's stated intake and what is visible. One photo is not evidence of a gut remodel; do not invent scope, rooms, dimensions, materials or ages.
- With little to go on, ask instead of guessing: put it in questions or check_on_site.
- No prices, no dollar figures, no brands, no code section numbers.

RETURN (via the tool):
- headline: one plain sentence, at most 16 words. What this space is and the one thing that matters most for the project. e.g. "A dark, character-rich kitchen. Better lighting is the quickest win."
- noticed: at most 3, the most decision-relevant things in the photos. kind "good" (worth keeping or building on; include one if anything genuinely is), "watch" (likely needs work or changes the bid), "unknown" (can't tell from the photo). title at most 8 words; note at most 20 words, saying what you see and why it matters. photo: the 1-based image number.
- questions: 2 or 3 questions ONLY the homeowner can answer, prompted by what you see or can't see in THESE photos, whose answers would change the contractor's plan or price. Each answerable in one tap: 2 to 4 short options (at most 4 words each), always including "Not sure" when it could apply. Plain words. e.g. "Is there a window on the walls we can't see?" [Yes, one / Yes, several / No / Not sure]. why: at most 16 words, for the contractor.
- photo_request: if one more photo would clearly help, what it should show, at most 10 words ("the other walls, especially any windows"); otherwise null.
- site_brief, for the contractor:
  - likely_work: at most 5 items, each one trade and at most 14 words, tied to what the homeowner asked for and what you see. basis: grounded (seen or stated), inferred, or question.
  - watch_outs: at most 3, things that could change scope, structure, permits or price. At most 22 words each.
  - check_on_site: at most 4 short items only a visit can settle.
  - job_size: small (days, one trade), medium (weeks, a few trades), large (months, structure or many trades), or unclear.
  - trades: the trades likely involved.
  - duration: rough working time, e.g. "about 2–4 weeks", or "unclear". This is an estimate the page labels as ours.

Return ONLY the tool call.`;

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
      userText += `\n=== END PLAN SHEET TEXT ===\n\nIMPORTANT: The text above is extracted directly from the homeowner's plan PDFs. Quote sheet numbers, dimensions, room labels, and schedule entries you can literally read. Lead the "summary" with what kind of plan set this is (architectural, site, structural) and the headline footprint / room program if visible. Put what the plans show into likely_work, watch_outs and check_on_site.`;
    }

    if (dataUrls.length > 0) {
      userText += `\n\nIMAGES ATTACHED, IN ORDER (use these numbers for "photo"):\n${sentKinds.map((k, i) => `${i + 1}. ${k}`).join("\n")}`;
    }
    userText += `\n\nRead every image closely, then return the short read: headline, at most 3 things noticed, 2 or 3 one-tap questions, and the site brief.`;

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
        max_tokens: 2500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [SPACE_READ_TOOL],
        tool_choice: { type: "function", function: { name: "emit_space_read" } },
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

    const read = normalizeSpaceRead(parsedRaw, sentUrls);
    if (!read) {
      const detail = "AI returned no usable read";
      await supabase.from("space_analyses").update({ status: "error", error: detail }).eq("id", analysisId);
      return new Response(
        JSON.stringify({ success: false, error: "Haleo couldn't read these photos this time. Try again, or re-add the photos.", retryable: true, analysisId, detail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // The compact read, plus the same thing as sections for screens that
    // render sections (the contractor inbox, older briefs).
    const result: AnalysisResult = {
      summary: read.headline,
      sections: siteBriefSections(read.site_brief),
      read,
    };
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
