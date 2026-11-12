# Kicking off with a contractor

What happens after the demo, start to finish, and what has to be true for
it to work.

## Before the call (2 minutes, at `/admin/pilot`)

1. Search for the contractor by the name on their permits and **Add** them.
2. Open their card. Copy the **Demo** link (send it ahead, or show it on the
   call) and the **Claim** link (for the call).

## On the call (about 15 minutes)

1. **Claim the profile.** Open `haleo.pages.dev/pro/<slug>/claim`
   (Matt: `/pro/bakhtiary-mehdi-1d0f/claim`) on the contractor's phone.
   - They enter their license number. It's checked on the server too.
   - They enter their email and tap the sign-in link it sends, which brings
     them back to finish. (If the email app opens it in another browser,
     they re-enter the license number there and it completes.)
   - `claim_contractor_profile()` links their account, grants the
     contractor role, marks the profile claimed and saves the email Haleo
     uses to reach them.
2. **Get their link.** "Get my link" opens a one-screen setup (company name,
   logo and portfolio are optional), then **Your link** (`/pro/links`):
   `haleo.pages.dev/<their-business-name>`, with "Text it to a lead" and
   the reply already written. Have them save the reply as a text shortcut
   while you're on the call.
3. **Turn on alerts.** In the inbox, allow notifications on their phone.
   Until email is set up (see below), this is how they hear about a new
   brief.
4. **Take their baseline** (two minutes, on their pilot card): inquiries,
   visits and jobs won a month; minutes of texts and calls per lead before a
   visit; and out of 10 visits, how many hit a surprise that should have been
   caught earlier. The scorecard compares against these.
5. **Send the first one together.** Text the link to Deepa's phone, fill in
   a quick brief as a homeowner and send it. Watch it land in their inbox
   with the job at a glance and the lead-readiness note.

## What the homeowner does

They tap the link and give a name and phone number (optional). Then they add
photos, read Haleo's take on them, answer the quick questions, pick times
that work, and send. No account is needed: sending uses a guest session.
The contractor gets their number and can text back.

## Must be true in production

| What | How it gets set | Check |
|---|---|---|
| Claim works | Migration `20261111120000_claim_contractor_profile.sql`, run by **Bootstrap backend** | Claim flow reaches "You're in" |
| Sign-in email works | Supabase's default email (a link). A 6-digit code in the email needs custom SMTP or a paid plan | The link signs them in |
| Homeowners send without an account | Bootstrap sets `external_anonymous_users_enabled` | The send page opens without asking to sign in |
| Contractor gets a phone alert | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` GitHub secrets, then Bootstrap | Alert arrives after the test send |
| Contractor gets an email | `RESEND_API_KEY` secret and `RESEND_FROM` variable (a sender on a verified domain), then Bootstrap | Email arrives after the test send |
| Texts to the contractor | Not built (stub in `notify-contractor-brief`) | — |

Supabase's built-in email service only sends a few sign-in emails an hour.
That's fine for a few contractors, but set up a custom sender (SMTP) before
inviting many.

## After the call: what they see

- **Your link** (`/pro/links`): their link at the top. "Text it to a lead"
  opens the share sheet with the reply already written. A tip shows how to
  save it as a text shortcut.
- **Inbox**: each brief opens on the job. Under it is **Your call** (pursue /
  ask first / pass), then one quick question at a time: did it save
  back-and-forth, how the visit matched the brief, how it ended.
- **Once a week**: "How many inquiries came in, any way? How many got your
  link?"
- **After three calls**: "If Haleo cost $49 a month, would you keep using
  it?"

## The one number to watch

Briefs sent through contractor links (`invite_brief_sent`), per
contractor, per week. A contractor routing their real leads through the
link is pull. See `docs/pmf-pull.md`.
