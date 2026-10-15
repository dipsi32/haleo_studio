# Visit prep: know the job before you drive out

Draft positioning and design note. The domain reasoning here comes from first principles and public-record knowledge. It has **not** been validated with Matt yet; the last section is the script for doing that.

## The reframe

"Get info on a lead before the first meeting" is accurate, and it is what every competitor says. Contractors already drown in info. What they want is a **decision**, and a way to look prepared.

A big inquiry pings his phone. He is excited and wary at once: *Is this real? Can I win it? Am I about to burn a Saturday? Will I look like the guy who didn't do his homework?* He doesn't search for an intake tool. He is triggered by the notification. So the product lives at that moment, in his words.

The pitch describes what he **does**, not what the product **is**.

| | |
|---|---|
| **Tagline** | Know the job before you drive out. |
| **Demo line** | Make your first visit feel like your second. |
| **Pitch** | When a big inquiry lands, send the Haleo link. By the time you pull into the driveway, you know the lot, the permit risks and what to ask, and the homeowner already feels looked after. |
| **Plain logic** | Haleo tells a contractor whether a big lead is worth the drive, and what to say when he gets there. |

Deliberately not the headline: "win the big job." It is the most exciting claim and we can't prove it until we've measured win rates. One overclaim makes everything else less credible. Earn it after Matt's next five prospects.

## Two faces of one product

The contractor hears **"know before you go."** The homeowner never hears "we're vetting you." They hear **"he's preparing for your visit."** If the language is the same on both sides, the link feels like a screening form.

| Moment | Contractor sees | Homeowner sees |
|---|---|---|
| Landing | "Know the job before you drive out." | "A first visit that feels like the second." |
| The extra questions | Under "The people", their words, labelled | "Help {name} show up prepared. Every one is optional." |
| After sending | A prep sheet and a call | "Your brief comes with a prep sheet on your home and project, so your first visit can start with the real conversation." |

## What shipped

**Contractor: the Visit prep card** (top of every unlocked brief in the inbox)

1. **The call.** One of: *Worth the drive*, *Worth a quick call first* (a gap that a short call would settle, such as no budget), *Probably not your kind of job* (outside their fit criteria), or an invitation to set fit criteria. The reasons sit right underneath.
2. **Worth knowing before you knock.** Up to three things the homeowner probably doesn't know the contractor knows, each with a line he can say at the door, phrased as a question and never a verdict. This is the "how did you know that?" moment.
3. **Home and lot, the work, the people.** Three short lists. Every line carries a source badge.
4. **Confirm on site.** The things nobody can know until someone is standing there. Naming them out loud reads as competence, and keeps us from overclaiming.
5. **Good questions to ask.** Ranked by how much each answer changes the decision, each with one line of why, and an **Ask** button that drops it into the reply box.
6. **Copy cheat sheet.** Plain text for the notes app, source labels intact.

**Homeowner: "Help {name} show up prepared"** on the send step. Five taps and two short text fields, all optional: what's prompting this, who weighs in, how they plan to pay, whether they're talking with others, a hard date, and anything from past projects to handle differently. The rule we held: ask only what changes the contractor's decision, and never ask for financial detail beyond how they plan to pay.

**Records attached at send time** (best effort, never blocks a send): APN, lot size, zoning, existing home size, building footprints and permit history, from the same sources the ADU tool already uses.

## The honesty rule: every line is labelled

| Badge | Means | Example |
|---|---|---|
| **Public record** | Came from a city or county record | "Zoned R-1-8" |
| **Their words** | The homeowner said it | "Paying with: home equity loan or line" |
| **Their numbers** | Plain arithmetic on what they said | "Budget works out to $500 to $667 per sq ft" |
| **Our inference** | Haleo's read. Always phrased as something to confirm | "Often means ignition-resistant materials. Confirm what applies." |

The danger is a wrong setback rule delivered confidently in a driveway. So the sheet **never states a code rule**, never estimates a price, and never scores a person. Where a rule matters, it says to check with the city. A missing record is shown as missing ("No permits on file doesn't mean no work was done"), never as zero.

Permit-history flags are worded as things to ask about, never accusations: "I noticed the city shows a permit that never got a final. Do you know the story there?"

## What is not built yet (and why)

- **Year built, panel capacity, sewer lateral, utility meters, foundation type.** No free public source we trust. They appear under *Confirm on site* instead of guessing.
- **Neighborhood comps** (what nearby owners permitted and at what valuation). The permit data exists; a credible price anchor needs more thought about how to show it without it reading as a quote.
- **Zoning rules engine for non-ADU projects.** `aduRules.ts` is the only place we state rules, and only for ADUs.
- **Realistic cost vs. stated budget.** The most useful single number, and the riskiest to fake. We show only arithmetic until we have cost data we can stand behind.
- **Collecting the homeowner questions on the marketplace door.** Only the invite door asks them so far. Parcel facts attach on both.
- **Past-experience and context fields are free text.** No analysis of them.

## How we'll know it works

- **The repeat-back test.** Have Matt and one white-label contractor repeat the pitch in their own words. If they say "so it's like homework done for me," keep going. If they say "so it's a lead form," the framing is wrong.
- **Metrics in place** (PostHog): `visit_prep_viewed` (with the call level and how many surprises), `visit_prep_copied`, `visit_prep_question_added`, and `invite_brief_sent` now carries `has_context` and `has_parcel`. Copy rate is the best proxy we have for "he actually took it to the driveway."
- **Not measurable yet:** whether it changed a win rate. Don't claim it.

## Ask Matt (before the next build)

> "Before a first visit, what do you wish you knew, ranked?"

Then, specifically:

1. Of these, which two change whether you go at all? (buildability, realistic cost vs. budget, who decides, red flags in the records, where they are in the process)
2. When you walk in knowing something about the lot, how do homeowners react? Is there something you'd *not* want to say out loud?
3. What would you ask that we don't? What do we ask that you never use?
4. Would you rather see this in the inbox, on your phone as a text, or printed?
5. Would you send the link to a prospect you're already comfortable with, or only to ones you're unsure about?

His ranked list will show which of these we overweighted.

## Files

- `src/lib/visitPrep.ts`: the pure logic (the call, surprises, provenance, questions, cheat sheet). Tests in `src/lib/visitPrep.test.ts`.
- `src/lib/prepTypes.ts`: parcel facts and homeowner context shapes, option lists, `cleanContext`.
- `src/lib/parcelFacts.ts`: best-effort loader (cached permit history plus `enrich-sj-parcel`, 6 second cap).
- `src/components/pro/VisitPrepCard.tsx`, `src/components/brief/VisitContextForm.tsx`.
- No database migration. Everything rides in the existing `brief_snapshot` JSON.
