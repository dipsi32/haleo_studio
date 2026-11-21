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
