# Answering a homeowner fast (`/pro/inbox`)

Goal: a busy contractor goes from "a brief arrived" to "the homeowner has my
reply" in under a minute, without typing from scratch and without losing track
of who is waiting.

## What changed

- **Triage list.** Briefs are sorted by what needs the contractor: homeowner wrote
  back first, then never contacted, then waiting on the homeowner, then passed.
  Filters: Needs a reply / Waiting on them / All, with counts. Each unlocked card
  shows the deal-read fit chip and a plain state tag ("Dana replied", "Reply",
  "Waiting on Pat"). When something is waiting, the header says how long the
  oldest one has been.
- **Reply panel, right under the deal read.** The decision, then the action, with no
  scrolling past photos. Three starting points that fill an editable draft:
  - *Ask what's open (n):* Haleo's open questions as a numbered list, each one
    tickable.
  - *Offer a visit:* tap the next business days that work; the draft names them.
  - *Not a fit:* pick a reason; sends a kind no and marks the brief as passed.
    A clear no beats silence for the homeowner.
- Ctrl/Cmd+Enter sends. Drafts are plain text, capped at 800 characters.

## Rules the drafts follow

Nothing is invented. A draft uses only the brief (name, project, open questions)
and the choices just made (days, reason). It never promises a time, a price or
experience the contractor didn't pick. No claim like "fast replies win" is made;
we haven't measured that.

## Where it lives

`src/lib/replyDrafts.ts` (drafts, reply state, triage order; tested),
`src/components/pro/ReplyPanel.tsx`, `src/pages/pro/ProInbox.tsx`.

## Not built yet

Reply by SMS or email (replies stay in Haleo notifications for now), saved
availability so day chips reflect a real calendar, a "reply from the push
notification" action, and a measured first-reply-time metric.
