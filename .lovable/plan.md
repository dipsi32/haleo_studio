## Goal

One bid-comparison surface that handles **both** sources of proposals — PDFs the homeowner uploads themselves AND proposals contractors submit through Haleo — and tells the homeowner, in plain language, *what makes one contractor stand out over the others* on each parameter that matters.

No new scoring math. We already have `src/lib/proposalComparison.ts` (5 weighted dimensions, `haleoScore`, `computeVerdict`, `draftPushback`). We're closing the loop on input + presentation only.

---

## What exists today

- `/proposal` (`ProposalIntelligencePage.tsx`) — single-PDF upload + audit. Stores rows in `proposal_analyses` with `user_id` (no `outreach_send_id`).
- Contractor-submitted bids — flow through `outreach_sends.proposal_submitted_at` and create `proposal_analyses` rows linked by `outreach_send_id`.
- `/proposal/compare` (`ProposalsCompare.tsx`) — already loads contractor-submitted analyses and renders verdict + per-dimension scoring. **Does not currently include uploaded-only PDFs.**
- `proposalComparison.ts` — full scoring engine.

The gap: uploads and contractor submissions live in the same table but are never pulled into the same comparison view, and the per-row "why this one wins on permits" callouts only exist inside drilldown.

---

## Plan

### 1. Treat every analyzed proposal as comparable, regardless of source

Extend `ProposalsCompare` query to load BOTH:
- `proposal_analyses` rows tied to `outreach_sends` for this homeowner (current behavior)
- `proposal_analyses` rows where `user_id = auth.uid()` AND `outreach_send_id IS NULL` (uploaded PDFs)

Normalize both into the existing `AnalyzedProposal` shape. Uploaded rows use `extracted_data.contractor_name` and synthesize a stable `send_id` like `upload:<analysis_id>`. Source-tag each card: **"Uploaded by you"** vs **"Submitted via Haleo"** — small badge, not a section split. Comparison is one list.

### 2. One entry point on `/proposal`, one on the homeowner dashboard

On `ProposalIntelligencePage.tsx`, after a successful single-bid audit, surface a calm CTA: **"Add another bid to compare side-by-side"** — re-uses the same uploader, just stamps `comparison_group` on the new analysis. Up to 3 total.

Group uploads by a new `comparison_group_id` (UUID) on `proposal_analyses` so a homeowner can have multiple independent comparison sets (kitchen vs bathroom). Contractor-submitted bids implicitly group by `batch_id`.

### 3. Make "what makes this one stand out" the centerpiece

Today the verdict line is generic ("strongest overall"). Replace the top of each comparison card with a **Standout strip** — 1-3 chips that show *only the dimensions where this contractor is meaningfully better than the others in this set*.

Computed (no new scoring) by diffing each contractor's per-dimension score against the set median:

```
Permits     +18 pts vs others →  "31 SJ permits, 94% finalized — most in this set"
Payment     +25 pts vs others →  "10% deposit, 4 milestones — only one within CA cap"
Scope        −22 pts vs others →  "Missing electrical + tile line items"
```

Rules:
- Chip shows only when the gap to the next-best is ≥10 points on that dimension.
- Positive gaps render sage; negative render danger; neutral hidden.
- Each chip has a single concrete sentence pulled from existing `dimension.explanation` + the underlying field (permit count, deposit %, missing trades), so claims map to evidence already in the row. No invented numbers.
- If a contractor has no standout (all dimensions within ±10 of median), show one honest line: "No clear edge — competitive across the board."

This is the bit that takes the stress out: at a glance the homeowner sees *why* the recommendation lands where it does, not just a score.

### 4. Honest verdict when sources are mixed

If the set mixes uploaded PDFs and Haleo-submitted bids, add one line under the verdict: *"Permit history and license checks are richer for the 2 contractors who submitted through Haleo. The uploaded bid has scope + pricing data only."* Prevents an apples-to-oranges win that's really a data-availability artifact.

### 5. Edge cases (no surprises)

- 1 proposal in set → "Add a second bid to unlock comparison" (existing behavior, keep).
- Any `pending` analysis → skeleton card, poll every 3s (already wired for contractor side; extend to uploads).
- All have ≥1 critical flag → existing `all_flagged` verdict; no winner crowned.
- Top two within 4 pts → existing `tie` verdict + standout strips do the differentiating.

---

## Technical section

**DB migration** (one):
- `proposal_analyses.comparison_group_id uuid null` + index. Stamped on upload when user clicks "Add another bid"; null otherwise.

**Files to change:**
- `src/pages/ProposalsCompare.tsx` — extend query to union uploaded analyses; render source badge; render Standout strip above each card.
- `src/lib/proposalComparison.ts` — add pure helper `computeStandouts(scored: ScoredProposal[]): Record<sendId, StandoutChip[]>` that diffs each dimension against set median and emits chips with evidence sentences. No changes to existing scoring.
- `src/pages/ProposalIntelligencePage.tsx` — post-audit CTA "Add another bid to compare" that re-opens uploader with `comparison_group_id` carried through; "Compare bids" link when group has ≥2.
- `src/components/HomeownerPathChooser.tsx` — surface "Compare bids you've received" as a returning-user shortcut when the homeowner has ≥2 analyzed proposals (uploaded or submitted).

**No changes to:** `analyze-proposal` edge function, scoring weights, `outreach_sends` schema, contractor flow.

---

## Out of scope (call out, don't build)

- AI-written "negotiation winner-picker" — `draftPushback` already does this per-bid; we're not adding a new generator.
- Cross-project comparison (kitchen bids vs bathroom bids in one view).
- Paid tier gating on comparison — first comparison stays free per existing posture.
