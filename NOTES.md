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
- Feature 3, 4 — not started.

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

## Fixed in passing (while touching the code)
- Null-guards on `POST`/`PUT /opportunities` (bad lead/stage → 400, unknown opp
  → 404) instead of an uncaught 500.
- `font-fold` → `font-bold` typo in the lead edit form heading.
- Enabled `esModuleInterop` in the server tsconfig + switched the express import
  to a default import (needed for the swc test transform; conventional anyway).
