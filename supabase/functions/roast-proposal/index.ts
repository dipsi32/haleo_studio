// Remodel Roast — anonymous, fun, viral. Reuses analyze-pricing under the hood,
// then asks the LLM to produce a brutally-honest, color-coded JSON roast.

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Upload a screenshot or PDF of your quote." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Run the full pricing analysis (extracts line items, builds market range, captures benchmark)
    const pricingResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-pricing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(parsed.data),
    });
    if (!pricingResp.ok) {
      const err = await pricingResp.text();
      throw new Error(`Pricing analysis failed: ${err}`);
    }
    const pricing = await pricingResp.json();

    const { extractedProposal, marketRange, proposalAnalysis } = pricing;
    const total = extractedProposal.totalCost;
    const avg = marketRange.average;
    const ratio = total / Math.max(avg, 1);

    // 2. Compute a roast score (0=ripped off, 100=steal)
    // Below market → 80-100, fair → 55-79, above → 30-54, way above → 0-29
    let score: number;
    if (ratio <= 0.85) score = Math.round(85 + Math.min(15, (0.85 - ratio) * 50));
    else if (ratio <= 1.15) score = Math.round(78 - (ratio - 0.85) * 80); // 78 → 54
    else if (ratio <= 1.4) score = Math.round(54 - (ratio - 1.15) * 100); // 54 → 29
    else score = Math.max(1, Math.round(29 - (ratio - 1.4) * 60));
    score = Math.max(1, Math.min(100, score));

    const tier =
      score >= 80 ? { label: "Steal of the Century", color: "emerald", emoji: "🟢" }
      : score >= 60 ? { label: "Fair & Square", color: "lime", emoji: "🟢" }
      : score >= 40 ? { label: "Hmm… Negotiable", color: "amber", emoji: "🟡" }
      : score >= 20 ? { label: "Yikes Territory", color: "orange", emoji: "🟠" }
      : { label: "Full-On Ripped Off", color: "red", emoji: "🔴" };

    // 3. Ask Gemini for the actual roast — line-by-line burns + one-liner + share text
    const lineItemBlock = (extractedProposal.lineItems || [])
      .slice(0, 12)
      .map((li: any) => `- ${li.item}: $${Number(li.cost).toLocaleString()}`)
      .join("\n");

    const roastPrompt = `You are Quinn — Haleo's renovation roastmaster. Brutally honest, very funny, never mean-spirited, never personal. You roast PRICES and SCOPE, not people. Sharp wit, fast lines, occasional dad joke. No emojis in your text (we add them in UI).

CONTEXT:
- Project: ${extractedProposal.spaceType} ${extractedProposal.scope}
- Quote total: $${total.toLocaleString()}
- Market range for this work: $${marketRange.low.toLocaleString()} – $${marketRange.high.toLocaleString()} (avg $${avg.toLocaleString()})
- Verdict tier: "${tier.label}" (score ${score}/100)
- Line items:
${lineItemBlock || "(no line items extracted — quote was a single number)"}

Return ONLY valid JSON, no markdown, with this exact shape:
{
  "headline": "<6-10 word punchy verdict. e.g. 'You are not getting ripped off. Sign it.'>",
  "oneLiner": "<25-40 word roast that captures the overall vibe. Specific to THIS quote. Reference a real number or item.>",
  "lineRoasts": [
    { "item": "<line item name>", "cost": <number>, "burn": "<one sentence, 12-25 words, comparing the price to the market or to something absurd. Be SPECIFIC and funny.>", "verdict": "fair" | "high" | "low" | "wtf" }
  ],
  "shareCaption": "<60-100 char tweet-style share line WITHOUT hashtags. Should make people want to click. Include the score.>",
  "advice": "<one sentence of actual, useful advice the homeowner can act on tomorrow.>"
}

Rules:
- Generate 3-5 lineRoasts max, picking the most interesting items (highest, lowest, or weirdest).
- If no line items, return lineRoasts: [] and pour the wit into oneLiner.
- "wtf" verdict is for items >50% over market norms.
- Never mention specific contractor names.
- Tone: think Anthony Bourdain reviewing a contractor quote. Honest, warm, sharp.`;

    const roastResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are Quinn, Haleo's renovation roastmaster. Output ONLY valid JSON." },
          { role: "user", content: roastPrompt },
        ],
        temperature: 0.85,
        max_tokens: 1200,
      }),
    });

    let roast = {
      headline: tier.label,
      oneLiner: `Your $${total.toLocaleString()} quote lands in the ${tier.label.toLowerCase()} zone for a ${extractedProposal.spaceType} ${extractedProposal.scope}.`,
      lineRoasts: [] as any[],
      shareCaption: `My contractor quote scored ${score}/100 on Haleo's Remodel Roast. ${tier.label}.`,
      advice: "Compare against at least two more quotes before you sign anything.",
    };

    if (roastResp.ok) {
      try {
        const d = await roastResp.json();
        const raw = d.choices?.[0]?.message?.content || "";
        const cleaned = raw.replace(/```(?:json)?/g, "").trim();
        const s = cleaned.indexOf("{");
        const e = cleaned.lastIndexOf("}");
        if (s >= 0 && e > s) {
          roast = { ...roast, ...JSON.parse(cleaned.slice(s, e + 1)) };
        }
      } catch (e) { console.error("Roast parse failed:", e); }
    }

    return new Response(JSON.stringify({
      score,
      tier,
      roast,
      summary: {
        contractor: "Anonymous Contractor", // we strip the name in the UI for the public roast
        spaceType: extractedProposal.spaceType,
        scope: extractedProposal.scope,
        total,
        marketLow: marketRange.low,
        marketHigh: marketRange.high,
        marketAverage: avg,
        ratio: Math.round(ratio * 100),
        percentileRank: proposalAnalysis.percentileRank,
        zipCode: extractedProposal.zipCode,
      },
      lineItems: extractedProposal.lineItems || [],
      sources: pricing.sources || [],
      confidence: pricing.confidence,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("roast-proposal error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
