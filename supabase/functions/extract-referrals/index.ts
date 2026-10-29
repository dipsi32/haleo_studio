// Pull contractor recommendations out of whatever the homeowner has: a pasted
// Nextdoor or Reddit thread, a neighborhood WhatsApp chat, text messages, or
// screenshots of any of those. Returns each contractor once, with what people
// actually said about them, so the shortlist page can check them against
// public records.
//
// Input:  { text?: string, images?: { media_type: string, data: string }[] }
//         (images are base64, already downscaled by the client)
// Output: { ok: true, candidates: Candidate[] } | { ok: false, error }
//
// Nothing here is stored. The model only reads what the homeowner pasted.
import { aiFetch } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEXT = 40_000;
const MAX_IMAGES = 6;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SYSTEM_PROMPT = `You read neighborhood threads and messages where people recommend home-improvement contractors, and you list the contractors mentioned.

Rules:
- One entry per distinct business or person. Merge spelling variants and nicknames of the same contractor ("Mike's Plumbing", "Mike from Mikes plumbing").
- Only contractors, tradespeople, designers or builders. Skip the person asking, skip platforms (Yelp, Angi, Nextdoor), skip big-box stores.
- Copy phone numbers, emails, websites and CSLB license numbers exactly as written. Never invent or complete one.
- For each contractor, quote what people said, verbatim and short (under 160 characters each), at most 4 quotes. Mark each quote positive, negative or mixed.
- mention_count is how many separate people mentioned them.
- trade is your short read of what they do ("general contractor", "plumber", "kitchen remodel"), or null if unclear.
- If nothing in the input names a contractor, return an empty list.`;

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "emit_contractors",
    description: "The contractors mentioned in the input.",
    parameters: {
      type: "object",
      properties: {
        candidates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Business name if given, else the person's name" },
              person: { type: ["string", "null"], description: "Owner or contact person, if different from name" },
              trade: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              website: { type: ["string", "null"] },
              license_number: { type: ["string", "null"], description: "CSLB license number, digits only, only if written" },
              mention_count: { type: "integer", minimum: 1 },
              quotes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    sentiment: { type: "string", enum: ["positive", "negative", "mixed"] },
                  },
                  required: ["text", "sentiment"],
                },
              },
            },
            required: ["name", "mention_count", "quotes"],
          },
        },
      },
      required: ["candidates"],
    },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ ok: false, error: "AI is not configured yet." }, 503);

  let body: { text?: unknown; images?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Send JSON." }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  const images = Array.isArray(body.images)
    ? (body.images as { media_type?: unknown; data?: unknown }[])
        .filter((i) => typeof i?.data === "string" && typeof i?.media_type === "string" && IMAGE_TYPES.has(i.media_type as string))
        .slice(0, MAX_IMAGES) as { media_type: string; data: string }[]
    : [];

  if (!text && images.length === 0) return json({ ok: false, error: "Paste some text or add a screenshot." }, 400);

  const userContent: unknown[] = [];
  if (text) userContent.push({ type: "text", text: `Here is what I collected:\n\n${text}` });
  for (const img of images) {
    userContent.push({ type: "image_url", image_url: { url: `data:${img.media_type};base64,${img.data}` } });
  }
  userContent.push({ type: "text", text: "List every contractor mentioned, using the emit_contractors tool." });

  try {
    const aiRes = await aiFetch({
      headers: { Authorization: `Bearer ${ANTHROPIC_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "fast",
        max_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "emit_contractors" } },
      }),
    });
    if (!aiRes.ok) {
      const detail = (await aiRes.text()).slice(0, 300);
      console.error("extract-referrals AI error", aiRes.status, detail);
      return json({ ok: false, error: aiRes.status === 429 ? "Busy right now. Try again in a minute." : "Couldn't read that. Try again." }, 502);
    }
    const out = await aiRes.json();
    const args = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === "string" ? JSON.parse(args) : null;
    const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    return json({ ok: true, candidates });
  } catch (e) {
    console.error("extract-referrals failed", e);
    return json({ ok: false, error: "Couldn't read that. Try again." }, 500);
  }
});
