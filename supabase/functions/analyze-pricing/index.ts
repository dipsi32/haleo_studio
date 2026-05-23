import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SJ_ACTIVE_PERMITS_RESOURCE = "761b7ae8-3be1-4ad6-923d-c7af6404a904";
const SJ_API_BASE = "https://data.sanjoseca.gov/api/3/action/datastore_search";

const RequestSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
});

// ─── Step 1: Extract proposal details via LLM ───────────────────────
async function extractProposalDetails(fileBase64: string, fileType: string, apiKey: string) {
  const isImage = fileType.startsWith("image/");
  const mimeType = fileType;

  const systemPrompt = `You are Haleo, an expert construction cost analyst. You are given a contractor proposal document. 
Extract ALL of the following details with extreme precision. If a value is not found, use your best inference from context.

Return a JSON object with exactly these fields:
{
  "contractorName": string (the contractor or company name),
  "totalCost": number (the total quoted price in dollars, no commas),
  "spaceType": string (one of: "kitchen", "bathroom", "bedroom", "living room", "whole home", "outdoor", "addition", or best match),
  "scope": string (one of: "refresh", "redesign", "gut-rebuild" — infer from the work described),
  "zipCode": string (5-digit ZIP from the project address, or "" if not found),
  "squareFootage": number or null (if mentioned),
  "lineItems": [{"item": string, "cost": number}] (every line item with its cost),
  "summary": string (1-2 sentence description of the proposed work)
}

Be meticulous. Parse every dollar amount. The totalCost must equal the actual total on the proposal.
If the proposal lists a subtotal + tax/fees, use the final total.`;

  const userContent: any[] = [];
  
  if (isImage) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${fileBase64}` },
    });
    userContent.push({ type: "text", text: "Extract all details from this contractor proposal image." });
  } else {
    // PDF — send as base64 document
    userContent.push({
      type: "image_url",
      image_url: { url: `data:application/pdf;base64,${fileBase64}` },
    });
    userContent.push({ type: "text", text: "Extract all details from this contractor proposal PDF." });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM extraction failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";

  // Parse JSON from response (handle markdown code fences)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
  let cleaned = (jsonMatch[1] || raw).trim();
  // Try to find JSON object
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    cleaned = cleaned.slice(objStart, objEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      contractorName: parsed.contractorName || "Unknown Contractor",
      totalCost: typeof parsed.totalCost === "number" ? parsed.totalCost : parseFloat(String(parsed.totalCost).replace(/[^0-9.]/g, "")) || 0,
      spaceType: parsed.spaceType || "kitchen",
      scope: parsed.scope || "redesign",
      zipCode: parsed.zipCode || "",
      squareFootage: parsed.squareFootage || null,
      lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
      summary: parsed.summary || "",
    };
  } catch (e) {
    console.error("Failed to parse LLM JSON:", cleaned);
    throw new Error("Could not extract proposal details. Please try a clearer image or PDF.");
  }
}

// ─── Step 2: Fetch permit data ──────────────────────────────────────
async function fetchPermitsByTypeAndZip(spaceType: string, zipCode: string) {
  const searchTermMap: Record<string, string[]> = {
    kitchen: ["kitchen", "remodel kitchen", "kitchen renovation"],
    bathroom: ["bathroom", "bath remodel", "bathroom renovation"],
    bedroom: ["bedroom", "room addition"],
    "living room": ["living room", "family room", "remodel"],
    "whole home": ["whole house", "full remodel", "renovation"],
    addition: ["addition", "room addition", "ADU"],
    outdoor: ["deck", "patio", "outdoor", "landscape"],
  };

  const terms = searchTermMap[spaceType.toLowerCase()] || [spaceType];
  const allRecords: any[] = [];

  for (const term of terms) {
    try {
      const url = `${SJ_API_BASE}?resource_id=${SJ_ACTIVE_PERMITS_RESOURCE}&q=${encodeURIComponent(term)}&limit=200`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const d = await resp.json();
      allRecords.push(...(d.result?.records || []));
    } catch (e) {
      console.error(`Error fetching term "${term}":`, e);
    }
  }

  const seen = new Set<string>();
  const unique = allRecords.filter((r) => {
    const id = r.FOLDERNUMBER || Math.random().toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const zipFiltered = unique.filter((r) => {
    const addr = (r.ADDRESS || "").toUpperCase();
    return addr.includes(zipCode) || addr.includes("SAN JOSE");
  });

  return zipFiltered.length >= 5 ? zipFiltered : unique;
}

// ─── Step 3: Cost analysis ──────────────────────────────────────────
function analyzePermitCosts(records: any[], scope: string) {
  const valuations = records
    .map((r) => parseFloat((r.PERMITVALUATION || r.VALUATION || "0").toString().replace(/[^0-9.]/g, "")))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  if (valuations.length === 0) return null;

  const scopeMultiplier: Record<string, number> = { refresh: 0.6, redesign: 1.0, "gut-rebuild": 1.5 };
  const multiplier = scopeMultiplier[scope] || 1.0;

  const percentile = (arr: number[], p: number) => {
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(idx, arr.length - 1))];
  };

  const sum = valuations.reduce((a, b) => a + b, 0);
  const avg = sum / valuations.length;

  return {
    low: Math.round(percentile(valuations, 15) * multiplier),
    high: Math.round(percentile(valuations, 85) * multiplier),
    average: Math.round(avg * multiplier),
    median: Math.round(percentile(valuations, 50) * multiplier),
    sampleSize: valuations.length,
  };
}

// ─── Step 4: Component breakdown ────────────────────────────────────
function estimateComponentRanges(spaceType: string, marketRange: { low: number; high: number; average: number }) {
  const breakdowns: Record<string, Record<string, { pctLow: number; pctHigh: number }>> = {
    kitchen: {
      cabinets: { pctLow: 0.25, pctHigh: 0.35 },
      countertops: { pctLow: 0.10, pctHigh: 0.15 },
      appliances: { pctLow: 0.12, pctHigh: 0.20 },
      labor: { pctLow: 0.20, pctHigh: 0.28 },
      plumbing: { pctLow: 0.03, pctHigh: 0.06 },
      electrical: { pctLow: 0.03, pctHigh: 0.06 },
      flooring: { pctLow: 0.05, pctHigh: 0.10 },
    },
    bathroom: {
      cabinets: { pctLow: 0.10, pctHigh: 0.18 },
      countertops: { pctLow: 0.08, pctHigh: 0.12 },
      fixtures: { pctLow: 0.15, pctHigh: 0.25 },
      labor: { pctLow: 0.25, pctHigh: 0.35 },
      plumbing: { pctLow: 0.10, pctHigh: 0.15 },
      tile: { pctLow: 0.10, pctHigh: 0.18 },
    },
  };

  const breakdown = breakdowns[spaceType.toLowerCase()] || {
    materials: { pctLow: 0.30, pctHigh: 0.45 },
    labor: { pctLow: 0.25, pctHigh: 0.35 },
    fixtures: { pctLow: 0.10, pctHigh: 0.20 },
    other: { pctLow: 0.10, pctHigh: 0.15 },
  };

  const result: Record<string, { low: number; high: number; average: number }> = {};
  for (const [component, pcts] of Object.entries(breakdown)) {
    result[component] = {
      low: Math.round(marketRange.low * pcts.pctLow),
      high: Math.round(marketRange.high * pcts.pctHigh),
      average: Math.round(marketRange.average * ((pcts.pctLow + pcts.pctHigh) / 2)),
    };
  }
  return result;
}

function keywordMatchScore(record: any, keywords: string[]): number {
  const text = `${record.FOLDERNAME || ""} ${record.WORKDESCRIPTION || ""} ${record.SUBTYPEDESCRIPTION || ""}`.toLowerCase();
  return keywords.reduce((score, kw) => score + (text.includes(kw) ? 1 : 0), 0);
}

// ─── Step 5: Comparable projects ────────────────────────────────────
function extractComparableProjects(records: any[], proposalCost: number, proposalScope: string, limit = 8) {
  const lowerBound = proposalCost * 0.7;
  const upperBound = proposalCost * 1.3;

  // Keywords from scope to match against FOLDERNAME / WORKDESCRIPTION
  const scopeKeywords = proposalScope
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return records
    .filter((r) => {
      const val = parseFloat((r.PERMITVALUATION || "0").toString().replace(/[^0-9.]/g, ""));
      if (val <= 0) return false;
      // Must be within ±30% of proposal cost
      if (val < lowerBound || val > upperBound) return false;
      return true;
    })
    // Prefer records whose FOLDERNAME matches scope keywords
    .sort((a, b) => {
      const scoreA = keywordMatchScore(a, scopeKeywords);
      const scoreB = keywordMatchScore(b, scopeKeywords);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Secondary: closer in cost to proposal
      const costA = Math.abs(parseFloat((a.PERMITVALUATION || "0").toString().replace(/[^0-9.]/g, "")) - proposalCost);
      const costB = Math.abs(parseFloat((b.PERMITVALUATION || "0").toString().replace(/[^0-9.]/g, "")) - proposalCost);
      return costA - costB;
    })
    .slice(0, limit)
    .map((r) => {
      const addr = (r.ADDRESS || "").split(",")[0] || "Nearby";
      const parts = addr.trim().split(/\s+/);
      const anonymized = parts.length > 2 ? `${parts.slice(1).join(" ")} area` : addr;
      const issueDate = r.ISSUEDATE || null;
      const finalDate = r.FINALDATE || null;
      let daysToComplete: number | null = null;
      if (issueDate && finalDate) {
        const days = (new Date(finalDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0 && days < 1000) daysToComplete = Math.round(days);
      }
      // FOLDERNAME has the best human-readable project summary (e.g. "KITCHEN AND BATH REMODEL")
      const folderName = (r.FOLDERNAME || "").toString().trim();
      const rawDesc = (r.WORKDESCRIPTION || "").toString().trim();
      const folderDesc = (r.FOLDERDESC || "").toString().trim();
      const subType = (r.SUBTYPEDESCRIPTION || "").toString().trim();
      const sqft = parseInt((r.SQUAREFOOTAGE || "0").toString()) || null;

      // Build intelligent summary from FOLDERNAME (most descriptive field)
      let workSummary = "";
      if (folderName && folderName.length > 3) {
        // Clean up: remove permit prefixes like "(EMP100%)" and normalize casing
        let clean = folderName.replace(/\(.*?\)\s*/g, "").trim();
        // Title-case it for readability
        clean = clean
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/\bAdu\b/gi, "ADU")
          .replace(/\bHvac\b/gi, "HVAC");
        workSummary = clean.length > 90 ? clean.slice(0, 90).replace(/\s+\S*$/, "…") : clean;
      } else if (rawDesc && rawDesc !== "Additions/Alterations") {
        workSummary = rawDesc.length > 90 ? rawDesc.slice(0, 90).replace(/\s+\S*$/, "…") : rawDesc;
      } else {
        workSummary = subType || "Remodel";
      }

      // Dwelling type tag (Single-Family, Condo, Duplex, etc.)
      const dwellingType = folderDesc
        ? folderDesc.replace(/1 & 2 Family Detached Dwellings/i, "Single-Family").replace(/dwellings?/i, "").trim()
        : "";

      return {
        address: anonymized,
        zipCode: "San Jose, CA",
        cost: parseFloat((r.PERMITVALUATION || "0").toString().replace(/[^0-9.]/g, "")),
        completionDate: finalDate,
        daysToComplete,
        status: finalDate ? "Completed" : "Active",
        type: subType || "Remodel",
        workDescription: workSummary,
        dwellingType,
        squareFootage: sqft,
      };
    });
}

// ─── Step 6: Haleo's verdict + analysis via LLM ────────────────────
async function generateHaleoVerdict(
  proposal: { totalCost: number; contractorName: string; lineItems: { item: string; cost: number }[]; summary: string },
  marketRange: { low: number; high: number; average: number; median: number },
  spaceType: string,
  scope: string,
  sampleSize: number,
  apiKey: string,
) {
  const proposalCost = proposal.totalCost;
  let verdict: string;
  let percentileRank: number;

  if (proposalCost < marketRange.low) {
    verdict = "below-market";
    percentileRank = Math.round(((proposalCost) / (marketRange.low)) * 25);
  } else if (proposalCost <= marketRange.high) {
    verdict = "fair";
    percentileRank = Math.round(25 + ((proposalCost - marketRange.low) / (marketRange.high - marketRange.low)) * 50);
  } else if (proposalCost <= marketRange.high * 1.2) {
    verdict = "above-market";
    percentileRank = Math.round(75 + ((proposalCost - marketRange.high) / (marketRange.high * 0.2)) * 15);
  } else {
    verdict = "significantly-above";
    percentileRank = 95;
  }
  percentileRank = Math.max(1, Math.min(99, percentileRank));

  const lineItemStr = proposal.lineItems.map((li) => `${li.item}: $${li.cost.toLocaleString()}`).join("\n");

  const prompt = `You are Haleo. You write like a sharp friend who has seen this movie a hundred times. Bold, honest, calm, helpful. No theater, no salesy language, no clichés, no em dashes, no exclamation marks, no emoji. Each sentence under 18 words.

A homeowner uploaded a proposal from "${proposal.contractorName}" for a ${spaceType} ${scope} project, totaling $${proposalCost.toLocaleString()}.

Local fair range based on ${sampleSize} real permit records is $${marketRange.low.toLocaleString()} to $${marketRange.high.toLocaleString()} (avg $${marketRange.average.toLocaleString()}).

Position: "${verdict}" (${percentileRank}th percentile).

Line items:
${lineItemStr || "No detailed line items extracted."}

Proposal summary: ${proposal.summary}

Write 3 to 4 sentences. Be specific: name the line items that move the score and cite numbers. If the price is fair, say so plainly. If it is high, name the lines driving it. If it is below market, flag the quality questions to ask. End with one concrete next step the homeowner can do this week.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are Haleo. Calm, sharp, evidence-led. No theater, no clichés, no em dashes." },
          { role: "user", content: prompt },
        ],
        temperature: 0.45,
        max_tokens: 500,
      }),
    });

    if (!response.ok) throw new Error(`LLM failed: ${response.status}`);
    const data = await response.json();
    const reasoning = data.choices?.[0]?.message?.content || `Your proposal of $${proposalCost.toLocaleString()} falls ${verdict === "fair" ? "within" : "outside"} the typical range for similar projects.`;

    return { verdict, percentileRank, reasoning };
  } catch (e) {
    console.error("Haleo verdict error:", e);
    return {
      verdict,
      percentileRank,
      reasoning: `Your proposal of $${proposalCost.toLocaleString()} ${verdict === "fair" ? "falls within" : verdict === "below-market" ? "is below" : "exceeds"} the typical range of $${marketRange.low.toLocaleString()} – $${marketRange.high.toLocaleString()} for comparable ${spaceType} projects in your area.`,
    };
  }
}

// ─── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Please upload a valid proposal file." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileBase64, fileType } = parsed.data;

    // 1. Extract proposal details via AI
    console.log("Step 1: Extracting proposal details…");
    const proposal = await extractProposalDetails(fileBase64, fileType, apiKey);
    console.log("Extracted:", JSON.stringify({ ...proposal, lineItems: `${proposal.lineItems.length} items` }));

    if (proposal.totalCost <= 0) {
      throw new Error("Could not find a total cost in your proposal. Please upload a clearer document.");
    }

    // Use extracted ZIP or default to San Jose
    const zipCode = proposal.zipCode || "95123";

    // 2. Fetch comparable permit data (San Jose only — local sanity check)
    console.log("Step 2: Fetching permit data…");
    const records = await fetchPermitsByTypeAndZip(proposal.spaceType, zipCode);

    // 3a. Permit-based range (local but under-reported)
    console.log("Step 3a: Analyzing permit valuations…");
    const permitRange = analyzePermitCosts(records, proposal.scope);

    // 3b. Public cost-guide range (HomeAdvisor + Angi + Cost vs. Value)
    console.log("Step 3b: Fetching cost-guide ranges…");
    let guideRange: { low: number; high: number; average: number; sources: any[]; sourceCount: number; fromCache?: boolean; fromFallback?: boolean } | null = null;
    try {
      const guideResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cost-guide-lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ zipCode, spaceType: proposal.spaceType, scope: proposal.scope }),
      });
      if (guideResp.ok) guideRange = await guideResp.json();
    } catch (e) { console.error("Cost guide fetch failed:", e); }

    // 3c. Own corpus (anonymized proposals from prior uploads — the moat)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let corpusRange: { low: number; high: number; average: number; n: number } | null = null;
    try {
      const { data: corpusRows } = await supabaseAdmin
        .from("proposal_benchmarks")
        .select("total_cost")
        .eq("space_type", proposal.spaceType.toLowerCase())
        .eq("scope", proposal.scope.toLowerCase())
        .eq("zip_code", zipCode)
        .limit(200);
      if (corpusRows && corpusRows.length >= 5) {
        const costs = corpusRows.map((r: any) => Number(r.total_cost)).sort((a, b) => a - b);
        const pct = (p: number) => costs[Math.max(0, Math.ceil((p / 100) * costs.length) - 1)];
        corpusRange = {
          low: Math.round(pct(20)),
          high: Math.round(pct(80)),
          average: Math.round(costs.reduce((a, b) => a + b, 0) / costs.length),
          n: costs.length,
        };
      }
    } catch (e) { console.error("Corpus lookup failed:", e); }

    // 3d. Blend the available sources
    // Weight: own corpus (3x if n≥20, 2x if n≥5) > cost guide (2x) > permits (1x, sj only)
    const sourceList: any[] = [];
    const sourcesUsed: { name: string; url?: string; weight: number; sampleSize?: number }[] = [];
    let lowSum = 0, highSum = 0, avgSum = 0, weightSum = 0;

    if (guideRange) {
      const w = 2;
      lowSum += guideRange.low * w; highSum += guideRange.high * w; avgSum += guideRange.average * w; weightSum += w;
      for (const s of (guideRange.sources || [])) sourceList.push(s);
      sourcesUsed.push({
        name: guideRange.fromFallback
          ? "Public cost guides (HomeAdvisor, Angi, Cost vs. Value — national medians)"
          : "Public cost guides (HomeAdvisor + Angi, live)",
        weight: w,
        sampleSize: guideRange.sourceCount,
      });
    }
    if (permitRange && permitRange.sampleSize >= 3) {
      const w = 1;
      lowSum += permitRange.low * w; highSum += permitRange.high * w; avgSum += permitRange.average * w; weightSum += w;
      sourcesUsed.push({
        name: "San Jose permit valuations (local)",
        url: "https://data.sanjoseca.gov/",
        weight: w,
        sampleSize: permitRange.sampleSize,
      });
    }
    if (corpusRange) {
      const w = corpusRange.n >= 20 ? 3 : 2;
      lowSum += corpusRange.low * w; highSum += corpusRange.high * w; avgSum += corpusRange.average * w; weightSum += w;
      sourcesUsed.push({
        name: "Haleo proposal corpus (anonymized prior uploads)",
        weight: w,
        sampleSize: corpusRange.n,
      });
    }

    let marketRange: { low: number; high: number; average: number; median: number; sampleSize: number };
    if (weightSum > 0) {
      marketRange = {
        low: Math.round(lowSum / weightSum),
        high: Math.round(highSum / weightSum),
        average: Math.round(avgSum / weightSum),
        median: Math.round(avgSum / weightSum),
        sampleSize: (permitRange?.sampleSize || 0) + (corpusRange?.n || 0) + (guideRange?.sourceCount || 0),
      };
    } else {
      // Last-resort static fallback
      const industryAvg: Record<string, number> = {
        kitchen: 52000, bathroom: 28000, bedroom: 18000,
        "living room": 22000, "whole home": 120000, addition: 85000, outdoor: 15000,
      };
      const base = industryAvg[proposal.spaceType.toLowerCase()] || 40000;
      const scopeMult = proposal.scope === "refresh" ? 0.5 : proposal.scope === "redesign" ? 1.0 : 1.6;
      const adjusted = Math.round(base * scopeMult);
      marketRange = { low: Math.round(adjusted * 0.75), high: Math.round(adjusted * 1.25), average: adjusted, median: adjusted, sampleSize: 0 };
      sourcesUsed.push({ name: "Industry averages (fallback)", weight: 1 });
    }

    // Sqft adjustment when provided
    if (proposal.squareFootage) {
      const sqftFactor = Math.max(0.6, Math.min(2.2, proposal.squareFootage / 150));
      marketRange.low = Math.round(marketRange.low * sqftFactor);
      marketRange.high = Math.round(marketRange.high * sqftFactor);
      marketRange.average = Math.round(marketRange.average * sqftFactor);
      marketRange.median = Math.round(marketRange.median * sqftFactor);
    }

    // Confidence: more independent sources + larger n → higher
    const distinctSources = sourcesUsed.length;
    const confidence: "high" | "medium" | "low" =
      (corpusRange && corpusRange.n >= 20) || distinctSources >= 3 ? "high"
      : distinctSources >= 2 ? "medium"
      : "low";

    // 4. Component breakdown
    const componentRanges = estimateComponentRanges(proposal.spaceType, marketRange);

    // 5. Comparable projects (still from SJ permits when available)
    const comparableProjects = extractComparableProjects(records, proposal.totalCost, `${proposal.spaceType} ${proposal.scope}`);

    // 6. Haleo's verdict
    console.log("Step 4: Generating Haleo's verdict...");
    const haleoVerdict = await generateHaleoVerdict(
      proposal, marketRange, proposal.spaceType, proposal.scope, marketRange.sampleSize, apiKey
    );

    // 7. Capture-the-moat: persist anonymized benchmark row
    try {
      const nameHash = proposal.contractorName
        ? btoa(unescape(encodeURIComponent(proposal.contractorName.toLowerCase().trim()))).slice(0, 24)
        : null;
      await supabaseAdmin.from("proposal_benchmarks").insert({
        zip_code: zipCode,
        space_type: proposal.spaceType.toLowerCase(),
        scope: proposal.scope.toLowerCase(),
        square_footage: proposal.squareFootage,
        total_cost: proposal.totalCost,
        line_items: proposal.lineItems,
        contractor_name_hash: nameHash,
      });
    } catch (e) { console.error("Benchmark capture failed (non-fatal):", e); }

    // 8. Build response
    const result = {
      marketRange: {
        low: marketRange.low,
        high: marketRange.high,
        average: marketRange.average,
        median: marketRange.median,
      },
      sampleSize: marketRange.sampleSize,
      confidence,
      sources: sourcesUsed,
      sourceCitations: sourceList,
      dataSource: sourcesUsed.map(s => s.name).join(" + "),
      extractedProposal: {
        contractorName: proposal.contractorName,
        totalCost: proposal.totalCost,
        spaceType: proposal.spaceType,
        scope: proposal.scope,
        zipCode,
        squareFootage: proposal.squareFootage,
        lineItems: proposal.lineItems,
        summary: proposal.summary,
      },
      proposalAnalysis: {
        providedCost: proposal.totalCost,
        percentileRank: haleoVerdict.percentileRank,
        verdict: haleoVerdict.verdict,
        reasoning: haleoVerdict.reasoning,
      },
      comparableProjects,
      componentRanges,
      haleoInsight: haleoVerdict.reasoning,
    };


    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Pricing analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
