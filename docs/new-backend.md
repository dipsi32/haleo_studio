# A new backend from scratch

No data from the old project. Everything is created new and wired up by pipelines you can re-run.

What you do: make a few accounts and paste keys into GitHub. What the pipelines do: build the database, load the functions, set sign-in, deploy the site, and test it.

## 1. Accounts and keys (about 30 minutes, once)

| You make | You copy out |
|---|---|
| **Supabase**: two new projects, `haleo-staging` and `haleo-prod`. Pick a strong database password for each and save it. Region: West US (N. California). If `haleo-staging` already exists from earlier, delete it and make a fresh one. | per project: **project reference** (the code in its dashboard address), **database password**, **API URL**, **publishable (anon) key** (Project Settings, API) |
| **Supabase access token** | supabase.com/dashboard/account/tokens, "Generate new token" |
| **Anthropic**: console.anthropic.com, API Keys | the key |
| **Cloudflare**: free account | **Account ID** (goes in the `.env` file) and an API token (a secret) (Edit Cloudflare Workers template plus Pages: Edit). Create a Pages project named `haleo` with "Upload assets", production branch `main`. |
| **Google sign-in** (optional; email sign-in works without it): console.cloud.google.com, Credentials, OAuth client ID (Web). Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback` for each Supabase project | client ID and secret |
| **Push notifications** (optional): run `npx web-push generate-vapid-keys` | public and private key |
| **Optional extras**: Gemini and OpenAI keys (visibility scan), Google Places and Yelp keys (visibility scan), Firecrawl key (license lookups) | the keys |

## 2. Tell GitHub (a few minutes)

Most of what the pipelines need is **not secret**: the Supabase project reference, URL and public key (they ship inside the website anyway), your Cloudflare account ID, and the site address. Those live in two files in the repo, `deploy/production.env` and `deploy/staging.env`. You can paste them to me in chat and I'll fill the files in, or edit the files on github.com (pencil icon).

Only the real secrets go into GitHub. For each one: your repo on github.com, Settings, Secrets and variables, Actions, **New repository secret**, type the name, paste the value, Add secret. Once saved, nobody (including you) can read a secret back, which is the point.

| Secret name | Value | Needed for |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | your Supabase access token | all |
| `PRODUCTION_DB_PASSWORD` | `haleo-prod` database password | production |
| `STAGING_DB_PASSWORD` | `haleo-staging` database password | staging |
| `ANTHROPIC_API_KEY` | Anthropic key | AI features |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token | publishing |

Optional extras (add later, each skipped with a warning if missing): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `YELP_API_KEY`, `FIRECRAWL_API_KEY`. The push-notification subject and similar are not needed.

For a production-only start, that's **four secrets**: `SUPABASE_ACCESS_TOKEN`, `PRODUCTION_DB_PASSWORD`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`.

## 3. Build staging

1. Actions, **Bootstrap backend**, Run workflow, choose `staging`. It builds the database (all 23 migrations), sets the function secrets, deploys the functions, sets the sign-in addresses and Google, then runs a smoke test. Each step is safe to re-run.
2. Create the `staging` branch so the site publishes:
   ```
   git fetch origin main && git branch staging origin/main && git push -u origin staging
   ```
   The **Deploy** workflow builds it and publishes `https://staging.haleo.pages.dev`.

## 4. Test staging

Open the staging address. You should see the amber "Staging" ribbon. Many pages are behind the early-access gate, so **sign up first with `deepa.dinakar@gmail.com`**: that address becomes admin automatically on a fresh database and bypasses the gate. Add any test emails under `/admin` so they get access too. Then:

- Sign up as a homeowner, make a brief.
- Sign up as a contractor at `/pro/login`, create a link at `/pro/links`, send a brief to yourself, open `/pro/inbox` (the Visit prep card).
- Try one AI feature (upload a proposal at `/audit`).
- Run the smoke test from your own machine if you like: `node scripts/smoke.mjs <url> <key> https://staging.haleo.pages.dev`.

## 5. Production

1. Bootstrap backend, choose `production`.
2. Merge PR #6 into `main`. Deploy publishes `https://haleo.pages.dev`.
3. Repeat the checks above on the production address.
4. In Cloudflare Pages, Custom domains, add `haleo.studio`. Set the `PRODUCTION_APP_URL` variable to `https://haleo.studio` and run Bootstrap backend (production) again so sign-in addresses match.

## What the pipelines guard against

- Staging and production sharing one Supabase project: refused.
- A staging build pointing at production: the build refuses.
- Public test-data functions (`seed-test-*`) reach production: skipped there.
- A backend that "deployed" but isn't usable: the smoke test fails the run and says which part.
- Missing keys: each missing one is named in the log, and optional ones are skipped with a warning.

## When something fails

Open the failing run in Actions; every step names what it needs. Send me the log and I'll fix it. The usual first-run suspects are a mistyped secret, a database password that doesn't match the one set at project creation, and a Google redirect address that doesn't match.

If `supabase link` reports that the project is paused, an admin must restore it from the Supabase dashboard before rerunning **Bootstrap backend**. Free-plan projects can pause after a period of inactivity; this cannot be fixed by the workflow.
