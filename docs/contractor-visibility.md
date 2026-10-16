# Contractor visibility (`/pro/visibility`)

Shows a contractor where they land when a homeowner searches for a general
contractor or remodel in their city. Every number comes from a dated scan; the
page shows the search, the sample size and the listing we matched.

## What is measured, and how

| Source | Method | Credential | Notes |
| --- | --- | --- | --- |
| Google | Places API text search, results in the order Google returns them | `GOOGLE_PLACES_API_KEY` | Maps order for the query. Not personalized, not the exact local pack. |
| Yelp | Fusion API business search, `best_match`, top 20 | `YELP_API_KEY` | Check Yelp's display and caching terms (attribution, link back) before launch. |
| ChatGPT, Gemini | Same homeowner question asked 4 times per search per model, count how often the business is named | `GEMINI_API_KEY` and `OPENAI_API_KEY` (already used) | The model's own knowledge, no live web search. Shown as a rate, never a rank. |
| Angi | Not measured | none | No public data source. The page says so instead of guessing. |

A source with no credential reports `unavailable`; the page shows "Not
connected yet" rather than a zero.

## Trust rules

- Matching a business to a listing: phone or website is strong; an identical
  name is strong; a near-match on a name of two or more words is "name only" and
  the page asks the contractor to check it is them. One-word names never match
  loosely. (`supabase/functions/_shared/visibility.ts`, tested.)
- The contractor is derived from the caller's own account, never the request body.
- One scan per 12 hours per contractor (cost and honesty: results don't move hourly).
- Insights are computed from stored numbers only: review count against the median
  of the top listings, and who shows up most. Nothing is inferred beyond that.

## Before it works for real

1. Apply `20261008120000_visibility_scans.sql`.
2. Set `GOOGLE_PLACES_API_KEY` and `YELP_API_KEY` as function secrets, deploy `visibility-scan`.
3. Run a scan for a real contractor and check the matched listing by hand.

The edge function has not been run against the live APIs in this change; the
page and the pure logic are tested against fixtures.

## Not built yet

Trend over time (scans are kept, the chart isn't), contractor-confirmed listing
links, Google Business Profile import, review-response and site-quality checks.
