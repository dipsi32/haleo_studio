## What's wrong today

- Roast page reads a little theatrical: "ripped off?", italic burns in quotes, "weirdly fun", "WTF" tag, "your paranoid friends will thank you". Fun, but tips into cliché and salesy.
- It claims a score without ever showing where the numbers came from. No sources, no sample sizes, no comps.
- Roast and the full Proposal Audit are two separate islands. Roast ends with a generic "Get a real brief" CTA instead of flowing into the audit it just half-did.

## Voice contract (applies everywhere going forward)

Bold, genuine, brutally honest, calm, young, intelligent, "got your back." Not dramatic. Not salesy. No clichés. No AI hyphens. No emoji confetti. One light wink per screen, max. Numbers and sources do the talking; copy stays out of the way.

Quick before / after to anchor it:

```text
Before: "Am I getting ripped off?"
After:  "See if your quote is fair."

Before: "$12,000 for a backsplash? Are they tiling it with 24k gold?"
After:  "$12,000 on the backsplash. Local median for this size is $3,800–$5,200. Worth a line-item conversation."

Before: "WTF"
After:  "Way over"
```

## Roast page rework (`src/pages/Roast.tsx`)

Keep the fun, lose the theater. Same three stages (upload → loading → result), tightened copy, real evidence shown inline.

**Upload stage**
- Headline: "See if your contractor's quote is fair." Subhead: "Upload the quote. Haleo checks it against local cost guides, permit comps, and prior Haleo proposals, then tells you straight."
- Drop the "REMODEL ROAST · BETA" flame pill; keep one small "Free. Anonymous." line.
- Keep the 3-step strip, but rewrite each step in plain language.

**Loading stage**
- Replace cute phases ("Squinting at your quote", "Composing your roast") with what's actually happening: "Reading the quote.", "Pulling local cost guides.", "Checking permit comps in {zip}.", "Comparing against {n} Haleo proposals.", "Scoring."
- Same animation, calmer copy. Drop "Usually 20–40 seconds" exaggeration; keep a small "This takes about 30 seconds."

**Result stage**
- Score card: keep the big number and tier, but rename tiers to honest, non-cliché labels: "Below market", "Fair", "A little high", "Notably high", "Way over". Remove emoji + italic-quote headline. Subline is one calm sentence, no quotation marks.
- Replace the "summary trio" with an evidence trio: Your quote · Local fair range · Where you land (percentile).
- **New "How Haleo got this number" card (the evidence block).** This is the centerpiece of the rework. Renders directly from data we already return from `roast-proposal` / `analyze-pricing`:
  - List each source used with a small chip: "HomeAdvisor cost guide", "Angi cost guide", "Local permits ({zip})", "Haleo proposal corpus (n=N)". Each shows weight and sample size when present.
  - Show the local fair range as a number line with the user's quote plotted on it.
  - Show 2–3 nearest permit comps (address line, scope, total) when available.
  - Confidence pill (high / medium / low) with a one-line "why" ("Based on 3 sources, 42 local comps").
  - Honest caveat line: "Estimate, not an appraisal. Always confirm with bids."
- Line-by-line: keep, but rewrite verdict labels (Fair / Below market / High / Way over), strip the italic quoted "burn", replace with a calm one-liner that cites the comparable ("Local median for this scope is $X–$Y"). Keep it dry, not snarky.
- Advice card: keep the dark card, rewrite as 2–3 concrete next steps, not a monologue.
- Share row: keep, rewrite caption defaults to be matter-of-fact, not "paranoid friends".

**New: flow into the full audit**
- Replace the "Get a real brief" CTA with a primary CTA: "Run the full audit on this quote" → routes into the existing Proposal Audit flow with the already-uploaded file + extracted data pre-loaded, so the user doesn't re-upload.
- Secondary CTAs: "Roast another quote", "Save this report" (email link).

## Proposal Audit reflow (`src/pages/ProposalIntelligencePage.tsx` + entry points)

Goal: make Roast the front door, and make the audit feel like the deeper version of the same conversation, in the same voice.

- Accept a handoff from Roast: when the user clicks "Run the full audit," reuse the uploaded file, extracted line items, zip, scope, and the pricing result already computed. No second upload, no second wait on the parts we've done. Audit picks up at the "deeper analysis" step (red flags, contract terms, scope completeness, contractor signals, comparable projects).
- Top of the audit page shows the same evidence block from Roast (sources, fair range, comps, confidence) so the through-line is visible. The audit then layers on what Roast doesn't do: red flags, missing scope items, contract risk, contractor CSLB signals, comparable projects with detail, locked premium sections.
- Copy pass on the page: rewrite all helper text, section intros, empty states, "How we got this range" card, confidence badges, `haleoInsight` blurb, disclaimers, and locked-section teasers in the new voice. No "leverage", "robust", "seamless", "unlock the power of". No em-dash flourishes.
- Entry points updated so Roast is the canonical start:
  - Homepage `RoastHook` becomes the primary "Check a quote" entry; the standalone "Audit a proposal" button on `Index.tsx` is rewritten to "Already got the Roast? Go deeper." and routes into the audit with the handoff.
  - Direct `/audit` entry still works; it just starts with its own upload step instead of the handoff.

## Edge functions (prompt-only changes)

- `roast-proposal`: tighten system prompt so model output stops being theatrical. Forbid: rhetorical questions, "ripped off", "WTF", "are they tiling it with gold", emoji, em-dash flourishes, exclamation marks beyond one per response, quoted burns, exaggeration. Require: cite the comparable when calling something high ("Local median for this scope is $X–$Y"), keep each line under 18 words, neutral verdict labels matching the new UI set. Return the evidence payload the new UI needs (already mostly returned; confirm `sources`, `sampleSize`, `confidence`, nearest comps are present and pass through unchanged).
- `analyze-pricing` and `analyze-proposal`: same voice rules in the `haleoInsight` / `haleo_tips` prompts. No logic changes, no schema changes.

## Out of scope

- No backend schema changes, no new tables, no new routes (audit handoff uses query/state on the existing `/audit` route).
- No visual redesign beyond the evidence block and copy. Colors, layout grid, components stay.
- Pricing logic, contractor unlock flow ("Test mode" $99 stays as is), and Lovable Cloud naming all unchanged.

## Deliverable

A Roast page that is still fun but trustworthy, shows its work, and feeds straight into the full Proposal Audit without re-uploading. Audit shares the same evidence block and the same voice, so the whole flow reads like one calm, sharp friend instead of two products bolted together.
