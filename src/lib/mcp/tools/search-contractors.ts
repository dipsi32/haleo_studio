import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "search_contractors",
  title: "Search verified contractors",
  description:
    "Search Haleo's San Jose contractor directory, ranked by county permit history. Optionally filter by city or specialty.",
  inputSchema: {
    query: z.string().trim().min(1).optional().describe("Name or company text match."),
    city: z.string().trim().min(1).optional().describe("City filter, e.g. San Jose."),
    specialty: z.string().trim().min(1).optional().describe("Specialty filter, e.g. ADU, kitchen."),
    limit: z.number().int().min(1).max(25).default(10).describe("Maximum number of contractors."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, city, specialty, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("contractors")
      .select("id,slug,name,company,city,state,specialty,permit_count,last_permit_date,license_number,website")
      .order("permit_count", { ascending: false })
      .limit(limit ?? 10);
    if (query) q = q.or(`name.ilike.%${query}%,company.ilike.%${query}%`);
    if (city) q = q.ilike("city", `%${city}%`);
    if (specialty) q = q.ilike("specialty", `%${specialty}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { contractors: data ?? [] },
    };
  },
});
