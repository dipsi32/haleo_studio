# Homeowner strategy: receipts, not ratings

How Haleo helps a homeowner find a contractor, and why it isn't another matching platform. Read with `docs/positioning.md` and `docs/pmf-pull.md`.

## The problem underneath

Homeowners don't lack names. A Nextdoor post returns forty. Every platform (Angi, Thumbtack, Yelp, Houzz) answers the question "who is good?" with stars, badges and paid placement. Homeowners have learned the stars are noisy and the badges are bought, so they fall back to the neighbor's recommendation. Then they still can't tell whether the neighbor's guy has done a job like theirs.

The question they actually have is narrower and answerable: **has this person done my kind of job, near me, recently, did the city sign it off, and are they licensed?** That is in public records today. Nobody reads it for them.

## Positioning

- **For** a San Jose homeowner holding names they don't know how to judge
- **who** is about to spend $20k–$200k with someone they met yesterday,
- **Haleo** reads each contractor's public record against *their* job,
- **unlike** platforms that rate people with stars and sell the top spots,
- **because** permits and city inspection sign-offs are the closest thing to a receipt for past work, and they can't be bought or written by a friend.

One line: **Receipts, not ratings.**

## The frame shift: job fit, not a trust score

A score about a person is a rating. Haleo doesn't rate people (CLAUDE.md, principle 3), and a single number hides its own gaps. The old 0–100 score quietly renormalized when the license board didn't answer, so a contractor looked *better* when we knew *less*.

Instead, every contractor gets the same five questions, answered from public record for this homeowner's job (`src/lib/jobFit.ts`):

| Question | Source | "Yes" means |
|---|---|---|
| Have they done this kind of job? | San Jose permits | 3+ permits of the same kind |
| Do they work near you? | San Jose permits, your ZIP | 2+ jobs in your ZIP, with the streets |
| Are they active lately? | San Jose permits | 3+ permits in the last 12 months |
| Does their work pass inspection? | City inspection sign-offs | 3+ sign-offs on recent permits |
| Is their license active? | State license board | Active, not expiring, no discipline |

The headline counts answers, not quality: "Lines up with your kitchen job on 4 of 5 · 1 not checked yet". "Not checked" is shown as such, never as a pass. A license flag outranks everything. The same answers rank the list, so the order is explainable from what's on the card.

Why it's hard to copy: lead-gen platforms earn money from contractors, so their ranking has to be sellable. A ranking that is just the city's record, read against your job, can't be. That's the moat. It's a business-model conflict for them, not a technical gap.

## Meet them where they already are

Nobody downloads an app to find a contractor. They're already somewhere, holding something. Each door starts from what's in their hand.

| They're holding | Door | Status |
|---|---|---|
| A thread with 40 names | Paste or screenshot → `/shortlist` | Live |
| One name (a truck on the street, a friend's guy) | "Check one contractor" → `/shortlist?one=1` | Live |
| A quote | `/roast` | Live |
| Nothing yet | `/brief` → Discovery | Live |
| Anything, on their phone | **Share → Haleo** from Nextdoor, Messages, Yelp or email (`/share`) | Live on Android once Haleo is added to the home screen. iOS doesn't support web share targets. |
| A link from a contractor | `/i/:token` (contractor's brief link) | Live |

**The homepage asks one question: "Where are you in your search?"** Four answers, each opening only what that path needs and saying what happens next (`src/components/home/Gateway.tsx`, config in `src/lib/homeGateway.ts`):

| Answer | They give | It goes to |
|---|---|---|
| I'm just getting started | their project in a sentence (optional) | `/brief?note=`, their words and rooms filled in |
| I have a few names from neighbors | the pasted thread and/or screenshots, optional project and ZIP | `/shortlist?go=1`: names read by Claude (`extract-referrals`, which reads screenshots too), records checked, best 1–2 shown, the rest one tap away |
| I have a contractor in mind | a name, license number or their quote | `/shortlist?go=1&name=` (straight to their record), or `/roast` if it's a quote |
| I have a quote | upload or paste | `/roast` |

Beside it, `src/components/home/PathDemo.tsx` plays the chosen path from first tap to best fit, on example data. Starting from the homepage clears any contractor link or demo left in the browser (`src/lib/homeStart.ts`), so nobody inherits another person's name or co-brand. Events: `home_door_clicked` (which answer), `home_entry_started` (where, kind).

Next, in order of leverage:

1. **Post it back.** After a shortlist, one tap writes a reply for the thread they came from ("I checked the 6 names here against city permits: …"). It gives the neighbor something worth posting and carries Haleo into the next thread. This is the homeowner-to-homeowner loop. Measure `shortlist_shared_back`.
2. **Your street.** Enter an address, see who has finaled permits for your kind of work within a few blocks. Streets, never house numbers. This is the "how did you know that?" moment, and it works with no names at all.
3. **Forward a quote by email.** quotes@ address that runs `/roast` and replies with the read. Needs inbound email.
4. **Text Haleo.** A number to text a name or a screenshot to. Needs real SMS (the contractor SMS path is still a stub).
5. **Home-purchase moment.** Upload the inspection report from a home you just bought; get the fixes as briefs. Realtors become the channel.

## What we measure

- `job_fit_opened` (surface, how many answers lined up): do people read the breakdown?
- `share_received` (kind, site): is the share sheet a real door?
- `home_door_clicked` with `one_name`: is "one name" a real moment?
- Existing: `shortlist_bid_requested`, briefs sent from Discovery. These are the pull metrics. A breakdown that gets read but doesn't lead to a bid request is decoration.

## What we won't do

- No stars, badges, "top pro", "verified" or "vetted" labels.
- No paid placement or ranking that a contractor can influence.
- No house numbers or owner names from permit records.
- No claim that a contractor is good. Only what the record shows, and what it doesn't.

## Known gaps

- License checks: the state license board read currently fails from the server (the page comes back without license details). Until it's fixed, the license answer reads "Not checked" across the board. That's honest, but it costs the fifth answer.
- Inspection sign-offs are fetched per card that's on screen (the first six in Discovery, each matched name in Shortlist), not for the whole list. Ranking uses the other four answers.
- "Near you" is by ZIP, not distance.
- The contractor profile page (`/contractors/:id`) still shows the old score breakdown. Move it to job fit next.
