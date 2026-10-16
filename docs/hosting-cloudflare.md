# Hosting on Cloudflare Pages

`main` publishes production and `staging` publishes staging, from `.github/workflows/deploy.yml`. Nothing else is needed to host the site. No Lovable, no manual Publish button.

## One-time setup (about 15 minutes)

1. **Cloudflare account.** Free is enough. Note your **Account ID** (dashboard, right side of the Workers & Pages page).
2. **API token.** My Profile, API Tokens, Create Token, "Edit Cloudflare Workers" template, then restrict it to your account and add the permission **Cloudflare Pages: Edit**. Copy it once.
3. **Create the Pages project** (empty, direct upload): Workers & Pages, Create, Pages, "Upload assets", name it `haleo`. Set its production branch to `main`. (If you pick a different name, add a repository variable `CF_PAGES_PROJECT` with it.)
4. **Settings.** Put your Account ID in `deploy/production.env` as `CF_ACCOUNT_ID` (and the Supabase values; see `docs/new-backend.md`). Add the API token as the GitHub secret `CLOUDFLARE_API_TOKEN`.
5. **Run it.** Actions, Deploy, Run workflow on `main`. The site appears at `https://haleo.pages.dev`.
6. **Staging.** Create the `staging` branch (see `staging-setup.md`). Its address is `https://staging.haleo.pages.dev`.
7. **Your domain.** In the Pages project, Custom domains, add `haleo.studio`. If the domain's DNS is on Cloudflare this is one click. Otherwise Cloudflare shows the records to add at your registrar. Do this only at cutover (see `leaving-lovable.md`): it moves real traffic.

## Until the secrets exist

The workflow runs, says "hosting is not set up yet" and does nothing. It never fails a merge because of missing hosting.

## Things to set in Supabase for each environment

- Auth, URL Configuration: add the site address (`https://haleo.pages.dev`, the staging address, and `https://haleo.studio` at cutover) to Site URL and Redirect URLs.
- Auth, Providers, Google: your own Google OAuth client with those addresses as authorized redirect origins. Google sign-in no longer goes through Lovable.
