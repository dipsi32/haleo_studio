# Haleo's read of the homeowner's photos

Step 3 of the brief ("Here's what Haleo sees"). The homeowner judges Haleo by this moment, so it has to work every time and say something worth reading.

## What the homeowner sees

1. A one-line summary.
2. **What looks good**: true good news first. It calms people, and it's often money saved (solid cabinet boxes could mean refacing, not replacing).
3. **Worth a closer look**: what Haleo noticed that could change the scope (a stain under the sink, a missing GFCI by the counter).
4. **Questions to ask your contractor**: what a photo can't settle.

Each finding has why it matters, one next step, the photo it came from, and where it came from ("In your photo", "Our inference", "Worth asking"). Anything hidden behind a wall is a question, never a fact. No prices, brands or code section numbers.

Below that is "See the full read": the five detailed sections (structure, finishes, constraints, opportunities, code) written for the contractor. Then "Design ideas for this room", marked "Coming soon". Tapping it records `design_ideas_interest`, so we know whether to build it.

## What the contractor gets

Once the homeowner confirms, the findings ride along in the brief as **Worth checking on site**, the first section of `haleo_read` (`findingsSection` in `src/lib/spaceFindings.ts`). Contractor-only notes, such as panel capacity, go only to the contractor.

## Why the read used to fail, and what guards it now

"Edge Function returned a non-2xx status code" came from photos between about 3.7 and 4 MB. The browser only resized photos over 4 MB, but Claude rejects any image over 5 MB once it's base64-encoded, which is about 3.7 MB raw.

- **Browser** (`maybeCompressImage` in `src/lib/intake.ts`): every photo is resized before upload, to 2000 px and 1.5 MB at most. Floor plans get 2600 px, because they carry small text.
- **Server** (`supabase/functions/_shared/images.ts`): each image's real type is read from its bytes, and its size is checked against Claude's limit, plus a budget for the whole request. A bad photo is skipped and named ("1 photo was too large to read…"), and the rest are still read.
- **Errors**: the function always answers 200 with `{ success, error, retryable }`. `error` is a sentence written for a homeowner. The technical detail goes in `space_analyses.error`. The page shows the sentence and a **Try again** button (`friendlyAnalysisError` never lets a technical message through).

## Events

`space_read_completed` (number of findings, how many need attention), `space_read_failed`, `space_read_retried`, `space_finding_photo_opened`, `design_ideas_interest`.

## Deploying

The function change goes live only when **Actions → Bootstrap backend → production** runs.
