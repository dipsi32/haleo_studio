# Navigation: one name per door

Every way into Haleo is named once, in `src/lib/nav.ts`. The top nav, the mobile menu, the homepage tiles (as a small tag), the homepage demo tabs and each page's eyebrow read their words from there. `nav.test.ts` fails if a homepage tile has no menu item, or a name is used twice.

## The card sort

Grouped by what the homeowner is holding when they arrive, the same question the homepage asks ("Where are you in your search?"):

| Menu | Item | Homepage tile | Page |
|---|---|---|---|
| Find a contractor | Start a project | I'm just getting started | `/brief` |
| | Check names you've got | I have a few names from neighbors | `/shortlist` |
| | Check one contractor | I have a contractor in mind | `/shortlist?one=1` |
| Check a quote | Check a quote | I have a quote | `/roast` |
| Your home | Look up your house | (the house door) | `/house` |
| | ADU check | | `/adu` |
| For contractors | For contractors | | `/pro` |

Rules: menu names are verbs the homeowner would say ("Check a quote", not "Get it roasted"). Tiles stay in the first person ("I have a quote") and carry the menu name as a tag, so the two read as one door. A new screen takes its eyebrow from `NAV`.

## Sharing previews

`functions/house.ts` (a Cloudflare Pages Function) gives a shared `/house?street=…` link a preview that names the house. The site-wide preview in `index.html` carries the current pitch.
