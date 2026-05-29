
# ADU Feasibility Check — Implementation Plan

A new `/adu` route walking homeowners through: address → parcel lookup → hardcoded feasibility rules engine → SVG buildable-zone diagram → ADU-permitted contractor match. Safety guardrails are baked in: rules engine is hardcoded (not AI), Gemini only translates to plain English, every result carries a non-dismissible Planning Dept disclaimer, and missing data is surfaced honestly rather than hallucinated.

## Scope

### New route
- `src/pages/ADU.tsx` — 4-step flow with Framer Motion slide transitions, mobile-first 390px.
- Add route to `App.tsx` behind `<Gated>` (ProtectedRoute + AccessGate).
- Add "ADU" tab with `Building2` icon to the bottom tab bar.

### Step 1 — Address & parcel resolution
- Single address input. On submit:
  - Call existing `lookup-parcel-history` edge function to resolve APN + permit history.
  - Call existing `lookup-address-risk` for Fire Hazard Severity Zone signal.
  - Derive **data confidence**: Green (APN + lot dims + zoning), Yellow (APN + partial), Red (no APN or no usable parcel data).
  - Red → stop flow, show error, offer waitlist join.

### Step 2 — Feasibility check
- **New edge function** `supabase/functions/check-adu-feasibility/index.ts`:
  - Input: APN, lot_size, zoning, existing_footprints, permit_history, fhsz flag.
  - **Hardcoded rules engine** (San Jose ADU ordinance + CA AB 2221):
    - JADU: 500 sqft max, requires 1,200 sqft min lot.
    - Detached ADU: min(1,200 sqft, 50% primary); 800 sqft floor if primary <800.
    - Setbacks: 4ft rear / 4ft sides / no front.
    - Height: 16ft flat, 18ft sloped within 0.5mi transit (flagged as needs-verification since transit proximity not in current data → fallback to 16ft + note).
    - School impact fee triggers >500 sqft.
    - FHSZ → fire-resistant material flag.
    - Open permits / violations surfaced from history.
  - Calls existing `cost-guide-lookup` for cost_range. Never lets AI estimate.
  - Calls Lovable AI Gateway (`google/gemini-2.5-pro`) with a strict system prompt: "translate this JSON to plain English, add nothing, say 'unavailable' for nulls."
  - Returns structured JSON spec + `explanation` string.
- Result screen shows verdict, confidence chip, allowed ADU types, setbacks, cost range (labeled as estimate from cost guide), open permits/violations flags, school fee flag, FHSZ flag, **non-dismissible disclaimer**, CTA to diagram.

### Step 3 — Property positioning diagram
- Pure SVG (no Mapbox/Google), computed from lot dimensions.
- Lot boundary → setback ring → buildable envelope (amber 15%) → existing structures (if footprint data) → dashed max-ADU rectangle.
- Only render if confidence ≥ Medium AND lot dims present. Otherwise text-only explanation.
- Unknown dimensions render as "?" with approximation note.
- Always shows architect/Planning Dept disclaimer below.

### Step 4 — Contractor match
- Query existing `contractor_permits` joined to `contractors` filtered by `project_type = 'ADU'` and homeowner zip cluster.
- Reuse existing contractor card component (`CuratedMatchStack` or single card from `/contractors`).
- Max 3 cards. Empty state → waitlist CTA.

### Cross-cutting
- Disclaimer component (`AduDisclaimer.tsx`) — reusable, non-dismissible.
- Confidence indicator component (`DataConfidenceBadge.tsx`).
- Skeleton loaders on every async call.
- PostHog events via existing `track()`: `adu_started`, `adu_address_submitted`, `adu_parcel_resolved`, `adu_parcel_failed`, `adu_feasibility_completed`, `adu_diagram_viewed`, `adu_contractor_matched`, `adu_waitlist_joined`.

## Technical details

### Files added
- `src/pages/ADU.tsx`
- `src/components/adu/AddressStep.tsx`
- `src/components/adu/FeasibilityResult.tsx`
- `src/components/adu/BuildableDiagram.tsx`
- `src/components/adu/AduContractorMatch.tsx`
- `src/components/adu/AduDisclaimer.tsx`
- `src/components/adu/DataConfidenceBadge.tsx`
- `src/lib/aduRules.ts` — pure TS rules engine (shared between edge function logic and possible client preview). The edge function will have its own copy since edge functions can't import from `src/`.
- `supabase/functions/check-adu-feasibility/index.ts`

### Files modified
- `src/App.tsx` — add `/adu` route gated behind `<Gated>`.
- Bottom tab bar component — add ADU tab.
- `supabase/config.toml` — register new function (default `verify_jwt = false` for parity with sibling functions; the call is gated client-side by AccessGate).

### Data confidence rules
- Green: APN resolved + lot_size present + zoning present
- Yellow: APN resolved + one of {lot_size, zoning} missing
- Red: APN unresolved OR `lookup_succeeded = false`

### Existing infra reused (not rebuilt)
- `lookup-parcel-history`, `lookup-address-risk`, `cost-guide-lookup`, `fetch-sj-permits`, `fetch-permit-inspections`, `fetch-sj-violations`, `contractor_permits` table, contractor card components, AccessGate, analytics util.

### Gemini call shape
- Model: `google/gemini-2.5-pro`
- System: hard guardrail prompt forbidding new facts
- User: stringified rules-engine JSON
- Temperature: low. Response stored on the result, never re-queried per render.

### Not in scope
- No new npm packages.
- No changes to existing routes/components beyond the tab bar + App.tsx route registration.
- Transit-proximity check (no current data source) → conservative 16ft height with a "verify with Planning if near transit" note.
