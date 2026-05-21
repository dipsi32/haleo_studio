// Public cost-guide aggregator: HomeAdvisor + Angi + Remodeling Cost vs. Value.
// Cached per (zip, spaceType, scope) for 30 days. Curated fallback ensures
// instant response even if scraping is rate-limited or the connector is down.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_DAYS = 30;

// ── Curated national fallback ranges (USD, 2024–2025 published medians) ─────
// Sources: HomeAdvisor cost guides, Angi cost guides, Remodeling Cost vs. Value
// These are the floor when live scraping fails or no cache exists.
const FALLBACK_RANGES: Record<string, Record<string, { low: number; high: number }>> = {
  kitchen: {
    refresh: { low: 12000, high: 28000 },     // cosmetic: paint, hardware, appliances
    redesign: { low: 30000, high: 75000 },    // mid-range full remodel
    "gut-rebuild": { low: 70000, high: 160000 }, // upscale, layout change
  },
  bathroom: {
    refresh: { low: 5000, high: 12000 },
    redesign: { low: 12000, high: 35000 },
    "gut-rebuild": { low: 30000, high: 75000 },
  },
  bedroom: {
    refresh: { low: 3000, high: 8000 },
    redesign: { low: 8000, high: 22000 },
    "gut-rebuild": { low: 20000, high: 50000 },
  },
  "living room": {
    refresh: { low: 4000, high: 10000 },
    redesign: { low: 10000, high: 28000 },
    "gut-rebuild": { low: 25000, high: 60000 },
  },
  "whole home": {
    refresh: { low: 25000, high: 65000 },
    redesign: { low: 70000, high: 180000 },
    "gut-rebuild": { low: 150000, high: 400000 },
  },
  addition: {
    refresh: { low: 30000, high: 60000 },
    redesign: { low: 60000, high: 150000 },
    "gut-rebuild": { low: 120000, high: 300000 },
  },
  outdoor: {
    refresh: { low: 2000, high: 8000 },
    redesign: { low: 8000, high: 25000 },
    "gut-rebuild": { low: 20000, high: 75000 },
  },
};

// Rough regional cost-of-living multipliers by ZIP prefix (high-cost-of-living adjustment).
// Bay Area / NYC / Seattle / Boston / LA / DC run 1.25–1.45× national medians.
function regionalMultiplier(zip: string): number {
  const prefix = zip.slice(0, 3);
  const high = ["940","941","942","943","944","945","946","947","948","949","950","951","100","101","102","103","104","980","981","021","022","900","901","902","903","904","905","906","907","908","200","201","202"];
  const aboveAvg = ["070","071","072","073","074","075","076","077","078","079","600","601","602","603","604","606","980","981","990"];
  if (high.includes(prefix)) return 1.35;
  if (aboveAvg.includes(prefix)) return 1.15;
  return 1.0;
}

function fallbackRange(spaceType: string, scope: string, zip: string) {
  const st = spaceType.toLowerCase();
  const sc = scope.toLowerCase();
  const base = FALLBACK_RANGES[st]?.[sc] || FALLBACK_RANGES.kitchen.redesign;
  const m = regionalMultiplier(zip);
  const low = Math.round(base.low * m);
  const high = Math.round(base.high * m);
  return {
    low,
    high,
    average: Math.round((low + high) / 2),
    sources: [
      { name: "HomeAdvisor cost guide (national medians)", url: "https://www.homeadvisor.com/cost/" },
      { name: "Angi cost guide (national medians)", url: "https://www.angi.com/articles/" },
      { name: "Remodeling Cost vs. Value (regional)", url: "https://www.remodeling.hw.net/cost-vs-value/" },
    ],
    sourceCount: 3,
    fromCache: false,
    fromFallback: true,
  };
}

// ── Live scraping via Firecrawl (best-effort, async upgrade) ────────────────
async function scrapeRange(spaceType: string, _zip: string, firecrawlKey: string) {
  const slug = spaceType.toLowerCase().replace(/\s+/g, "-");
  const urls = [
    `https://www.homeadvisor.com/cost/additions-and-remodels/remodel-a-${slug}/`,
    `https://www.angi.com/articles/how-much-does-${slug}-remodel-cost.htm`,
  ];

  const collected: number[] = [];
  const usedSources: { name: string; url: string }[] = [];

  for (const url of urls) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const md = d?.data?.markdown || d?.markdown || "";
      // Pull dollar figures, keep plausible remodel range ($1k–$500k)
      const matches = [...md.matchAll(/\$([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/g)]
        .map(m => parseFloat(m[1].replace(/,/g, "")))
        .filter(v => v >= 1000 && v <= 500000);
      if (matches.length >= 3) {
        collected.push(...matches);
        usedSources.push({
          name: url.includes("homeadvisor") ? "HomeAdvisor cost guide" : "Angi cost guide",
          url,
        });
      }
    } catch (e) {
      console.error("scrape error", url, e);
    }
  }

  if (collected.length < 6) return null;
  collected.sort((a, b) => a - b);
  const pct = (p: number) => collected[Math.max(0, Math.ceil((p / 100) * collected.length) - 1)];
  return {
    low: Math.round(pct(20)),
    high: Math.round(pct(80)),
    average: Math.round(collected.reduce((a, b) => a + b, 0) / collected.length),
    sources: usedSources,
    sourceCount: usedSources.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { zipCode, spaceType, scope } = await req.json();
    if (!spaceType || !scope) {
      return new Response(JSON.stringify({ error: "spaceType and scope required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const zip = (zipCode || "00000").toString().slice(0, 5);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Cache lookup
    const { data: cached } = await supabase
      .from("cost_guide_cache")
      .select("*")
      .eq("zip_code", zip)
      .eq("space_type", spaceType.toLowerCase())
      .eq("scope", scope.toLowerCase())
      .maybeSingle();

    if (cached) {
      const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < CACHE_TTL_DAYS) {
        return new Response(JSON.stringify({
          low: Number(cached.low),
          high: Number(cached.high),
          average: Number(cached.average),
          sources: cached.sources || [],
          sourceCount: cached.source_count,
          fromCache: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2. Try live scrape (best-effort)
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    let result = null;
    if (firecrawlKey) {
      try { result = await scrapeRange(spaceType, zip, firecrawlKey); }
      catch (e) { console.error("scrape failed", e); }
    }

    // 3. Fallback to curated table (always succeeds)
    if (!result) {
      const fb = fallbackRange(spaceType, scope, zip);
      return new Response(JSON.stringify(fb), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply regional multiplier to scraped national figures
    const mult = regionalMultiplier(zip);
    result.low = Math.round(result.low * mult);
    result.high = Math.round(result.high * mult);
    result.average = Math.round(result.average * mult);

    // 4. Persist cache
    await supabase.from("cost_guide_cache").upsert({
      zip_code: zip,
      space_type: spaceType.toLowerCase(),
      scope: scope.toLowerCase(),
      low: result.low,
      high: result.high,
      average: result.average,
      sources: result.sources,
      source_count: result.sourceCount,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "zip_code,space_type,scope" });

    return new Response(JSON.stringify({ ...result, fromCache: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cost-guide-lookup error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
