import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_project_brief",
  title: "Get a project brief",
  description:
    "Fetch the full contractor-ready brief and intake details for one of the signed-in homeowner's projects.",
  inputSchema: { project_id: z.string().uuid().describe("The project's id from list_projects.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("user_projects")
      .select("id,title,room,status,intake,brief,created_at,updated_at")
      .eq("id", project_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Project not found." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { project: data },
    };
  },
});
