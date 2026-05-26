## Vision

At every step of the homeowner's journey, Haleo surfaces the right piece of city intelligence — quietly, like a text from a friend who happens to know everything about San Jose construction. Not data dumps. Not modals. Not tooltips. Calm cards at the exact moment they matter.

The homeowner should leave every session feeling measurably smarter than when they arrived. That's the retention, word of mouth, and moat.

## Voice

> "Hey — before you sign that, San Jose permit fees for this scope are $485. That line item on your bid says $1,200."

Bold, calm, intelligent, "got your back." Not theatrical. Numbers and sources do the talking. One light wink per screen, max.

## Architecture — one shared "City Intelligence" layer

All surfaces consume from the same layer. Cache tables; edge functions hydrate them; UI is a thin "Quiet Signal" card.

```
public APIs ──▶ edge functions ──▶ city_* / address_* cache ──▶ <QuietSignal /> on the right screen
```

## Phases

### Phase 1 — Address intelligence (SHIPPING NOW)

Trigger: when the homeowner saves their address in the brief.

Looks up three things via public APIs and caches per address:

- **Fire Hazard Severity Zone (FHSZ)** — CAL FIRE FeatureServer (Moderate / High / Very High). If WUI, surface immediately. Affects exterior materials, insurance, contractor requirements.
- **FEMA flood zone** — FEMA NFHL ArcGIS REST. Surface when in any Special Flood Hazard Area (A, AE, V, VE…). Affects scope requirements.
- **Seismic hazard zone** — CA Geological Survey (liquefaction / landslide overlays). Surface when relevant to structural scope.

Storage: `address_risk_signals` (created in migration `20260526_address_risk_signals`). Keyed on a normalized `street|city|state|zip` string. Cached forever (these zones rarely change); a manual refresh button can force re-lookup later.

Edge function: `lookup-address-risk` (public, no JWT) — geocodes via the free US Census geocoder, then hits each ArcGIS endpoint, normalizes, writes to cache. Best-effort: if one source fails, the others still land.

Surface: a single calm `<AddressIntelligenceCard />` at the top of `BriefResult.tsx` — only renders when at least one real signal exists. Each signal is one sentence: what it is, what it changes, why they should care. No alarm. No emoji.

Out of scope for Phase 1: the materials guidance itself, insurance copy, contractor filtering. That's Phase 2+.

### Phase 2 — Scope intelligence

Trigger: when the homeowner picks project type / scope.

Curated table `city_programs` (we seed it) mapping scope → relevant SJ programs:

- ADU scopes → **ADU Ally** pre-approved plans (6-month → 6-week permits)
- Kitchen / bath / electrical → **San José Clean Energy** electrification rebates (panel upgrade, induction)
- Any structural → **PBCE** free homeowner workshops (next session date)
- Any permitted work → **Title 24** 2023 compliance line item reminder

Surface: a `<ProgramSignal />` card on the scope screen and on `BriefResult`. Each card shows program name, the dollar/time benefit, and a deep link.

### Phase 3 — Live permit & inspection wait times

First step (read-only investigation): check `data.sanjoseca.gov` for inspection datasets with both request and completion timestamps (`inspection_requests`, `permit_activity` with status timestamps). If timestamps are there → compute real medians ourselves; far better than scraping.

If data exists:

- Nightly `compute-sj-wait-times` cron edge function (pg_cron + pg_net) writes medians per permit type into `city_wait_times` (building / electrical / mechanical / framing inspections).
- Surface on the scope screen as a "timeline reality" card: *"San Jose is currently running 14 business days for framing inspections. Bake this in."*
- Surface on bid review as a check: *"This contractor's 8-week timeline doesn't account for current SJ inspection backlogs."*

If data doesn't exist: degrade to a quarterly hand-curated table; flag it as such honestly.

### Phase 4 — Permit milestone tracker (post-hire)

Goal: zero homeowner action, all proactive nudges.

- New table `tracked_permits` (homeowner_user_id, permit_number, project_id, last_status, last_status_at).
- New edge function `poll-tracked-permits` on a daily cron — pulls latest status from SJ permit API for each tracked row.
- On status change, write into `homeowner_notifications` (already exists, already realtime via `HomeownerNotificationToaster`):
  - Issued → "Your permit was pulled today. Make sure it's posted on site."
  - Inspection scheduled → "Rough electrical inspection is in 3 days. Failing it adds 2–3 weeks right now in SJ."
  - Failed → "Framing inspection had a correction notice. Here's what usually needs to be fixed."
  - 45 days to expiration → "Permit expires in 45 days. Your contractor needs to file an extension now, not later."
  - Final passed → "Closed out with the city. Save this — you'll need it on resale disclosure."

UI: surface the live timeline on `Account.tsx` under each project.

### Phase 5 — Contextual events

Goal: feel like Haleo somehow knew you needed this workshop.

- Table `city_events` (title, date, audience tags, deep link). Seeded weekly via a `sync-sj-events` edge function (or, until that scraper is solid, hand-curated). Tags: `adu`, `fire_zone`, `electrification`, `permits`, `general`.
- Each phase surfaces matching events as a small card:
  - ADU scope → ADU workshop card
  - WUI zone (from Phase 1) → SJ Fire Dept free home assessment
  - Electrical scope → SJ Clean Energy electrification session

## Voice rules across all signals

- Lead with the fact, then what it changes for them, then the action.
- One sentence per signal where possible.
- Always cite the source (small chip).
- Never alarmist. The vibe is "you should know this," not "panic."
- Honest caveat when relevant: "Public records, last refreshed [date]."

## Out of scope across all phases

- No homeowner-facing dashboard of all the data; signals are contextual, not a feed.
- No paid APIs.
- No contractor-visible changes (this is homeowner intelligence).
- "Test mode" $99 unlock remains as-is until real Stripe is wired.

## Deliverable this turn

- Migration: `address_risk_signals` cache table (done).
- Edge function: `lookup-address-risk` (CA Census geocoder → CAL FIRE FHSZ + FEMA NFHL + CGS seismic).
- Trigger: fired from `AddressStep.save()` (fire-and-forget; non-blocking).
- UI: `<AddressIntelligenceCard />` at the top of `BriefResult.tsx`. Calm, voice-correct, only renders when there's real signal.
