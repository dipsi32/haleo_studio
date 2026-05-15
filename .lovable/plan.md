## Why this needs a plan, not a one-shot edit

The Trust Score is the heart of the product. Right now it's a 7-signal model worth 100 pts, with **two "coming soon" rows that auto-credit 10 pts to everyone** and **CSLB data fully ingested but not in the score**. We need to fix those gaps, widen the inputs, and add the contextual + capacity intelligence that turns this into something defensible — without breaking the homeowner-facing UI mid-flight.

I'm proposing a 4-phase build. Each phase ends with a shippable, more-accurate score.

---

## Phase 1 — Stop the bleeding + wire CSLB into the score (this loop)

The fastest accuracy win. No new data sources required — CSLB is already in `cslb_licenses` + `contractor_license_cache`, just unused by `computeTrustScore`.

**Score model v2 (100 pts):**

```text
LIVE NOW
 20  Local track record       (was 25 — make room for CSLB)
 15  Recent activity          (was 20)
 12  Right kind of work       (was 15)
 12  Finishes what they start (was 15)
 13  No abandoned permits     (was 15)
 ── 
 18  License standing  ← NEW from CSLB (active=full, expiring=−4, expired/suspended=0)
  5  Bond on file      ← NEW from CSLB
  5  Workers' Comp     ← NEW from CSLB  (missing WC is a homeowner liability bomb)
  ─ 
 ≤−15 Disciplinary actions    ← NEW, hard penalty applied AFTER sum, capped
 ≤−10 Mismatched business name ← NEW, penalty
                                                 = 100 pts ceiling

DROPPED FROM SCORE (kept as displayed signals only, not score-bearing):
 ·  Inspection pass rate     → moved to "Coming in Phase 2" badge, no auto-credit
 ·  Code violations on past sites → kept live where data exists, displayed but worth 0 until coverage > X%
```

**Why this is the right v2:**
- Fixes the artificial inflation (no more free 10 pts for everyone).
- License/bond/WC are the three things a homeowner is told to check on every consumer-protection guide — and we're the only ones doing it automatically.
- Disciplinary actions become a true deal-breaker, not a side-pill.

**Files touched:**
- `src/lib/contractors.ts` — rewrite `computeTrustScore`, take `LicenseStatus` as a real input, add penalty model.
- `src/lib/useContractors.ts` — already passes license, no change needed.
- Profile + card UIs — copy refresh on each row's `what` text.

---

## Phase 2 — Inspection pass rate + stop-work orders (next loop, needs new ingest)

These come from the **San José Building Permits Activity** + **Code Enforcement** datasets we're already hitting, plus the **Inspections** dataset we haven't.

**New edge function: `fetch-sj-inspections`**
- Source: SJ Open Data — Building Inspections (`inspections.csv`, joined to permits by permit number).
- Per contractor compute:
  - `inspection_attempts` — total inspections recorded
  - `inspection_failures` — count where result ∈ {Failed, Partial, Correction Notice}
  - `first_pass_rate` — inspections that passed on attempt #1 / total finals
  - `avg_attempts_to_pass` — for permits that eventually passed final
- Stop-work orders surface in the same dataset under result codes / a separate "Notices" feed; we capture `stop_work_orders` count and `stop_work_last_date`.

**New table: `contractor_inspection_signals`**
```text
contractor_id          uuid PK
total_inspections      int
total_failures         int
first_pass_rate        numeric(4,3)
avg_attempts           numeric(4,2)
stop_work_orders       int
stop_work_last_date    date
last_calculated_at     timestamptz
```

**Score model v3** turns the "Coming Soon" inspection row into a real **10-pt** component (taken from local track record + recent activity) and adds a **−15 pt stop-work penalty**.

---

## Phase 3 — Contextual + capacity intelligence (the moat)

This is where the patent story lives. All computed from data we already have once Phase 2 lands — no new sources.

1. **Recency-weighted permit scoring.** Replace the binary "last 12 months" cutoff with exponential decay: `weight = exp(-age_months / 24)`. A permit from 6 months ago counts 0.78×, from 3 years ago 0.22×. Applied across local count, type-match, and completion.

2. **Project-fit vector, not keyword count.** Today: substring match on `work_type`. New: tag every permit with a coarse project type (`kitchen`, `bath`, `addition`, `adu`, `whole_home`, `roof`, `mep_only`, `deck`, `solar`). Score project fit as `cosine(contractor_type_distribution, target_type_one_hot)`. A 50-deck contractor bidding an addition scores ~0.1, not the current ~0.

3. **Complexity trajectory.** Bucket permits by valuation tier (`<$25k`, `$25–100k`, `$100–500k`, `$500k+`). Compute median valuation by year. A contractor whose median tier is rising over 5 years is "growing into your job"; flat or declining = "stuck at smaller scope". Surfaced as a new badge, modest score effect (±3 pts).

4. **Capacity / availability signal — the real-time inference.**
   - `active_permits` = permits with `issued_date` in last 18 mo AND no `completed_date`.
   - `historical_throughput` = trailing-12-month moving average of permits closed.
   - `capacity_pressure = active_permits / historical_throughput` (>1.5 = stretched).
   - This is **not** a score component. It's a separate "Likely availability" pill on the card: *"Looks available"* / *"Stretched right now — expect slow replies"* / *"Likely overloaded"*.
   - Patentable framing: *"Method for inferring real-time service-provider capacity from public permit issuance and completion records."*

---

## Phase 4 — Outcome data loop (the long-term moat)

The pilot homeowners are the goldmine. After project close (or any milestone marked "done"), trigger a 3-question micro-survey:

```text
1. Did this finish on time?              [Yes / Close / No]
2. Did it land within budget?            [Yes / Close / No]
3. Would you hire them again?            [Yes / Maybe / No]
```

**New table: `homeowner_outcome_reviews`** — `outreach_send_id`, `contractor_id`, `homeowner_user_id`, three enums, optional comment, `submitted_at`. RLS: homeowners write/read own; contractors read aggregates only via a security-definer function.

Surfacing: **"Verified by Haleo homeowners"** badge appears on a contractor card the moment they have ≥3 reviews. Aggregate appears as a 5th band on the score breakdown — *"What past Haleo customers said"* — but doesn't enter the 100-pt total until n≥5 (avoids early bias). Eventually it eats weight from the proxy signals.

---

## Sources we are deliberately deferring

These are great but each adds a non-trivial moving piece I don't want to bundle into the same loop:

- **Mechanic's liens** — county recorder data, no clean API for SCC; would need scraping or a paid API (CourtHouseDirect / DataTree). Defer to Phase 3.5.
- **Federal tax liens** — IRS no longer publishes these publicly since 2018; PACER for bankruptcy is the realistic proxy. Low ROI right now.
- **BBB complaints** — no API, ToS-hostile to scraping. Skip until we have a partnership or it materially moves outcomes.
- **Certificate of Occupancy** — SJ doesn't publish this as a separate feed; it's implicit in final inspection pass on the permit. Phase 2 already captures the signal.
- **CSLB citation feed** — separate from license data; CSLB publishes a monthly Disciplinary Actions PDF. Worth a dedicated ingest in Phase 2.

---

## What I need from you before I start

**Two decisions, then I ship Phase 1 today:**

1. **Score weights for v2** — comfortable with the proposed redistribution above, or want to weight CSLB even higher (e.g. 25 pts combined)?
2. **Disciplinary penalty severity** — do we treat any disciplinary record as an automatic *"Do not hire"* (max score capped at, say, 40), or as a heavy −15 pt subtraction that still lets a long-tenured contractor recover? The first is more honest; the second is more defensible if CSLB's record is stale or wrong.

After you answer, I execute Phase 1 end-to-end in one loop, then we look at the output together before starting Phase 2.