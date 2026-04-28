// Background scraper for contractor portfolio links.
// Uses Firecrawl to grab og:image + title for each URL, then writes results back into contractor_accounts.portfolio_links.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

type PortfolioLink = {
  url: string;
  type?: string;
  title?: string;
  thumbnail?: string;
  status?: "pending" | "scraping" | "ready" | "failed";
};

async function scrapeOne(url: string, apiKey: string): Promise<Partial<PortfolioLink>> {
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`Firecrawl ${res.status} for ${url}:`, data?.error);
      return { status: "failed" };
    }
    const meta = data?.data?.metadata ?? data?.metadata ?? {};
    return {
      title: meta.title || meta.ogTitle || undefined,
      thumbnail: meta.ogImage || meta.image || undefined,
      status: "ready",
    };
  } catch (err) {
    console.error(`Scrape error for ${url}:`, err);
    return { status: "failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, links } = await req.json();
    if (!user_id || !Array.isArray(links)) {
      return new Response(JSON.stringify({ error: "user_id and links[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch current account to merge
    const { data: account } = await supabase
      .from("contractor_accounts")
      .select("portfolio_links")
      .eq("user_id", user_id)
      .maybeSingle();

    const current: PortfolioLink[] = (account?.portfolio_links as PortfolioLink[]) ?? [];

    // Scrape each link in parallel
    const enriched = await Promise.all(
      current.map(async (link) => {
        if (!links.includes(link.url)) return link;
        const result = await scrapeOne(link.url, FIRECRAWL_API_KEY);
        return { ...link, ...result };
      })
    );

    await supabase
      .from("contractor_accounts")
      .update({ portfolio_links: enriched })
      .eq("user_id", user_id);

    return new Response(JSON.stringify({ success: true, count: enriched.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scrape-portfolio-link error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
