# Shortlist: "I already have names, help me pick"

Route: `/shortlist`. The homepage's first door ("You asked around and got 40 names").

## The pain it answers

Homeowners don't lack names. A Nextdoor or Reddit post returns dozens. The work is the second job that follows: reading, deduping, calling, explaining the project eight times, and comparing bids that aren't comparable. Haleo takes the crowd's output and does the grinding. It doesn't replace the source.

## The flow

1. **Bring your names.** Pick the project (kitchen, bathroom, ADU or addition, whole home, something else), then any mix of: pasted text (thread, WhatsApp, texts), up to 6 screenshots, or a name typed in with an optional phone and license number.
2. **Is this right?** `extract-referrals` (Claude, reads text and screenshots) returns each contractor once, with neighbors' quotes and how many people mentioned them. Duplicates across inputs merge by name, phone or license. The homeowner fixes names, adds license numbers, removes anyone.
3. **Compare.** Each name is checked against:
   - **CSLB**, when there's a license number: theirs, or one on the permit record (`verify-cslb-license`).
   - **San Jose permits**, searched by business name (`fetch-sj-permits` with `contractor`), then matched strictly (`pickPermitMatch`). The card shows the exact record name matched, with a "Not them?" button.
   - The same public-record trust score as Discovery (`computeTrustScore`).
   Order: red flags last (license not active or expired, CSLB discipline, negative neighbor comments), then a verified license, then permits like this project, then the score, then neighbors who vouched. The headline names the one to start with and why, in facts.
4. **Request bids.** Pick two or three. Each gets a message the homeowner sends from their own phone or email (text, email or copy), asking for an itemized bid, their CSLB number and timing. If the homeowner has described their project in `/brief`, its scope goes into every message, so bids come back comparable. If not, a nudge offers the brief, and the shortlist is saved so they come back to it (the brief's main button becomes "Back to my shortlist").
5. **When bids come back,** a link into `/proposal` to check them.

## Honesty rules

- "No license found" means not checked, never unlicensed. An unreadable CSLB status is "not checked", never "active".
- A tier blurb that implies a clean license only shows when the license was checked and is active.
- Neighbors' comments are labelled "Their words" and never feed the public-record score. A name the homeowner typed doesn't count as a mention.
- One-word names never partially match a permit record ("Roofing" won't match "Pacific Roofing").
- We don't contact anyone. Messages go from the homeowner.

## Known limits

- Permit history is San Jose only. Out-of-city contractors show "No San Jose permits we could tie to this name", stated as not a judgment.
- Name-only CSLB lookup isn't built. Without a number, the card links to CSLB's name search and asks the homeowner to get the number.
- Bid requests aren't tracked server-side yet. A tokenized bid link that a contractor can open, read the brief from and reply to without an account is the next step. It needs a table, row-level security and abuse limits.
- `extract-referrals` is callable with the public key like the other AI functions. Add a per-IP rate limit before promoting this widely.

## The four ways in, and where each lives

| Entry | Who | Path today |
|---|---|---|
| a. Has names from neighbors | Homeowner mid-search | `/shortlist` (this) |
| b. Starting from scratch | Homeowner | `/brief` → `/brief/result` → `/contractors` (Discovery) → send brief |
| c. Sent by a contractor | Homeowner invited by one contractor | `/i/:token` (contractor-branded) → brief → `/i/:token/send` → that contractor's public record |
| d. Has a quote | Homeowner | `/roast` → `/proposal`, and `/account/proposals/compare` for several |

## Files

- `src/lib/shortlist.ts`: cleaning, merging, permit matching, license reading, ranking, the bid message, saved state. Tests in `src/lib/shortlist.test.ts`.
- `src/lib/useShortlistCheck.ts`: the lookups, three at a time.
- `src/pages/Shortlist.tsx`: the page.
- `supabase/functions/extract-referrals/index.ts`: reads text and screenshots.
- Analytics: `home_door_clicked`, `shortlist_started`, `shortlist_extracted`, `shortlist_checked`, `shortlist_match_rejected`, `shortlist_request_opened`, `shortlist_brief_started`, `shortlist_bid_requested`.
