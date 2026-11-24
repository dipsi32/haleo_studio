# What's on file for your house? (`/house`)

A free lookup: an address in, the home's public record out, read for the person holding it.

## The shape of the report

1. **Who's reading.** *I live here* · *Planning a project* · *Buying or selling*. The facts are the same; the next steps change. The choice rides in the link (`?for=owner|project|deal`), so a report an agent sends opens the way they read it.
2. **Verdict first.** One line that leads with the answer ("Clean on paper." / "One thing to close out." / "In good order, with one thing to know."), a stamp that never claims more than was checked, and three vitals: permits, ground, latest work.
3. **What to do next.** Up to three steps, each with the reason and a one-tap action: a text to the contractor asking when the final inspection is booked, a note for the other side of a sale, the official hazard map, the contractor's own record, or the project flow with the address filled in.
4. **What the city has on file.** A timeline in plain words. Inspections passed along the way are shown, and an expired permit says "but no final".
5. **Worth knowing.** Each fact with its source badge (Public record / Our read). Any hazard map we couldn't check is named, with a link to check it yourself.
6. **Pass it on.** Send this report (carries the address, and says so), copy it in plain words (listing packet, email), check another address ("Touring a house this weekend?"), or share the tool with a neighbor (never the address).

## Honesty rules

- "Clean" only when every check ran. Hazard maps not checked → "So far, so good", never clean.
- FEMA zone D is "unrated", never "outside flood zones".
- San José's open feed drops finished permits: an empty record reads "No current permits", with the archive (sjpermits.org) linked.
- No code rules or prices. Hazard consequences are worded as questions to ask.

## Data

`useHomeData` loads hazard signals, parcel permit history and inspection sign-offs. Saved copies are trusted only per `homeData.ts`: an empty permit answer for a day, hazards only when all three checks ran. The reading is `houseReport.ts` (tested).

## Events

`house_lookup`, `house_reader`, `house_action` (step id), `house_report_shared`, `house_summary_copied`, `house_shared` (tool to a neighbor), `house_next` (project / contractor / another).
The loops to watch: reports sent (homeowner → partner/agent), "another address" (curiosity), contractor checks from a house (homeowner → contractor), project starts with the address known.

## The house card

`components/house/HouseCard.tsx`, built by `lib/houseCard.ts` (tested). One 1080×1350 image (4:5, right for Messages, Nextdoor and Instagram):

- the address (or just the street, with "Hide my house number"), the verdict, the three vitals,
- the one fact worth knowing, most important first: an unfinished permit, then a hazard zone, then sign-offs on work underway, then the street,
- the date and the sources,
- the way back: "What's on file for *your* house? Look yours up free", with the link and a QR code to `/house?ref=card` (the tool, never this address).

What's on screen is what's saved: the image is taken from the card itself, with its fonts inlined so it looks the same on every phone. **Share the card** sends the image with a link through the phone's share sheet (or downloads it where sharing files isn't supported); **Download** saves it.

Events: `house_card_shared` (via share_sheet / download), `house_card_downloaded`, both with `hidden_number`. Arrivals from cards land with `ref=card`.

## Hierarchy (no repeats)

1. **The card is the verdict.** Pinned on the left on desktop, first on phones: address, verdict, three tiles (this house, the ground, the street), and one line saying what to do about the most important tile. The share actions sit right under it: Share the card, Text it (phones) or Copy as text, Download, Hide my house number.
2. **What to do next**, with the reader switch (I live here / Planning a project / Buying or selling) beside it, because it only changes the steps. Steps never repeat sharing.
3. **The details**, only what the card can't hold: the permit timeline with sign-offs and permit numbers, who your neighbors hire and the latest street jobs, and what each hazard map means with a link to it.
4. **The loops**: a house you're touring, a neighbor who'd want the lookup.

## On a phone (checked on iPhone SE 320px, iPhone 13, Pixel 5)

- The answer is on the first screen: with a result showing, the lookup folds to one line ("Look up another") and the card starts right under the header.
- Share, Text, Save sit in one quiet row under the card; once the card scrolls away, a slim bar keeps "Share card" one tap away.
- Nothing scrolls sideways; every tap target is at least 40px.
- The scroll follows the reader: the answer, what to do, the proof, then the next house and the neighbor.

## Home first, then outward (v3)

- **The card is the home's record**: its permit history (year, what, ✓ signed off / • open / ! no final), who worked on it, the three zones, and the one thing to do before buying or remodeling. 1080×1620 (2:3): a full phone screen.
- **Permit history**: every permit; tap one for its description, issued and final dates, declared value, type, contractor and every inspection. **Open the city's file** copies the permit number and opens the city's public permit search (permits.sanjoseca.gov), where the imaged permit, plans and inspection records live. The city opens records from a search, not a direct link, so the number is handed over.
- **Who worked on this house**: each contractor with their permits here and their wider San José record; tap through to their profile.
- **Around you**: the street (by block), then **Working in {ZIP}**, loaded on request: every contractor with permits in the ZIP, their kinds of work, the streets they've worked on (never house numbers), "Your street" when they've worked on it. `fetch-sj-permits` with `area: true` reads the city by the ZIP itself across all three feeds.
- Events: `house_permit_opened`, `house_permit_file`, `house_crew_opened`, `house_area_opened`, `house_area_crew_opened`.

## The city's own file (city-record)

`supabase/functions/city-record` reads San José's public permit portal
(permits.sanjoseca.gov) for the address: every permit on the lot (not just the
three open-data feeds), each permit's contractor, and the scanned documents
(permit card, plans, inspection notices) as direct PDF links. The portal also
returns owners' and applicants' names and emails; only people whose type is
exactly `Contractor` leave the function, and permit titles that carry a name are
rewritten from the permit's codes (`describe()`).

On the page: the card stays on the left; the right column is the permit list.
Each permit opens to the action to take, its documents (one tap to the PDF),
the permit number (tap to copy), and who did it. Everything else (the lot and
the ground, the street and the area) is a drill-down.

Tapping a contractor opens a short hand-off ("Pulling everything on …") while we
find their record (strict name match; never a near miss), then their profile:
the answer in one line, the job they did on this house, license (state board,
or "Not checked" with a way to check), sign-offs, where they've worked (streets
only), what they do, their latest permits, and questions to ask, ready to copy.
