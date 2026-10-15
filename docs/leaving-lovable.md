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

## Only you can do

### 1. Find out who owns the production database

Production runs on Supabase project `nfjipxgmwdlxqzzvqmsl`. **It is not in the Supabase account connected to Claude** ("dipsi32's Supabase Org" holds only Family Hive and `haleo-staging`). Sign in at supabase.com/dashboard with every login you use and look for it.

- **You find it:** you own it. Go to step 2.
- **You don't:** it's almost certainly managed by Lovable (Lovable Cloud). You can't leave Lovable until the data is out, and the export has to come from them. Ask Lovable support, or look in the project's Cloud or Database settings, for a **full database export including auth users and storage files**. Everything below waits on that.

### 2. Make a production project you own

`haleo-staging` is already yours (us-west-1). Create `haleo-prod` beside it. The free plan allows two active projects and `Family Hive Supa` is paused, so you may need to delete that or upgrade. For real users I'd put production on **Pro** (daily backups and point-in-time recovery), about $25 a month.

### 3. Move the data

The order matters, and none of it can be rehearsed on production:

1. Rehearse on `haleo-staging`: apply the 23 migrations, then restore a copy of the export. Check sign-in, a contractor inbox, an old brief.
2. Real users' **passwords** live in `auth.users`. A proper database dump carries them. If you only get table data without the auth schema, everyone has to reset their password or use Google sign-in.
3. **Storage files** (the `intake-media` bucket: photos, plans) are not in a database dump. They need copying separately, and the saved links inside old briefs point at the old project's address until rewritten.
4. Push-notification subscribers keep working only if the **same VAPID keys** are set on the new project. Secrets can't be read back from Supabase, so you need wherever those keys came from. If they're lost, generate new ones and people re-allow notifications.

### 4. Secrets on the new project (Project Settings, Edge Functions)

| Secret | For |
|---|---|
| `ANTHROPIC_API_KEY` | all the AI features (console.anthropic.com) |
| `GEMINI_API_KEY`, `OPENAI_API_KEY` | only the visibility scan, whose job is to measure those assistants |
| `GOOGLE_PLACES_API_KEY`, `YELP_API_KEY` | visibility scan (Google and Yelp) |
| `FIRECRAWL_API_KEY` | contractor license and portfolio lookups |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push notifications |
| `PUBLIC_APP_URL` | links in notifications, e.g. `https://haleo.studio` |

Optional: `ANTHROPIC_MODEL_FAST` (default `claude-sonnet-5-5`) and `ANTHROPIC_MODEL_SMART` (default `claude-opus-5-5`). Set the first to `claude-haiku-5-5` if cost matters more than the last bit of accuracy on proposal reading.

### 5. Auth settings on the new project

- Providers, Google: your own Google Cloud OAuth client (Google Cloud Console, Credentials). Authorized redirect URI is the one Supabase shows on the provider page.
- URL Configuration: Site URL `https://haleo.studio`, plus the Pages and staging addresses in Redirect URLs.

### 6. Cutover (plan an hour, off-peak)

1. Freeze: tell users, or put up a short maintenance note.
2. Take a fresh final export and restore it into `haleo-prod`. Re-check the counts of users, contractors and briefs against the old project.
3. Set the `PRODUCTION_*` GitHub secrets to the new project and run Deploy on `main`.
4. Test on `haleo.pages.dev` first: sign in, open an inbox, send a brief, trigger one AI feature.
5. Add the custom domain `haleo.studio` in Cloudflare Pages. DNS changes take effect within minutes to hours.
6. Keep the old project untouched for at least two weeks as the rollback. Rolling back is re-pointing DNS.

## Not verified

- The Claude calls have not run against the live Anthropic API: the adapter is unit-tested for the request and response shapes, but a real key hasn't been exercised. Run each AI feature once on staging before cutover.
- The default model choices are mine. Quality on proposal PDFs and floor-plan photos should be spot-checked on real files.
- Nothing was moved. No data, no users, no DNS.
