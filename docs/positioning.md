# Positioning, voice and what we can claim

Read this before writing any user-facing copy. The CLAUDE.md principles
still apply; this is how they sound.

## The idea: confidence before commitment

Every remodel starts with an inquiry, and an inquiry isn't yet a project
anyone can evaluate. Haleo turns it into one, so each side can take the next
step with confidence.

- **The contractor's question:** "Is this an opportunity I should pursue, and
  what do I need to know before I put my name, time and price behind it?"
- **The homeowner's question:** "Will someone credible understand what I want
  and help me figure out what's realistic?"

**Haleo gathers the context. The contractor makes the call.** We never make
the call for them, and we never rate the homeowner.

The value is not "less texting." It's control over which work enters the
business. Preparation is how we deliver that, and the decision is the
payoff. A good outcome can be pursue, clarify or pass. Catching a mismatch
early counts as a win even when no job comes of it.

## The lines (use these, don't paraphrase them into mush)

| Where | Line |
|---|---|
| Contractor headline | **Know the job before you make the trip.** |
| Contractor promise | Know which jobs deserve your time, before you give that time away. |
| Contractor pitch | You can't visit every lead, and you shouldn't have to guess which ones are worth it. Haleo gets the homeowner's photos, scope, budget and timing together before you head out, so you can spot a fit, raise the right questions, and spend your time on the jobs you want to win. |
| Contractor CTA | Try it on your next lead. |
| Homeowner | Help your contractor understand your remodel before you meet. You don't need to know construction. Not sure about budget or scope yet? Say so. That's part of the conversation. |
| Brand | Start every job on the same page. |
| Investor | A remodeling inquiry is not yet a project a contractor can evaluate. Haleo connects what homeowners need (to be understood) with what contractors need (enough context to decide) through a shared pre-visit brief. |

## How it sounds

- **Calm, warm, confident.** We've got their back. No hype, no exclamation
  marks, no "revolutionize".
- **Their words.** Use trip, visit, lead, scope, walkthrough, estimate. Avoid
  funnel, conversion and qualification in anything a contractor or homeowner
  reads.
- **Short.** One idea per line. If an intro runs past two sentences, cut it.
- **Generous to the homeowner.** Uncertainty is not unseriousness. "Not sure
  yet" is a fine answer and is never held against them. The lead-readiness
  read treats a skipped question as unknown, not bad.
- **White-label inside a contractor's link.** It's their process. Nothing in
  it points the homeowner to other contractors.

## Claims: what we can and can't say

We can say these, because they're about the problem:

- Homeowners struggle to find someone they trust (Houzz: 48% of 2,866
  kitchen and bath renovators).
- Homeowners struggle to get clear proposals (34%) and timely communication
  (30%).
- Contractors rank customer communication (40%) and quoting (37%) among
  their biggest time sinks (Jobber: 1,050 home-service owners).

We can't say these yet, because they're about Haleo's impact and the pilot
has to prove them:

| Don't say | Say instead |
|---|---|
| "Win more jobs" / "higher close rate" | "Spend your time on the jobs you want to win" |
| "The first visit decides the job" | "Make the first visit count" |
| "Most remodels go wrong because of day-one expectations" | "Surface mismatched expectations before they become commitments" |
| "Serious lead" as a fact | "Looks like a serious lead", with the reasons and their source |
| "Proven" or "vetted" contractors | "What the public record shows", with its coverage and limits |

A completed brief is evidence of engagement. It is not proof of financing,
readiness or fit.

## What we measure (the launch scorecard)

The answers live at `/admin/pilot`. The logic is in
`src/lib/pilotScorecard.ts`, and the data comes from
`admin_pilot_scorecard()`.

1. **Did we capture all eligible inquiries?** The contractor's weekly count of
   all inquiries, against how many got the link.
2. **Did homeowners participate without excessive friction?** Link views,
   then starts, then sends. Plus the median time to send, and "How easy was
   that?" after sending.
3. **Did contractors take a specific next step?** "Your call" on each brief:
   pursue, ask first or pass, with the sticking point.
4. **Did Haleo improve on normal intake?** Visit rate and win rate against
   the baseline taken at kickoff.
5. **Did it reduce effort or prevent late mismatches?** "Did the brief save
   you back-and-forth?" and "Did the job match the brief?", against their
   baseline rate of late surprises.
6. **Did business and homeowner experience stay healthy?** Jobs won and their
   value, homeowners who found it hard, and homeowners who started but didn't
   send.
7. **Did contractors use it again, and pay?** Active weeks, the would-pay
   answer (asked after 3 calls) and paying status.

Below five data points, the answer says "Too early", never a percentage of
two.

The proof we want isn't "contractors like the brief." It's that **they used
it again because it helped them decide before committing more time.**
