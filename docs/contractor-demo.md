# Contractor demo

`/demo/us-creative-builders`. For anyone else: `/demo?record=NAME ON PERMITS&brand=Business Name&person=First&color=%23HEX&license=N&site=host.com`.

The contractor doesn't watch a pitch. They play their own next lead, in the real product, and then see what lands on their phone. About three minutes.

1. **Two doors** (`/demo/:slug`). "They text you" or "They find your website". That's how their jobs actually start.
2. **The lead's side of that door:**
   - **Text** (`/text`): the lead's phone. Their text ("We're thinking about redoing our kitchen…"), the contractor's reply with the link, and a link card in their color.
   - **Website** (`/site`): a page in their style (their name, red, nav, license number, services) with **Start your project** front and center: "Free · about 5 minutes · goes straight to Matt".
3. **The real welcome** (`/welcome`), task first:
   - A one-line greeting from Matt, then one question, "What should Matt call you?", and **Start my project**.
   - Who Matt is lives in one glance card underneath ("License active · 6 San Jose permits · Kitchen remodel"). It opens his full record (license checked live with the state, permit record) in a sheet.
4. **The real brief flow** (`/brief`), in his colors, greeting them by name ("What do you need done, Priya?"):
   - His record never sits in the form. It lives in one slim strip pinned at the top (`RecordCompanion`).
   - When an answer unlocks a matching fact, the strip opens with that one fact for about five seconds ("1 kitchen permit in San Jose…", "2 jobs in 95125, your ZIP code"), then folds back into a count: "2 things in Matt's record match your project".
   - Tapping the strip opens a sheet with every matching fact and his license. Each fact opens to the permits behind it: what, ZIP, month and status, never an address or an owner.
   - Then the real photo read and the real scoped brief.
5. **"Send to US Creative Builders"** (`/i/demo-…/send`). It builds the same snapshot a real send would, including the city's records for the address typed. Then, instead of sending, it opens…
6. **Their phone** (`/matt`): "Now you're Matt. This just landed on your phone." It shows the brief with visit prep (worth the drive, what the records say, the times they picked), the photos, Haleo's read and the scope by trade. Then four lines about his pain (phone tag, wasted drives, walking in blind, looking like the most prepared bid) and **Use this for my real leads**, which opens the claim flow for his record.

## What's real, what isn't

- **Real:**
  - His permits and license.
  - The intake and the photo read.
  - The address lookups and the visit prep.
- **Not sent:**
  - The demo "link" is the token `demo-<slug>`. It never reaches the server.
  - `/i/demo-…/send` skips sign-in and the send call.
  - Brief drafts aren't saved to any account.
  - The finished brief lives only in that browser tab.
- **Always visible:** a banner on every page of the flow says it's a demo and offers "Exit demo". The demo cleans itself up on Matt's screen.
- **Two side effects:** the demo calls the photo reader and uploads photos to the anonymous intake bucket, the same as any visitor.

## In production

The same journey without the demo layer. His text reply carries his front-door link (`/c/:slug?src=text`) and his website button carries `?src=website`. The homeowner signs up at send, and the brief lands in his inbox. See `docs/contractor-front-door.md`.

## Events

`demo_opened`, `demo_door_chosen` (door), `demo_link_tapped` (door), `demo_brief_sent`, `demo_matt_viewed`, `demo_cta_clicked`. Demo runs never fire `visit_prep_viewed`, `visit_prep_copied` or `record_highlight_shown`, so the real funnel stays clean.

## Adding a contractor

- Add an entry to `DEMOS` in `src/lib/demo.ts`: the name on their San Jose permits, what clients call them, their color, license number, website headline and services.
- Or send the query-string link instead.
