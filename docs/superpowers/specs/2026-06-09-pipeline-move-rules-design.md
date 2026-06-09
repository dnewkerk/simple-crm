# Per-column move rules — design

Date: 2026-06-09
Status: Approved for spec review

## Context

The Pipeline board lets users drag opportunity cards between stage columns. We
already ship a **client-side** gate (commit `ffe95d1`): dragging a card into a
stage that fails an entry rule blocks the move, reverts the card, highlights it
light-yellow, and shows a react-hot-toast bulleting the failed rules; both clear
after 10s. That version hardcodes a single rule ("any stage except the
lowest-`order` one requires an expected close date").

Stages (columns) are **user-defined** at runtime via Manage Stages, so a
hardcoded rule keyed by column order doesn't hold up. We need rules that are
configured **per column by the user, persisted in the database, and enforced on
the server** (authoritative), while keeping the existing highlight + toast UX.

## Goals

- Each stage carries its own set of entry rules, editable by the user and saved.
- Rule **types** come from a fixed, extensible catalog in code. Initial catalog:
  one rule — `requireCloseDate` ("Expected close date is required").
- A cross-stage move that violates the target stage's rules is **rejected by the
  server** and surfaced in the UI as the existing highlight + bulleted toast.

## Non-goals (out of scope now)

- Additional rule types (value ≥ N, required custom field, etc.). The catalog is
  built to accept them; we only implement `requireCloseDate`.
- A condition builder / boolean expressions.
- Enforcing rules on opportunity **create** (`POST /opportunities`) or on
  same-stage reordering. Rules apply only when a card moves **into a different
  stage**.

## Data model

Add a `rules` column to `Stage`:

- `@Column("simple-json", { nullable: true })` defaulting to `[]`, mirroring the
  existing `customFields` JSON pattern.
- Shape: `RuleConfig[]`, where `RuleConfig = { type: string; params?: object }`.
  For now only `{ type: "requireCloseDate" }`. `params` reserved for future
  parameterized rules.
- Additive TypeORM migration `AddStageRules` (no backfill needed; absent/null →
  treated as `[]`). Seed leaves rules empty by default.
- `POST /stages` and `PUT /stages/:id` accept and persist `rules` (default `[]`
  when omitted, so existing callers are unaffected). `GET /stages` already
  returns the full stage, so rules travel to the client for the config UI.

## Rule catalog (server — single source of truth)

New module `server/src/move-rules.ts`:

```ts
interface MoveRule {
  type: string;
  message: string;                  // shown as a toast bullet
  passes: (opp: Opportunity) => boolean;
}
export const MOVE_RULES: Record<string, MoveRule>;  // keyed by type
export const evaluateMove = (opp, targetStage): string[];  // failed messages
```

`evaluateMove` reads `targetStage.rules`, looks each `type` up in the catalog,
runs `passes`, and returns the `message` of every failing rule (unknown types are
ignored). `requireCloseDate.passes` = opportunity has a non-empty
`expectedCloseDate`. Adding a rule later = one catalog entry + one config control.

## Enforcement (server)

Guard the **cross-stage** path only (when the moved opp's stage actually
changes). On violation, **write nothing** and return:

```
HTTP 422 { error: "Move blocked by stage rules", failedRules: string[] }
```

The live client moves cards via `PUT /opportunities/reorder` (`{ stageId,
orderedIds }`), which reassigns the listed opps to `stageId`; the guard runs for
any listed opp whose current stage differs from `stageId`. The `PUT
/opportunities/:id/move` endpoint also exists server-side; it gets the **same
guard** for parity so whichever path a client uses is covered. (Unifying the two
endpoints is out of scope.)

## Client behavior

Reuse the committed UX; change only the trigger and remove the client-side rule
logic:

- Cross-stage drop still moves optimistically, then calls the move endpoint.
- On **422**, read `failedRules` from the response, revert the card to its origin
  column, and drive the existing `flagFailedMove` (light-yellow highlight + toast
  with bulleted `failedRules`, both cleared by the single 10s timer).
- Generic network/500 errors keep the existing "couldn't save" banner.
- Delete the client rule engine (`pipeline-rules.ts`, its `pipeline-rules.test.ts`,
  the `failedMoveRules` usage, and the hardcoded "first stage" logic); the server
  is now authoritative. Keep `react-hot-toast`, the `OpportunityCard`
  `highlighted` prop, and the toast/highlight/timer code.

**Trade-off:** with no duplicated client rule logic, an invalid drop briefly
shows the optimistic move that snaps back on the 422 — consistent with the
existing reorder-error revert. A future client pre-check (reading `stage.rules`)
could remove the flash at the cost of mirroring rule logic. Deferred.

## Config UI

In Manage Stages, the add/edit stage form gains an **"Entry rules"** section that
renders the catalog as toggles and saves to the stage's `rules` array. For the
initial catalog that's a single checkbox: *"Require an expected close date to
enter this column."* Empty state: no rules checked = no restrictions.

## Testing

- **Server unit** (`move-rules`): no rules → `[]`; `requireCloseDate` with a date
  → `[]`; without a date → `["Expected close date is required"]`; unknown rule
  type ignored.
- **Server integration**: a stage with `requireCloseDate`; moving a dateless opp
  into it (via `/reorder` and via `/:id/move`) returns **422** with `failedRules`
  and leaves the DB unchanged; moving a dated opp succeeds (200); moving into a
  rule-free stage succeeds.
- **Stages endpoints**: `rules` round-trips on `POST`/`PUT`/`GET`.
- **Playwright**: set the rule via the Manage Stages toggle; a blocked drop shows
  the highlight + bulleted toast and reverts; both clear after ~10s; a compliant
  move succeeds. (Adapt the existing `pipeline-rules.mjs`.)

## Migration / compatibility

- One additive migration; existing rows read as no rules.
- Existing stage callers that omit `rules` keep working (default `[]`).
- `GET /opportunities`, forecast, and same-stage reorder are unaffected.
