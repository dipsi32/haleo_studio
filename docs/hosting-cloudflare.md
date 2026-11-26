# Hosting on Cloudflare Pages

Three environments, each its own Pages project: merging to `main` publishes dev (`haleo-dev`); Actions, Promote publishes demo (`haleo-demo`) and production (`haleo`). The workflows create the projects on first use. **`docs/environments.md` is the guide;** this page covers the Cloudflare account and the domain.

## One-time setup (about 15 minutes)

1. **Cloudflare account.** Free is enough. Note your **Account ID** (dashboard, right side of the Workers & Pages page).
2. **API token.** My Profile, API Tokens, Create Token, "Edit Cloudflare Workers" template, then restrict it to your account and add the permission **Cloudflare Pages: Edit**. Copy it once.
3. **Create the Pages project** (empty, direct upload): Workers & Pages, Create, Pages, "Upload assets", name it `haleo`. Set its production branch to `main`. (If you pick a different name, add a repository variable `CF_PAGES_PROJECT` with it.)
4. **Settings.** Put your Account ID in `deploy/production.env` as `CF_ACCOUNT_ID` (and the Supabase values; see `docs/new-backend.md`). Add the API token as the GitHub secret `CLOUDFLARE_API_TOKEN`.
5. **Run it.** Actions, Deploy, Run workflow on `main`. The site appears at `https://haleo.pages.dev`.
6. **Dev and demo.** See `docs/environments.md`.
7. **Your domain.** See "Custom domain: haleo.studio" below.

## Until the secrets exist

The workflow runs, says "hosting is not set up yet" and does nothing. It never fails a merge because of missing hosting.

## Things to set in Supabase for each environment

- Auth, URL Configuration: Bootstrap sets this from `APP_URL` (Site URL) plus `APP_ALSO_URLS` (extra Redirect URLs) in `deploy/<env>.env`. You don't set it by hand.
- Auth, Providers, Google: your own Google OAuth client with those addresses as authorized redirect origins. Google sign-in no longer goes through Lovable.

## Custom domain: haleo.studio

Production lives at `https://haleo.studio`. `www.haleo.studio` and the old `https://haleo.pages.dev` keep working, so links already sent (contractor front doors, invites, sign-in emails) don't break.

Cloudflare Pages can serve the bare domain (`haleo.studio`, no www) only when Cloudflare runs the domain's DNS. The domain is registered at Namecheap, so the DNS moves to Cloudflare (free). Registration stays at Namecheap.

**Order matters: the domain has to be live before Bootstrap points sign-in and emails at it.**

1. **Add the domain to Cloudflare.** Cloudflare dashboard, Add a domain, `haleo.studio`, Free plan. Cloudflare imports existing records and shows two nameservers (like `xxx.ns.cloudflare.com`).
2. **Point Namecheap at Cloudflare.** Namecheap, Domain List, `haleo.studio`, Manage, Nameservers: change "Namecheap PremiumDNS" to **Custom DNS** and paste Cloudflare's two nameservers. Save. (PremiumDNS is no longer used after this.)
3. **Wait for Cloudflare to say the domain is Active.** Usually under an hour; can take up to 24. Cloudflare emails you.
4. **Merge the PR that set `APP_URL=https://haleo.studio`** (or run Actions, Deploy on `main`). The Deploy workflow attaches `haleo.studio` and `www.haleo.studio` to the Pages project (`CUSTOM_DOMAINS` in `deploy/production.env`) and reports each one as live or pending. If the API token can't attach domains, the run says so: add them by hand in Workers & Pages, `haleo`, Custom domains. With DNS on Cloudflare, Cloudflare creates the records itself.
5. **Run Actions, Bootstrap backend, production.** This points sign-in (Site URL and Redirect URLs) and the links in contractor emails at `https://haleo.studio`.
6. **Google sign-in, if used:** add `https://haleo.studio` to the OAuth client's authorized JavaScript origins in Google Cloud.

If you'd rather keep Namecheap's DNS: only `www.haleo.studio` can be served (a CNAME `www` to `haleo.pages.dev` at Namecheap, plus a Namecheap URL redirect from `haleo.studio` to `https://www.haleo.studio`). Then set `APP_URL=https://www.haleo.studio` and `CUSTOM_DOMAINS=www.haleo.studio`.
