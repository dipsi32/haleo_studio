import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_proposal_audits",
  title: "List my quote audits",
  description:
    "List the signed-in homeowner's proposal (quote) audits with verdict, risk score, contractor name and total cost.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of audits."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("proposal_analyses")
      .select("id,contractor_name,verdict,risk_score,total_cost,space_type,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { audits: data ?? [] },
    };
  },
});
