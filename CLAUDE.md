# Haleo: how we build

Haleo helps homeowners hire the right contractor and pay a fair price, and helps contractors win the jobs they want. San Jose first. Founder: Deepa (product and UX research). We are applying to Y Combinator, so everything we ship should either earn traction or make traction measurable.

## Product principles (apply to every change)

1. **Meet them at the moment of pain, where they already are.** The homeowner is in a Nextdoor thread with 40 names, holding a quote they don't trust, or texting a contractor. The contractor just got an inquiry and is deciding whether to drive out. Every entry point starts from that moment, in their words, and asks for nothing they don't already have.
2. **Cognitively easy.** One decision per screen. Lead with the answer ("Start with Acme Builders"), then the reasons. Plain words, no jargon or codes ("C-36" becomes "Plumbing"). Defaults that are right for most people. Everything optional is labelled optional.
3. **Honest, every line.** Label where each fact comes from: Public record, Their words, Their numbers, Our inference. Never state a code rule, a price estimate or a license status we didn't read. "Not checked" is never shown as "fine". Haleo doesn't vet, endorse or rate people. Trust is the product, and one overclaim costs more than any feature earns.
4. **Delight comes from feeling smart and looked after,** not from decoration. The "how did you know that?" moment: a fact they didn't expect, a question they'll be glad they asked, a message already written for them. Calm, warm, confident voice. We've got their back.
5. **Distribution is built into the product, not bolted on.** Every useful thing a user makes should naturally reach the other side or a neighbor:
   - Homeowner → contractor: bid requests and briefs carry Haleo to contractors who aren't on it yet. Make the contractor's first view valuable enough to claim their profile.
   - Contractor → homeowner: brief links (`/pro/links`) and visit prep. The homeowner should feel looked after, and they leave with something worth keeping.
   - Homeowner → homeowner: the thread they came from. Give them something worth posting back.
   Each loop needs an event that measures it (see `src/lib/analytics.ts`).
6. **One product, whichever door they came through.** Shortlist (`/shortlist`), brief (`/brief`), contractor invite (`/i/:token`), quote check (`/roast`, `/proposal`) and the contractor side (`/pro`) share one visual language, one voice and one set of components. A user who moves between flows should never feel they changed apps. When adding a screen, reuse the existing patterns (eyebrow, display headline with an italic turn, rounded cards with `shadow-soft`, source badges, sticky bottom action) before inventing new ones. Known drift to fix: `/roast` uses its own serif and orange look, the homepage hero is its own design world, and the homepage and `SiteHeader` have separate navs.
7. **Measure what matters for YC.** Prefer metrics that show pull: shortlists completed, bid requests sent, contractors who open what homeowners send, profiles claimed from those, briefs sent through contractor links, repeat use. Name events in `analytics.ts` and say in the PR which metric a change should move.

## Engineering notes

- React + Vite + TypeScript + shadcn/Tailwind. Supabase (Postgres with row-level security, auth, edge functions in `supabase/functions`). Hosting on Cloudflare Pages. AI is Claude, through `supabase/functions/_shared/ai.ts`.
- Before pushing: `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint <changed files>`, `npx vitest run`, `npm run build`. Building regenerates `supabase/functions/mcp/index.ts`, so revert it with `git checkout -- supabase/functions/mcp/index.ts`.
- Pure logic goes in `src/lib/*.ts` with a `*.test.ts` next to it. Pages stay thin.
- Merging to `main` publishes the site (Deploy workflow). New or changed edge functions and migrations only go live when **Actions → Bootstrap backend → production** runs.
- No Lovable. This is a Claude Code project.
- Docs for each feature live in `docs/` (for example `docs/shortlist.md`, `docs/contractor-visit-prep.md`, `docs/new-backend.md`).
