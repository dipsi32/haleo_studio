# Leaving Lovable

Haleo is a Claude Code project. This is what it takes to run it with no Lovable in the loop, what is already done, and what only you can do.

## Done in code

| Was | Now |
|---|---|
| Lovable publishes the site | Cloudflare Pages, published by `.github/workflows/deploy.yml` (`docs/hosting-cloudflare.md`) |
| Google sign-in through Lovable's broker | Supabase's own Google sign-in (`supabase.auth.signInWithOAuth`) |
| Lovable preview-iframe auth workaround | removed |
| `lovable-tagger`, `@lovable.dev/cloud-auth-js`, `.lovable/`, bun lockfiles | removed |
| Lockfile pointing at Lovable's package mirror | regenerated from the public npm registry, verified with `npm ci` |
| AI features through Lovable's gateway (Gemini) | Claude, directly (`supabase/functions/_shared/ai.ts`) |
| Visibility scan asking Gemini and ChatGPT through the gateway | each asked directly with its own key |

## Still touching Lovable (your call)

**The MCP server.** `src/lib/mcp/` and `supabase/functions/mcp/` use the public npm package `@lovable.dev/mcp-js`, which also generates the edge function at build time, and the sign-in consent page lives at `/.lovable/oauth/consent`. It's an open package and works anywhere, so I left it. If you want zero Lovable names left, the next step is rebuilding it on `@modelcontextprotocol/sdk`. Say the word.

## The decision: start fresh

The old production database stays behind. No data, users or files are moved, so there is no export to wait for and nothing to rehearse against real records. Everyone signs up again on the new site. The old Lovable-managed project can simply be left alone and, when you're ready, shut down.

That makes the move three things: new backends, a new host, a new domain pointer. `docs/new-backend.md` is the exact runbook, and it is mostly pasting keys into GitHub and pressing two buttons.

## Cutover

1. Set up staging end to end and test it (`docs/new-backend.md`, steps 1 to 5).
2. Set up production the same way with the `production` choice.
3. Merge PR #6 into `main`. The Deploy workflow publishes production to `https://haleo.pages.dev`. Test it there.
4. Add the custom domain `haleo.studio` in Cloudflare Pages. Traffic moves when DNS does, within minutes to hours.
5. Keep the old site and project untouched for a couple of weeks as a fallback, then retire them.

## Not verified

- The Claude calls have not run against the live Anthropic API: the adapter is unit-tested for the request and response shapes, but a real key hasn't been exercised. Run each AI feature once on staging before cutover.
- The default model choices are mine. Quality on proposal PDFs and floor-plan photos should be spot-checked on real files.
- The bootstrap workflow has not run against a real Supabase project. The migrations were rehearsed on an empty Postgres 16 with Supabase stand-ins (all 23 apply; 31 tables, all with row-level security; 3 storage buckets), and the smoke test was checked against a mock backend, not a real one.
