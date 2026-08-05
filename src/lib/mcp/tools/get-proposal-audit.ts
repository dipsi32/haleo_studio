import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_proposal_audit",
  title: "Get a quote audit",
  description:
    "Fetch the full audit for one of the signed-in homeowner's proposals: red flags, pricing analysis, permit and license data, and pushback language.",
  inputSchema: { audit_id: z.string().uuid().describe("The audit id from list_proposal_audits.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ audit_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("proposal_analyses")
      .select(
        "id,contractor_name,verdict,risk_score,risk_breakdown,total_cost,red_flags,pricing_data,permit_data,license_data,pushback_language,next_actions,roadmap,status,created_at",
      )
      .eq("id", audit_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Audit not found." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { audit: data },
    };
  },
});
