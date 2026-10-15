// ADU brief generator.
// CRITICAL: receives base plan and annotation as EXPLICITLY LABELED, SEPARATE
// inputs to Claude vision. They are never combined into a single message.
// Claude's role is to compile a structured brief — it does NOT determine
// zoning rules, costs, or feasibility. Those come from the verified
// feasibility JSON passed in.

import { aiFetch } from "../_shared/ai.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BriefRequest {
  feasibility: Record<string, unknown>;
  base_plan_url: string | null;
  annotation_image_url: string | null;
  intended_scope: {
    adu_type: string;
    location_description: string;
    size_sqft: number;
    annotation_coordinates: unknown;
  };
  property: {
    address?: string | null;
    apn?: string | null;
    zip?: string | null;
  };
}

interface BriefSection {
  heading: string;
  body: string;
}

const SYSTEM_PROMPT = [
  "You compile contractor briefs for ADU projects from verified data.",
  "STRICT RULES:",
  "1. You receive TWO image inputs labeled '[BASE PLAN]' and '[ADDITION ANNOTATION]'.",
  "   - [BASE PLAN] is the existing structure only. NEVER treat it as intended scope.",
  "   - [ADDITION ANNOTATION] is what the homeowner wants to BUILD. Treat only this as intended scope.",
  "   - Never confuse the two. Never describe existing rooms as the addition.",
  "2. Do NOT determine zoning rules, size limits, setbacks, height, costs, or feasibility.",
  "   All such facts come from the provided feasibility JSON. Quote it; do not invent.",
  "3. If a field is null/missing, say information is unavailable. Never speculate.",
  "4. Inferred scope items (separate entrance, utility runs, parking) may be suggested but must be marked clearly as 'Items to confirm with contractor', not as requirements.",
  "5. Return JSON only, using the tool. No prose outside the tool call.",
].join(" ");

async function callClaude(body: BriefRequest): Promise<{ sections: BriefSection[]; questions: string[] } | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;

  const userParts: Array<Record<string, unknown>> = [
    {
      type: "text",
      text:
        "Compile an ADU contractor brief from the following inputs. The two images are STRICTLY SEPARATE — do not combine them.\n\n" +
        "VERIFIED FEASIBILITY JSON (use these facts verbatim; never override):\n" +
        JSON.stringify(body.feasibility, null, 2) +
        "\n\nINTENDED SCOPE (homeowner-stated):\n" +
        JSON.stringify(body.intended_scope, null, 2) +
        "\n\nPROPERTY:\n" +
        JSON.stringify(body.property, null, 2),
    },
  ];
  if (body.base_plan_url) {
    userParts.push({ type: "text", text: "[BASE PLAN — existing structure only, do NOT treat as intended scope]" });
    userParts.push({ type: "image_url", image_url: { url: body.base_plan_url } });
  }
  if (body.annotation_image_url) {
    userParts.push({
      type: "text",
      text: "[ADDITION ANNOTATION — this is what the homeowner wants to build, treat as intended scope only]",
    });
    userParts.push({ type: "image_url", image_url: { url: body.annotation_image_url } });
  }

  try {
    const res = await aiFetch({
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "smart",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userParts },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_brief",
              description: "Emit a structured ADU contractor brief.",
              parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    description:
                      "Brief sections in this order: Project overview, Property context, Intended addition, Scope of work, Inferred items to confirm, Known constraints and flags.",
                    items: {
                      type: "object",
                      properties: {
                        heading: { type: "string" },
                        body: { type: "string", description: "Plain English, 1-5 sentences." },
                      },
                      required: ["heading", "body"],
                      additionalProperties: false,
                    },
                  },
                  questions: {
                    type: "array",
                    description: "5-8 specific questions the contractor should answer in their bid.",
                    items: { type: "string" },
                  },
                },
                required: ["sections", "questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_brief" } },
      }),
    });
    if (!res.ok) {
      console.error("claude brief failed", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return null;
    return JSON.parse(call.function.arguments);
  } catch (e) {
    console.error("claude brief error", e);
    return null;
  }
}

function fallbackBrief(body: BriefRequest): { sections: BriefSection[]; questions: string[] } {
  const f = body.feasibility as Record<string, unknown>;
  const intent = body.intended_scope;
  return {
    sections: [
      {
        heading: "Project overview",
        body: `Homeowner is exploring a ${intent.adu_type.replace("_", " ")} ADU, approximately ${intent.size_sqft} sqft. ${intent.location_description ? `Preferred location: ${intent.location_description}.` : ""}`,
      },
      {
        heading: "Property context",
        body: `Address: ${body.property.address ?? "unavailable"}. APN: ${body.property.apn ?? "unavailable"}. ZIP: ${body.property.zip ?? "unavailable"}.`,
      },
      {
        heading: "Intended addition",
        body: `${intent.adu_type.replace("_", " ")} — ~${intent.size_sqft} sqft. Location per homeowner: ${intent.location_description || "see attached annotation"}.`,
      },
      {
        heading: "Scope of work",
        body: "Standard ADU permit-set, foundation, framing, electrical/plumbing/HVAC, finishes, separate entrance, utility connection.",
      },
      {
        heading: "Inferred items to confirm",
        body: "Separate utility metering vs sub-metering, parking treatment, side-yard access for construction, drainage plan.",
      },
      {
        heading: "Known constraints and flags",
        body: Array.isArray(f.flags) && (f.flags as string[]).length > 0 ? (f.flags as string[]).join(" • ") : "None on file.",
      },
    ],
    questions: [
      "What is your typical timeline from contract to final inspection for an ADU of this size?",
      "Do you handle the San Jose permit submittal in-house?",
      "Can you provide three completed ADU references in San Jose with permit numbers?",
      "What is included in your base bid vs change-order scope?",
      "How do you handle utility connections and meter coordination?",
      "What is your warranty period on workmanship and systems?",
    ],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as BriefRequest;
    if (!body || !body.intended_scope) {
      return new Response(JSON.stringify({ error: "intended_scope is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const brief = (await callClaude(body)) ?? fallbackBrief(body);
    return new Response(JSON.stringify({ brief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("generate-adu-brief failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
