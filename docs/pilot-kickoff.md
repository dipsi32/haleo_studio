# Kicking off with a contractor

What happens after the demo, start to finish, and what has to be true for
it to work.

## On the call (about 15 minutes)

1. **Claim the profile.** Open `haleo.pages.dev/pro/<slug>/claim`
   (Matt: `/pro/bakhtiary-mehdi-1d0f/claim`) on the contractor's phone.
   - They enter their license number. It's checked on the server too.
   - They enter their email and get a 6-digit code, or a sign-in link.
     Either one works.
   - `claim_contractor_profile()` links their account, grants the
     contractor role, marks the profile claimed and saves the email Haleo
     uses to reach them.
2. **Get their link.** "Get my link" opens a one-screen setup (company name,
   logo and portfolio are optional), then **Brief links** (`/pro/links`).
   Their front door is at the top: `haleo.pages.dev/<their-business-name>`,
   with a ready-to-send text.
3. **Turn on alerts.** In the inbox, allow notifications on their phone.
   Until email is set up (see below), this is how they hear about a new
   brief.
4. **Send the first one together.** Text the link to Deepa's phone, fill in
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
| Sign-in email shows a 6-digit code | Bootstrap "Sign-in settings" sets the email templates | The code arrives in the email |
| Homeowners send without an account | Bootstrap sets `external_anonymous_users_enabled` | The send page opens without asking to sign in |
| Contractor gets a phone alert | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` GitHub secrets, then Bootstrap | Alert arrives after the test send |
| Contractor gets an email | `RESEND_API_KEY` secret and `RESEND_FROM` variable (a sender on a verified domain), then Bootstrap | Email arrives after the test send |
| Texts to the contractor | Not built (stub in `notify-contractor-brief`) | — |

Supabase's built-in email service only sends a few sign-in emails an hour.
That's fine for a few contractors, but set up a custom sender (SMTP) before
inviting many.

## The one number to watch

Briefs sent through contractor links (`invite_brief_sent`), per
contractor, per week. A contractor routing their real leads through the
link is pull. See `docs/pmf-pull.md`.
