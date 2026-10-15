# Haleo

An AI renovation advisor for homeowners, and a faster way for contractors to decide which jobs are worth the drive. San Jose first.

Built with Claude Code. React 18, Vite, TypeScript, Tailwind and shadcn/ui on the front; Supabase (Postgres, Auth, Edge Functions) behind it; Claude for the AI features.

## Run it

```
npm ci
cp .env.staging.example .env.local   # then fill in your own Supabase project
npm run dev
npm test
```

## Where things are

- `src/` the app. `src/lib/` holds the pure logic and its tests.
- `supabase/migrations/` the database, in order. `supabase/functions/` the edge functions. `supabase/functions/_shared/ai.ts` talks to Claude.
- `docs/` design notes, the hosting guide (`hosting-cloudflare.md`), staging (`staging-setup.md`) and the plan for the backend move (`leaving-lovable.md`).

## Environments

`main` publishes production and `staging` publishes staging, both to Cloudflare Pages through `.github/workflows/deploy.yml`. Each uses its own Supabase project.
