# Environments: dev, demo, production

Three copies of Haleo, each with its own database and its own job. Code only moves forward.

| | Dev (canary) | Demo | Production |
|---|---|---|---|
| Address | dev.haleo.studio, plus a preview per pull request (pr-12.haleo-dev.pages.dev) | demo.haleo.studio | haleo.studio |
| Updates when | every merge to `main`, automatically | Actions, **Promote**, demo | Actions, **Promote**, production (the exact build on demo) |
| Database | Supabase `haleo-dev` | Supabase `haleo-demo` | Supabase `rpvetitrrdfycvoyxept` |
| Who gets in | team only (Cloudflare Access, Google) | anyone with the link; hidden from search | everyone |
| On screen | "Dev" pill in the header | "Preview" pill in the header | nothing |
| Analytics | not sent | sent, tagged `app_env = demo` | sent, tagged `app_env = production` |
| Settings | `deploy/dev.env` | `deploy/demo.env` | `deploy/production.env` |

Why: dev is allowed to break. Demo is the release candidate. It's stable enough to put in front of research participants, and research sessions stay out of the numbers we show YC. Production only gets what demo already proved. A promotion ships the backend (migrations, edge functions, sign-in settings) first, then the site, so the site never runs ahead of its backend.

## Day to day

- **Ship to dev:** merge a pull request into `main`. Deploy updates dev.haleo.studio within a few minutes. If the merge touched `supabase/`, it redeploys dev's backend first. Every pull request also gets its own preview link (in the run's summary), on the dev backend.
- **Ship to demo:** Actions, Promote, Run workflow, *to: demo*. It takes the latest `main`. To pick an older build, paste its commit in *commit*.
- **Ship to production:** Actions, Promote, Run workflow, *to: production*. It takes exactly what's on demo. *source: main* skips demo, for emergencies only.
- **What's live where:** the tags `env/demo` and `env/production`. Each Promote run's summary lists the changes since the last release.
- **Approval before production (recommended):** in the repo, open Settings, Environments, `production`, and add yourself under Required reviewers. Production promotions then wait for your click.

## Sign-in

- **Production:** the site is open, and sign-in is asked for when it's worth it: saving a project, sending a request, the contractor side. Google is the first button; email is the backup. Nothing that homeowners or contractors share sits behind a wall: the house card, briefs and invite links all work without an account.
- **Demo:** the same as production, against demo's own database.
- **Dev:** the whole site sits behind Cloudflare Access (Google), so only the team gets in. The app's own sign-in works inside it as usual.

## One-time setup

The order matters: steps 1–3 unblock everything else.

### 1. haleo.studio's DNS on Cloudflare

All three addresses live under haleo.studio, so this comes first. Follow "Custom domain: haleo.studio" in `docs/hosting-cloudflare.md`: Cloudflare, Add a domain, then Namecheap, Nameservers, Custom DNS, Cloudflare's two. When Cloudflare says Active, the pipelines attach `haleo.studio`, `www`, `demo` and `dev` on their own.

### 2. Supabase

- Move the organization to **Pro**. Free projects pause after a week without traffic and have no backups, which isn't safe once real people use production.
- Create two projects in West US (N. California): **haleo-dev** and **haleo-demo**. Save each database password.
- For each new project, put these in its settings file (`deploy/dev.env` or `deploy/demo.env`). They aren't secret, and you can paste them to Claude to fill in:
  - `PROJECT_REF`: the code in the project's dashboard address
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`: Project Settings, API, anon key
- Add the database passwords as GitHub secrets **`DEV_DB_PASSWORD`** and **`DEMO_DB_PASSWORD`**: repo Settings, Secrets and variables, Actions.

### 3. Google sign-in

Use one Google client for all three environments. In console.cloud.google.com:

1. **Google Auth Platform, Branding:** app name Haleo, support email, home page `https://haleo.studio`, privacy policy link, and authorized domain `haleo.studio`. Then **Audience: Publish app** (status "In production"). While it's "Testing", only listed test users can sign in. Haleo asks only for name and email, which doesn't need Google's verification review.
2. **Clients, Create client, Web application, "Haleo".**
   - Authorized JavaScript origins: `https://haleo.studio`, `https://demo.haleo.studio`, `https://dev.haleo.studio`
   - Authorized redirect URIs, one per Supabase project:
     - `https://rpvetitrrdfycvoyxept.supabase.co/auth/v1/callback`
     - `https://<haleo-demo ref>.supabase.co/auth/v1/callback`
     - `https://<haleo-dev ref>.supabase.co/auth/v1/callback`
3. Add the GitHub secrets **`GOOGLE_OAUTH_CLIENT_ID`** and **`GOOGLE_OAUTH_CLIENT_SECRET`**.
4. Run Actions, **Bootstrap backend**, `production`. This turns Google on and sets the sign-in addresses. Promotions repeat it for demo, and dev's first deploy does it for dev.

### 4. Sign-in emails through Resend

Supabase's built-in mailer sends only a few emails an hour, so the second or third person to sign up by email would get nothing. Route sign-in emails through Resend instead:

- In Resend, verify `haleo.studio` (it gives you DNS records; add them in Cloudflare).
- Add the secret **`RESEND_API_KEY`**.
- Add the repository variable **`RESEND_FROM`**, for example `Haleo <hello@haleo.studio>`.

Bootstrap does the rest.

### 5. Dev behind Cloudflare Access

In Cloudflare, open Zero Trust (free for up to 50 people), then Access, Applications, Add, Self-hosted:

- Application domains: `dev.haleo.studio` and `*.haleo-dev.pages.dev`. The second covers pull-request previews and the raw Pages address, so neither is a back door.
- Identity: Settings, Authentication, add **Google**. You can reuse the Google client from step 3; Cloudflare shows the redirect URI to add to it.
- Policy: Allow, emails in a list (yours, the team's).

Demo stays open, unlisted and hidden from search. If you ever want it private, add an Access application for `demo.haleo.studio` with the "One-time PIN" login and the participants' emails.

### 6. First run

1. Merge the pull request that set this up. With `deploy/dev.env` filled in, dev builds itself.
2. Actions, Promote, demo.
3. Check demo end to end.
4. Actions, Promote, production.

## Secrets and variables

| Name | Kind | For |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | secret | all backends |
| `PRODUCTION_DB_PASSWORD`, `DEMO_DB_PASSWORD`, `DEV_DB_PASSWORD` | secrets | each database |
| `CLOUDFLARE_API_TOKEN` | secret | publishing (Pages: Edit) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | secrets | Google sign-in |
| `RESEND_API_KEY` | secret | sign-in and app emails |
| `RESEND_FROM` | variable | sender, e.g. `Haleo <hello@haleo.studio>` |
| `ANTHROPIC_API_KEY` and the optional keys | secrets | AI and lookups, shared by all three |

## Guard rails

- A dev or demo build refuses to point at the production database (`vite.config.ts`).
- Bootstrap refuses two environments on one Supabase project.
- Each environment is its own Cloudflare Pages project (`haleo`, `haleo-demo`, `haleo-dev`), so a dev deploy can't replace production.
- The `seed-test-*` functions, which create test data, deploy to dev only.
- Dev, demo and previews send `X-Robots-Tag: noindex` and a disallow-all `robots.txt`.
