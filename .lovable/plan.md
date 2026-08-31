# Agent integrations (MCP) — finish and ship

Haleo already has an MCP server in the codebase: an OAuth-protected server named "Haleo" with five tools (`list_projects`, `get_project_brief`, `list_proposal_audits`, `get_proposal_audit`, `search_contractors`), the Vite plugin wired in `vite.config.ts`, the generated function at `supabase/functions/mcp/index.ts`, and a consent page at `/.lovable/oauth/consent`.

What is missing is the part that makes it actually reachable and useful to ChatGPT/Claude users.

## 1. Fix the Supabase client used by the tools

`src/lib/mcp/supabase.ts` reads `process.env.SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` at call time. Edge Functions run on Deno and do not populate the singular publishable-key name, so the tools can fail to construct a client. Replace it with the runtime-env resolver that checks Deno first, falls back to the `SUPABASE_PUBLISHABLE_KEYS` dictionary and the legacy anon key, and keeps the token-forwarding behavior so row-level security still runs as the signed-in homeowner.

## 2. Add public, no-login discovery tools

Today every tool requires OAuth, so an assistant can do nothing for a homeowner who has never signed into Haleo. Add tools that read only intentionally public data:

- `find_contractors_for_project` — describe a project in plain language plus a San Jose neighborhood/zip, get back permit-proven contractor matches with counts of similar permitted jobs nearby.
- `get_contractor_profile` — public profile for one contractor by slug: permit history, recent job counts, city code-case checks.

These are the tools that let Haleo answer "who should remodel my kitchen in 95128?" inside ChatGPT and hand the homeowner a reason to come to the app.

Note: mixing public and OAuth tools on one server requires a decision on access mode (see the question below).

## 3. Verify and deploy

Regenerate the manifest, deploy the `mcp` function, and test the endpoint end to end — unauthenticated tool call, then an OAuth-authenticated one — before calling it done.

## 4. Surface it in the product

Add a short "Connect Haleo to ChatGPT or Claude" section (Account page) with the server URL and one-line setup instructions, so homeowners can actually turn it on.

## Also tracked

Y Combinator consumer-AI positioning work — answered in chat this turn; capture any resulting product changes as their own tasks.

## Technical notes

- Tool files stay import-safe (no env reads at module load).
- Public tools query only via an anon client; never service-role, never widened RLS.
- The OAuth issuer stays `https://<project-ref>.supabase.co/auth/v1`, built from `VITE_SUPABASE_PROJECT_ID`.
