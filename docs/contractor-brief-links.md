# Contractor brief links

A contractor sends a prospect a Haleo link before the site visit. The homeowner
completes the normal brief, sees exactly who will receive it, consents, and the
brief lands in that contractor's inbox only, free, with a **deal read** on top.
When it's sent, the homeowner sees the contractor's public record in their own
city.

This is the contractor MVP. It reuses the homeowner product (intake, Haleo's
read, address intelligence, permit and license records) instead of building a
contractor product beside it.

## The catch, and how it's resolved

Today the homeowner **picks** contractors from ranked matches. A contractor-owned
link starts the other way round: the homeowner has already chosen. We settled it
by ranking principles, not by picking X or Y:

1. The homeowner stays in control of their own brief. Non-negotiable; it's the
   "no stake in the answer" brand.
2. Haleo's read is the same for everyone. The contractor can't edit it.
3. No one is deceived. The homeowner knows who invited them and what is shared.
4. The contractor gets value from sending the link, or no one sends one. So the
   brief goes to the inviter, not out to competitors.
5. Minimal friction: they already chose, so don't re-run the choice.

**Resolution:** two entry points, one pipeline. Both end in
`outreach_batches` / `outreach_sends`; `outreach_sends.source` records which door
(`homeowner_match` or `contractor_invite`). The invite door honors the pick: the
brief goes to the inviter only, by default. "Compare other contractors first" is
one click away on the brief result and the send step, and "See other contractors
near me" sits on the confirmation. Nothing pushes the homeowner toward
competitors, and nothing hides the option.

## Flow

| Who | Where | What |
| --- | --- | --- |
| Contractor | `/pro/links` | Creates a link per prospect (private nickname), copies it or a ready text message, sees opened and received, can turn a link off. Sets fit criteria. |
| Homeowner | `/i/:token` | Sees who asked, what they'll do, what they get, who sees it, the contractor's record. Starts the normal `/brief` flow. |
| Homeowner | `/brief/result` | Primary action becomes "Send to {contractor}". Compare stays visible. |
| Homeowner | `/i/:token/send` | Reviews what is shared, optional note, consent checkbox, sends. Then sees the contractor's record in their city. |
| Contractor | `/pro/inbox` | Brief arrives unlocked, marked "Your link", with the deal read first. |

## What's where

- `supabase/migrations/20261006180000_contractor_brief_links.sql`:
  `contractor_invites`, `outreach_sends.source` / `invite_id`,
  `contractor_accounts.buy_box`, and three functions.
  - `get_invite_public(token)`: who sent it and whether it's usable. Never
    returns the contractor's private nickname.
  - `mark_invite_opened(token)`: funnel ping.
  - `send_invited_brief(...)`: runs as definer so the homeowner can't change the
    recipient or unlock someone else's send. Idempotent for the same homeowner.
  - Contractors can only relabel or revoke an invite (column-level grant), so
    they can't fake the funnel numbers.
- `supabase/migrations/20261006170000_fix_outreach_rls_recursion.sql`: see below.
- `src/lib/invites.ts`, `src/lib/dealRead.ts`, `src/lib/proof.ts`,
  `src/lib/addressRisk.ts` (pure, tested).
- `src/pages/Invite.tsx`, `src/pages/InviteSend.tsx`, `src/pages/pro/ProLinks.tsx`.
- `src/components/pro/DealReadCard.tsx`, `BuyBoxCard.tsx`,
  `src/components/contractors/ProofPanel.tsx`.

## Pre-existing bug fixed along the way

The May 26 policies (`20260526165859`) made `outreach_sends` and `outreach_batches`
reference each other, so any signed-in `SELECT` on either table fails with
`infinite recursion detected in policy`. That is the table the contractor inbox
reads. The fix moves the cross-table lookups into `SECURITY DEFINER` helpers
(`is_batch_homeowner`, `is_batch_contractor`) with the same access rules.

**Check production before relying on it.** If the live database already differs
from the migration files, the old policies may still exist under other names:

```sql
select tablename, policyname, cmd, qual
from pg_policies
where tablename in ('outreach_sends', 'outreach_batches')
order by 1, 2;
```

## What the deal read does and doesn't do

It reads the brief against the contractor's fit criteria and shows: fit, size and
budget (including implied price per sq ft as plain arithmetic), permit position,
flags from public hazard records, what is still open (Haleo's own open questions
plus missing basics, each with an "Ask" button), and how complete the brief is.

It does **not** judge whether a budget is realistic. The cost-guide ranges stop
at $300K for additions and aren't wired to the UI. A local anchor from San Jose
permit valuations per square foot is the next step. Valuations run low, so show
it as a floor.

## Known follow-ups (deliberately not in this change)

- **`$99` unlock and "First contractor to reply usually wins."** Still on the
  marketplace door. Paying before you see a lead is the opposite of qualifying.
  Decide whether to pause it during the pilot.
- **"You're the only contractor we send this to"** (unlock copy) isn't accurate
  for marketplace sends to 2 or 3 contractors. It is true for invited briefs.
- **Matching is zip-based**, not city-based (`useContractors`, `AduContractorMatch`
  uses a four-digit zip prefix). Contractors asked for city.
- **Trust index weights** license standing at 18 points and code violations at 5.
  Contractor feedback was that license validity says little; citations say more.
- **Permit completeness.** A contractor's own record was missing recent permits in
  a demo. Proof built on permit data has to be complete or it hurts the
  contractors it's meant to help.
- `Contractors.tsx` builds the same snapshot and address-risk lookup inline.
  `src/lib/addressRisk.ts` can replace it.

## What to measure

Contractor side: links created, opened, completed; time from link to brief;
decision time per brief; visits avoided; links still being sent in week 4 without
a nudge. Homeowner side: completion rate of invited briefs, sends, clicks on
"compare". Gates and kill criteria live in the product strategy doc.
