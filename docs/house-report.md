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
