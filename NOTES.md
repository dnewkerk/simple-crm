# Deferred-work log

Running list of things noticed but intentionally not fixed, with the reason.
Source spec: `instructions.md`. Build order: F2 → F1 → F3 → F4.

## Status
- **Feature 2 (Add/Edit Opportunity UI)** — DONE & verified. Reusable modal form
  (add/edit), required Name + positive Value validation, opportunity custom
  fields editable in the form and displayed on the card. Server
  vitest+supertest, client vitest unit tests, Playwright E2E all green.
- **Feature 1 (expectedCloseDate)** — DONE & verified. Nullable `date` column
  added via TypeORM migration (`synchronize:false`, baseline + add-column
  migrations run on boot); POST/PUT plumbing; react-datepicker in the form.
  Server round-trip tests (set/null/clear/omit), client date-helper unit tests,
  Playwright (empty/create/edit-prefill/clear) all green.
- **Feature 3 (Monthly forecast Kanban)** — DONE & verified. `GET /opportunities/open`
  (pending stages); Forecast nav page with 6 month columns + Past/No Date Set +
  Future; spec'd CSS (275px cols, count badge, Total Expected Value = sum of
  `value`); cards sorted by close date; seed spreads close dates incl. guaranteed
  past + future open opps. Pure `buildForecast` unit-tested (empty/boundaries/
  sorting/rollover), server open-filter test, Playwright board check, all green.
- **Feature 4 (group forecast by custom field)** — DONE & verified. "Group by"
  control lists opportunity-scoped custom fields (+ No grouping); each column's
  opps are sub-grouped by the field value with a "No {Label}" fallback group
  last. Pure `groupByCustomField`/`regroupColumns` unit-tested (empty, all-missing,
  heading sort); Playwright (control, value headings, No-Region fallback,
  toggle-off). All green; tsc clean.

### Feature 4 notes (for the writeup)
- Grouping is exact-match and case-sensitive, so the seed's intentionally messy
  region values ("NA" vs "na" vs "North America" vs "") each form their own
  group. I removed the heading `uppercase` styling so "NA"/"na" don't render
  identically (honest display). A natural future feature is normalizing custom-
  field values (trim/case-fold) or making them a typed enum — the instructions
  hinted at this. Left as-is to avoid silently merging real data.
- When a grouping is active, the Past / No Date Set column groups by the field
  value across all its opps (its Past vs No-Date sub-split only shows when not
  grouping). Simpler than two-level nesting; flagged as a possible refinement.

## Feature 3 decisions (for the writeup)
- "Past" uses calendar-month boundaries (close date before the 1st of the current
  month), consistent with monthly bucketing — a date earlier *this* month still
  sits in the current-month column.
- Column total "Total Expected Value" sums each opp's `expectedValue` (the
  risk-adjusted forecast = value × close-likelihood), matching the original
  story ("a count and a total expected value") and the card's Expected figure.
  (An early per-feature note said sum `value`; we dropped that as inconsistent
  with the label. `value` = gross deal size; `expectedValue` = derived forecast;
  there is no "actual value" column.)
- Card click-to-detail was dropped earlier (no router); all values render inline.

### Migration test strategy (for the writeup)
Production/dev runs `synchronize:false` with file-glob migrations executed on
boot. Tests run against an in-memory SQLite DB built from the entities
(`synchronize` on only when `SQLITE_DB` is set), because TypeORM loads `.ts`
migration files through its own require path, which bypasses Vitest's swc
transform. The real migrations are exercised by the dev-server boot and the
Playwright run against it (verified: `migrations` table shows both ran and the
`expectedCloseDate` column exists). A cleaner long-term option is importing the
migration classes directly into the DataSource so one path works everywhere.

## Testing approach (for the writeup)
- Server: `vitest` + `supertest` integration tests hitting the real Express app
  against an in-memory SQLite DB (`SQLITE_DB=:memory:`). Needed `unplugin-swc`
  because esbuild (vitest's default) doesn't emit the decorator metadata TypeORM
  relies on.
- Client: `vitest` unit tests on extracted pure helpers (`opportunity-form-utils`)
  — covers the empty state (no custom fields / add mode) and edit prefill.
- E2E: global Playwright CLI script (`code/client/e2e/*.mjs`) driving the dev
  server. Chose integration + a thin E2E smoke over heavy component tests.

## Deferred bugs / smells (not yet addressed)
- **Stage.expectedValue cache drift** — `expectedValue` is denormalized onto
  Stage and recomputed in several endpoints. Changing a stage's likelihood or
  `defaultStageConversionLikelihood` never recomputes existing opportunities or
  the stage cache; `PUT /settings/:key` updates the stage cache but not the opp
  rows. The `/pipeline` endpoint hides this by recomputing from opportunities,
  so it's a latent inconsistency, not a visible bug. *Deferred: not in scope for
  the forecast features; would revisit the whole cached-value design.*
- **lead-row "Expected" display** — shows `value * stage.conversionLikelihood`,
  ignoring won/lost likelihood settings and the server's stored `expectedValue`.
  Inconsistent with the pipeline. *Deferred: display-only; not required by F2.*
- **`age` stored as a string** — Add/Edit Lead send the raw string; `Lead.age`
  is typed `number`. No parse/validation server-side. *Deferred: pre-existing,
  outside the forecast scope.*
- **No auth / no validation layer / no CORS/helmet** — no authn/authz on any
  route; inputs largely unvalidated. *Deferred: acceptable for a local take-home;
  noted as the first thing to add for production.*
- **AddLead renders ALL custom fields, not just lead-scoped ones** — `add-lead.tsx`
  maps over every custom field definition without filtering by `entity`, so the
  Add Lead form shows opportunity-scoped inputs (e.g. "Region") and stores them
  on the lead. Should filter to `entity === "lead"` (mirror of the opp form).
  *Deferred: pre-existing; spotted while scoping the Playwright selectors. Same
  bug likely in the lead edit form in `lead-row.tsx`.*

## Minor hardening deferred (reviewer nits, non-blocking)
- **Server doesn't normalize `expectedCloseDate: ""` to null** (`index.ts` POST
  `?? null` / PUT `!== undefined`). Latent only — the client's `buildPayload`
  already coerces `"" -> null`. A `|| null` on the server would be defensive.
- **Server date round-trip tests use `toContain("YYYY-MM-DD")`** rather than
  exact equality. They pass and the stored value is clean; exact match would be
  marginally stronger.

## Fixed in passing (while touching the code)
- Null-guards on `POST`/`PUT /opportunities` (bad lead/stage → 400, unknown opp
  → 404) instead of an uncaught 500.
- `font-fold` → `font-bold` typo in the lead edit form heading.
- Enabled `esModuleInterop` in the server tsconfig + switched the express import
  to a default import (needed for the swc test transform; conventional anyway).
