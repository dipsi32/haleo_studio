// Remodel Roast — anonymous, fun, viral. Reuses analyze-pricing under the hood,
// then asks the LLM to produce a brutally-honest, color-coded JSON roast.

import { aiFetch } from "../_shared/ai.ts";
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
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

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
      score >= 80 ? { label: "Below market", color: "emerald" }
      : score >= 60 ? { label: "Fair", color: "lime" }
      : score >= 40 ? { label: "A little high", color: "amber" }
      : score >= 20 ? { label: "Notably high", color: "orange" }
      : { label: "Way over", color: "red" };

    // 3. Ask Claude for the roast in Haleo's voice — calm, evidence-led, no theater.
    const lineItemBlock = (extractedProposal.lineItems || [])
      .slice(0, 12)
      .map((li: any) => `- ${li.item}: $${Number(li.cost).toLocaleString()}`)
      .join("\n");

    const roastPrompt = `You are Haleo. You write like a sharp friend who has seen this movie a hundred times. Bold, calm, honest, helpful. You roast PRICES and SCOPE, never people. You back every claim with the actual market range, not adjectives.

VOICE RULES (strict):
- A little wit is allowed in the headline and line verdicts when the numbers earn it. Dry, knowing, never mean. Think "fair, sign it" or "this backsplash is doing too much for $12k". Never cruel, never theatrical.
- Banned words and phrases: "ripped off", "WTF", "yikes", "paranoid", "saint", "criminal", "shady", "scam", "trust me", "honestly", "the truth is", "let's be real", "are they tiling it with gold".
- No emoji. No em dashes. No exclamation marks. No rhetorical questions.
- Cite numbers. When you call a line high or low, say what the local fair range is for that line ("Fair range here is $X to $Y").
- Each sentence under 22 words. Calm cadence, useful payoff.

CONTEXT:
- Project: ${extractedProposal.spaceType} ${extractedProposal.scope}
- Quote total: $${total.toLocaleString()}
- Local fair range: $${marketRange.low.toLocaleString()} to $${marketRange.high.toLocaleString()} (avg $${avg.toLocaleString()})
- Verdict tier: "${tier.label}" (score ${score}/100)
- Line items:
${lineItemBlock || "(no line items extracted, quote was a single number)"}

Return ONLY valid JSON, no markdown, with this exact shape:
{
  "headline": "<6-14 words. Confident verdict with a small wink if earned. Reference the position, not the drama.>",
  "oneLiner": "<25-40 words. Calm summary that names at least one real number from above.>",
  "lineRoasts": [
    { "item": "<line item>", "cost": <number>, "burn": "<one sentence, 12-22 words. Sharp but grounded, citing the local fair range or a comparable.>", "verdict": "fair" | "high" | "low" | "wtf" }
  ],
  "shareCaption": "<60-100 chars, no hashtags. State the score and where it landed in plain English.>",
  "advice": "<2 concrete next steps a homeowner can do this week. One short sentence each, separated by a period.>"
}

Verdict rules:
- "fair" if within local fair range.
- "low" if below local fair range.
- "high" if above the fair range by up to 30%.
- "wtf" only if above the fair range by more than 30%.

Generate 3 to 5 lineRoasts, picking the items that move the score most. If no line items, return lineRoasts: [] and put analysis in oneLiner. Never name the contractor.`;

    const roastResp = await aiFetch({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "fast",
        messages: [
          { role: "system", content: "You are Haleo. Calm, sharp, evidence-led. Output ONLY valid JSON." },
          { role: "user", content: roastPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      }),
    });

    let roast = {
      headline: `${tier.label} for a ${extractedProposal.spaceType} ${extractedProposal.scope}.`,
      oneLiner: `Your $${total.toLocaleString()} quote lands in the ${tier.label.toLowerCase()} band. Local fair range for this scope is $${marketRange.low.toLocaleString()} to $${marketRange.high.toLocaleString()}.`,
      lineRoasts: [] as any[],
      shareCaption: `My contractor quote scored ${score}/100 on Haleo. ${tier.label}.`,
      advice: "Get two more itemized bids on the same scope. Ask your contractor to walk through any line above the local fair range.",
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
        contractor: "Anonymous Contractor",
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
      comparableProjects: pricing.comparableProjects || [],
      confidence: pricing.confidence,
      // Full pricing payload so the audit page can pick up without re-uploading.
      pricing,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("roast-proposal error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
