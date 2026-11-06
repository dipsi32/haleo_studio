# Lead readiness

The remodeler's lead sheet, filled in before the phone rings.

A classic lead sheet (Joe Cracco, JLC, 2007) is a phone script. It asks:
- why now
- the budget
- whether there are plans and financing
- who else decides
- who else they're talking to
- how they heard about you

Cracco measured about 45 minutes to qualify a raw lead, then about five
more hours to turn it into a prospect, before any estimate. Using the sheet
saved him about 80 hours a year.

Haleo asks the same questions in the homeowner's brief, all optional.
`VisitContextForm` adds "Something needs fixing" as a reason and "How did you
hear about them?". Haleo also sees what no phone call shows: how much effort
the homeowner put in.

## What the contractor sees

`src/lib/leadReadiness.ts` produces a **plain call** and **four reasons**:

| Call | When |
|---|---|
| Ready to move | Strong "why now", a budget on the table with nothing in it saying no, at least two strong areas, nothing weak |
| Serious, a few things open | Real intent, something still open |
| Early days | Still exploring, two weak areas, or comparing several contractors with no urgency |
| Not enough to tell yet | They skipped most questions (3+ areas unknown) |

The four areas, each Strong / Some / Low / Not shared:
- **Why now:** timeline, the reason (repair, family, relative moving in,
  selling), a hard date, and pain points that mean something is failing
  ("Active leak").
- **Budget & funding:** a budget shared, their budget against the
  contractor's minimum, and how they'll pay.
- **Plans & decisions:** plans, permit status, and who decides. "With a
  partner" is neutral, with a tip to get both to the visit.
- **Commitment:**
  - other contractors they're talking to
  - how they found you (referral, past client)
  - whether they offered visit times
  - effort: photos, answered questions, detail, a phone number

It also gives **one question to ask first**, softly worded, in the order
that changes a decision most: budget, timing, reason, other contractors,
who decides, funding.

## Rules

- **No number out of 100.** Cracco tried scoring and found people too
  unpredictable for it. The contractor's judgment wins.
- **It reads the project's readiness, not the person.** Respectful words
  only: "Comparing several contractors", never "price shopper".
- **Unknown is never bad.** A skipped question becomes the question to ask.
- **Every signal names its source:** Their words, Their numbers, or What
  they did.

## Where it shows

- **Pro inbox:** a chip on each unlocked lead, and the full card at the top
  of the brief.
- **Demo:** Matt's phone view.
- **Visit prep:** a job that fits but whose lead is "Early days" becomes
  "Worth a quick call first", not "Worth the drive".

**Event:** `lead_readiness_shown` (level). Next, compare the level against
replies and won jobs to tune the thresholds on real outcomes.
