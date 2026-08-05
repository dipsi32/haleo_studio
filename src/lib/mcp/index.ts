import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getProjectBrief from "./tools/get-project-brief";
import listProposalAudits from "./tools/list-proposal-audits";
import getProposalAudit from "./tools/get-proposal-audit";
import searchContractors from "./tools/search-contractors";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "haleo-mcp",
  title: "Haleo",
  version: "0.1.0",
  instructions:
    "Tools for Haleo, a San Jose remodel platform built on county permit and inspection records. Use `list_projects` and `get_project_brief` to read the signed-in homeowner's remodel projects and contractor-ready briefs, `list_proposal_audits` and `get_proposal_audit` to read their contractor quote audits (risk score, red flags, pricing analysis, pushback language), and `search_contractors` to look up contractors ranked by verified permit history. All tools act as the signed-in Haleo user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, getProjectBrief, listProposalAudits, getProposalAudit, searchContractors],
});
