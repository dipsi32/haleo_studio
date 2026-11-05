# A contractor's front door

Contractors already have a website: portfolio photos and a "Contact us" form. Haleo doesn't compete with it. It replaces the weakest part, the form that collects "kitchen remodel" and starts a round of phone tag, with a project planner that looks like theirs.

## What it is

- **One permanent link, in their name:** `haleo.pages.dev/us-creative-builders`.
  - It comes from the name on their account, so it works as soon as they claim their record.
  - They can choose a shorter name in `/pro/links` (`contractor_accounts.front_door_handle`): 3–40 letters, digits and hyphens, unique. Names that match one of the app's pages are reserved; a unit test keeps that list in sync with the router.
  - The link they text is bare. The website and Google versions carry `?src=website` or `?src=google`, so each brief says where it came from.
  - Old `/c/:slug` links keep working. `resolve_front_door()` checks the chosen name first, then the permit-record slug, then the account name.
- **In their colors.** Their brand color (`contractor_accounts.branding.color`) becomes the accent and the main button color on every page of their client's journey (`/c`, `/i`, `/brief`, `/login`), applied by `BrandTheme`. Their name and logo lead, and Haleo is a quiet "powered by" line. Haleo's own pages (Shortlist, home, account) never take a contractor's colors.
- **The same rules as a personal link.** Opening the page costs nothing. When a visitor taps "Share my project", `open_front_door()` mints them their own one-person invite, so the brief goes to this contractor only, the homeowner keeps it, and it lands in the inbox with visit prep. The invite carries `source`, and its label in the contractor's list says where it came from ("From your website").

## Two doors, two jobs

- **Their door** (`/c`, `/i`) sells them: their brand, their record, nothing about other contractors.
- **Haleo's door** (`/shortlist`, `/contractors`) compares: a neutral public-record view next to other names.

A homeowner can tell which one they're in, and neither pretends to be the other.

## Setup for the contractor

`/pro/links` → **Your front door**:
- A link for each place it's posted.
- Their color, with a picker and a code field.
- A ready "Start your project" button in their color, with HTML to paste.
- Steps for Wix, Squarespace, WordPress and Google Business Profile.

Most contractor sites are hard to edit, so the easiest path is pointing the button they already have at the link.

## Safety

- `open_front_door` only works for contractors with an account.
- It is capped at 60 new links per contractor per hour.
- It records only the source, from a fixed list.
- `get_front_door_public` returns only what the invite page already shows.

## Events

`front_door_viewed` (found, source), `front_door_started` (source), `front_door_link_copied`, `front_door_color_saved`. Briefs from the front door also fire `invite_brief_started` with `source`, so "briefs from contractor websites" is one query.

## Deploying

The migration `20261103120000_contractor_front_door.sql` goes live with **Actions → Bootstrap backend → production**.
