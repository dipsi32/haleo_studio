# Contractor demo

`/demo/us-creative-builders`, or for anyone else `/demo?record=NAME ON PERMITS&brand=Business Name&person=First`.

A contractor sees their own business, not a sample one. About three minutes, one idea per screen:

1. **Their record.** The facts a homeowner can already find: ZIP codes they work in, kinds of work, permits active right now, and the public record card. All from San Jose permits, fetched fresh when the page opens. No ratings, reviews or job values.
2. **Their link on a client's phone.** It's co-branded ("US Creative Builders, powered by Haleo"). They tap the answers a client would (project, ZIP code, visit times), and their own record answers each one in place: "1 kitchen permit in San Jose…", "2 jobs in 95125, your ZIP code."
3. **What lands on their phone.** A sample brief with visit prep on top: whether it's worth the drive, the unfinished permit on the lot, the times the client picked, the questions to ask, and "Worth checking on site" from the client's photos.
4. **The close.** "Set up your link" goes to the claim flow for their record (`/pro/:slug/claim`), or to sign-in if it's already claimed.

The client in steps 2 and 3 ("Priya") and the home are made up, and the page says so on both screens. Nothing is sent or saved. The demo doesn't fire the real funnel events (`record_highlight_shown`, `visit_prep_viewed`), so it never inflates them.

## Adding a contractor

Add an entry to `DEMOS` in `src/lib/demo.ts`, using the name as it appears on San Jose permits. That's often the owner's name: US Creative Builders is filed as "BAKHTIARY, MEHDI". Or skip the code change and send the query-string link.

## Events

`demo_opened`, `demo_record_loaded` (found, permit count), `demo_step_viewed` (step), `demo_answer_tapped`, `demo_cta_clicked`. The funnel to watch: opened, then reached `prep`, then clicked the CTA, then `contractor_claimed_profile`.

## Running it in a meeting

- Open on their record and pause. "Here's what any homeowner can find about you."
- Hand them the phone for step 2.
- Stop on step 3 and ask: "Which of these would have changed your last site visit?"
