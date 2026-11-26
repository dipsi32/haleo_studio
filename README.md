# Haleo

An AI renovation advisor for homeowners, and a faster way for contractors to decide which jobs are worth the drive. San Jose first.

Built with Claude Code. React 18, Vite, TypeScript, Tailwind and shadcn/ui on the front; Supabase (Postgres, Auth, Edge Functions) behind it; Claude for the AI features.

## Run it

```
npm ci
# .env.local: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from deploy/dev.env
npm run dev
npm test
```

## Where things are

- `src/` the app. `src/lib/` holds the pure logic and its tests.
- `supabase/migrations/` the database, in order. `supabase/functions/` the edge functions. `supabase/functions/_shared/ai.ts` talks to Claude.
- `docs/` design notes, the hosting guide (`hosting-cloudflare.md`), the three environments (`environments.md`) and the plan for the backend move (`leaving-lovable.md`).

## Environments

Three environments, each with its own Supabase project (`docs/environments.md`): merging to `main` publishes **dev** (dev.haleo.studio); Actions, **Promote** moves a build to **demo** (demo.haleo.studio) and then **production** (haleo.studio).
