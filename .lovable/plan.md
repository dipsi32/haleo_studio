
# Haleo — "Turning raw vision into reality"

A homeowner-first remodeling platform that translates dreams into contractor briefs, audits proposals against city permit data, and tracks projects to final inspection.

---

## What we're building (MVP scope)

Three core features, one landing page, two pricing paths. Nothing outside this.

### 1. Landing Page
- Hero: "Stop dreading your remodel." + three-line promise + warm mantra
- Three-step "How it works" story (Translate → Audit → Stay)
- Two pricing cards: Homeowner $149 / Contractor $75 per project
- Closing line: "Haleo. Your unfair advantage."
- CTAs: Let's get started · Already have a proposal? · Jump back in

### 2. The Brief (intake → translated brief)
A guided 6-screen intake, one question per screen, auto-advancing where possible:
1. Room picker (icon grid)
2. Walkthrough video / floor plan upload (skippable)
3. Pain points — **room-specific pills only** (Addition swaps in 3 sub-screens: type / size slider / location)
4. Vibe pills + inspiration uploads
5. Budget dual-handle slider ($5K–$500K+) with live display
6. Timeline (4 pills, auto-advance)

Then: "Translating your vision..." loading → **Brief output** with two layers:
- **Homeowner layer** (first-person plain language)
- **Contractor layer** (technical translation) — revealed via toggle "See how contractors read this →" as the magic moment (smooth animated reveal)
- Includes budget, timeline, permit-likelihood flag, photo/floorplan thumbnails
- Actions: Send to contractor (link/email/PDF) · Download PDF · Edit brief

### 3. The Forensic Audit
- Upload proposal PDF (email-forwarding to proposals@haleo.studio noted as coming-soon for MVP; primary path is upload)
- Audit output: **Haleo Score (0–100)**, top 3 findings in plain language, 3–5 smart questions, downloadable PDF
- Multiple proposals → side-by-side comparison ranked by score, key differences highlighted
- Always framed: "Intelligence, not a recommendation."

### 4. The Project Pulse
- Shared project view with two lenses (homeowner / contractor)
- Homeowner: phase checklist, lead-time alerts, % complete, "Your next step is X", inspection schedule, PDF export
- Contractor: their milestones, read-only homeowner status, per-phase notes, "Waiting on homeowner" flag
- **Contractor accesses via shareable link, no login required** until they want to submit a proposal or check off milestones

---

## Voice & UX rules baked in everywhere
- Loading: "Translating your vision...", "Running the audit...", "Checking permit records..." — never "Loading..."
- Errors: "Something went sideways — let's try again."
- Audit findings always specific with a number and a city reference
- Never ask the same question twice; data flows across all three features
- Skip > block; nudge once

---

## Backend & data (Lovable Cloud)
- Auth (homeowner accounts; contractors lazy-signup)
- Tables: `profiles`, `user_roles` (homeowner/contractor/admin via separate roles table), `projects`, `briefs`, `proposals`, `audits`, `timeline_phases`, `inspiration_assets`
- Storage buckets: `walkthroughs`, `floorplans`, `inspiration`, `proposals`, `brief-pdfs`, `audit-pdfs`
- AI Gateway (Lovable AI) powers: brief translation (homeowner ↔ contractor layer), proposal line-item extraction, audit findings, smart questions, permit-likelihood flag
- San Jose permit data: seeded mock dataset for MVP (structure ready for real ingestion later) so the Haleo Score has real numbers behind it
- PDF generation for brief + audit (Haleo-branded one-pager)

---

## Design direction

Warm-confident, calm, premium. Feels like a trusted advisor, not a SaaS dashboard. Generous whitespace, soft natural palette, editorial typography, gentle motion on the brief reveal.

I'd like your input on a few visual choices before I lock in the direction.
