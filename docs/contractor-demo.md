# Contractor demo

`/demo/us-creative-builders`. For anyone else: `/demo?record=NAME ON PERMITS&brand=Business Name&person=First&color=%23HEX&license=N&site=host.com`.

The contractor doesn't watch a pitch. They play their own next lead, in the real product, and then see what lands on their phone. About three minutes.

1. **Two doors** (`/demo/:slug`). "They text you" or "They find your website". That's how their jobs actually start.
2. **The lead's side of that door:**
   - **Text** (`/text`): the lead's phone. Their text ("We're thinking about redoing our kitchen…"), the contractor's reply with the link, and a link card in their color.
   - **Website** (`/site`): a page in their style (their name, red, nav, license number, services) with **Start your project** front and center: "Free · about 5 minutes · goes straight to Matt".
3. **The real welcome** (`/welcome`). From a text it's a personal invitation; from the website it's their front door. It shows "Matt" (what clients call him), his license checked live with the state, and his permit record.
4. **The real brief flow** (`/brief`), in their colors, with their record answering as the lead types:
   - "1 kitchen permit in San Jose…" once the project is described.
   - "2 jobs in 95125, your ZIP code" when the address goes in.
   - The real photo read ("What looks good", "Worth a closer look").
   - The real scoped brief.
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
