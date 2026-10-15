# Staging: a safe copy to test on

Staging is the same app, pointed at its **own** Supabase project, on its own web address, so you can click through new work with test data before real contractors and homeowners see it.

```
feature branch → PR → main ─────────────► production (haleo.studio, Cloudflare Pages)
                  └→ staging branch ────► staging site + staging Supabase
```

## What's already in the repo

- `npm run build:staging` builds with the staging settings. **It refuses to build if the settings point at the production Supabase project**, so staging can't write to real data by accident.
- A slim amber ribbon ("Staging. Test data only…") on every page, a `noindex` tag, and a `[Staging]` tab title. None of it appears in production builds.
- Analytics are not sent from staging.
- `.env.staging.example` is the template for the three settings staging needs.
- `.github/workflows/staging-migrations.yml` pushes migrations and deploys edge functions to the staging Supabase project when `develop` or `staging` changes.
- `.github/workflows/deploy.yml` tests, builds and publishes `main` (production) and `staging`.
- `public/_redirects` makes deep links (like `/pro/inbox`) work on Netlify and Cloudflare Pages.

## One-time setup (about 20 minutes)

### 1. The staging Supabase project

A project named `haleo-staging` (`hacelukszewlrstzbhti`, us-west-1) already exists in the dipsi32 Supabase org. It has 3 of the 23 migrations applied by hand, so the workflow can't use it as it is. Pick one:

- **Easiest:** in the Supabase dashboard, delete `haleo-staging` and create a new empty project with the same name. Note its **project reference**, **database password**, **URL** and **publishable (anon) key** (Project Settings, API).
- **Or:** reconnect the Supabase connector in Claude and ask for a reset of `haleo-staging`.

### 2. GitHub secrets

Repo, Settings, Secrets and variables, Actions, New repository secret:

| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `STAGING_PROJECT_ID` | the staging project reference |
| `STAGING_DB_PASSWORD` | set when the project was created (reset it in Project Settings, Database if lost) |
| `STAGING_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `STAGING_SUPABASE_PUBLISHABLE_KEY` | Project Settings, API, anon / publishable key |

### 3. Create the `staging` branch

```
git fetch origin main
git branch staging origin/main
git push -u origin staging
```

The first push runs both workflows: the database comes up with all 23 migrations and the edge functions, and the site builds. Watch the Actions tab. If the first run fails on a migration, send me the log; a fresh database can surface ordering problems that production never saw.

### 4. Publish the staging site

The Deploy workflow publishes `staging` to Cloudflare Pages. Set it up once with `docs/hosting-cloudflare.md`; the staging address is `staging.<project>.pages.dev` unless you add a custom domain.

### 5. Staging Supabase settings you'll want

- **Auth, URL configuration:** add the staging site address to Site URL and Redirect URLs, or sign-in links will bounce to production.
- **Auth, providers:** turn on the same sign-in methods (Google, email) as production, with the staging address in each provider's allowed redirects.
- **Edge function secrets** (Project Settings, Edge Functions): `LOVABLE_API_KEY` for AI features. `GOOGLE_PLACES_API_KEY` and `YELP_API_KEY` are only needed for live visibility scans.
- **Admin access:** your founder email gets the admin role automatically the first time you sign up on staging.

## Day to day

1. Open a PR into `main` as usual.
2. To try it on staging first: merge the same branch into `staging` (`git push origin <branch>:staging`, or a PR into `staging`). The workflows do the rest.
3. When it looks right on staging, merge into `main`. The Deploy workflow publishes it.

## Production publishing

Merging to `main` publishes production through the Deploy workflow and Cloudflare Pages. See `docs/hosting-cloudflare.md`.

## Not covered

- Staging has no real contractors or homeowners. Create test accounts, or use the `seed-test-contractor` edge function.
- The parcel and permit lookups hit the same public city and county sources as production.
- Staging and production share one GitHub repo, so a bad merge into `main` still reaches production. Use `staging` first for anything risky.
