# Working agreement (read fully before acting)

This is a **time-boxed (~1 hour) take-home**. Optimize for shippable, verified
features over breadth. Value is on working, tested code and honest status
reporting over volume.

## Stack
React + Express + TypeORM + SQLite + Vite. TypeScript throughout.

## Model & effort
- Model is Opus 4.8 (fixed for this session).
- Use **standard/high effort** for planning and tricky logic.
- Use **Fast mode** for mechanical, well-specified edits to save the clock.
- Do NOT silently spawn large numbers of parallel subagents — it burns the
  5-hour usage window. Use at most one Verify subagent (see below).

## Phase 1 — Orient (timebox ~8 min, READ-ONLY)
1. Map the app: entry points, routes, TypeORM entities, the data flow from
   React -> Express -> DB. Produce a 10-line architecture summary.
2. Read the provided feature requests and the known-issues report.
3. Run a quick scan for obvious smells/security issues (auth on routes, raw SQL,
   unvalidated input, secrets in repo). LIST them; do not fix yet.
4. **Triage and STOP for my approval.** Output a ranked plan:
   - Must-do features (with one-line spec each)
   - Known issues worth fixing now vs. noting for later
   - Discovered issues, ranked by severity
   Ask any clarifying questions here in ONE batch. Wait for my go-ahead.

## Phase 2 — Per item, in this exact order (no skipping)
For each approved feature/fix:
1. Write a one-paragraph spec (user story -> acceptance criteria).
2. Write the test(s) FIRST (unit/integration as appropriate; for UI-visible
   behavior add a Playwright check).
3. Implement the minimal code to satisfy the spec.
4. Run the tests. They must pass.
5. Run `npx tsc --noEmit`. It must pass clean.
6. Verify the visible result with Playwright CLI against the running dev server
   (navigate, assert the expected element/text, screenshot on failure).
7. Commit with a clear message. Then move to the next item.

## Quality bar
Every feature must handle, not gloss over:
- **Empty state** — what the UI shows with zero rows / no data / first run.
  Never a blank screen or a crash.
- **Loading state** — explicit pending UI on async work, not a flicker.
- **Error state** — failed fetch, validation failure, server 500. Show a usable
  message; never swallow the error or leave the user stuck.
- **Edge inputs** — empty string, very long input, duplicates, unauthorized
  user, missing optional fields.
The spec's acceptance criteria must NAME the empty and error cases explicitly,
and the tests must cover at least the empty state and one error path. A feature
that only handles the happy path is NOT done.

## UI must match the existing design
Before building any UI, READ the existing components first. Identify:
- the CSS approach actually in use (Tailwind),
- the shared/primitive components (Button, Input, Card, Modal, etc.),
- spacing/color tokens and form patterns.
REUSE them. Do not introduce a new styling system, a component library, or raw
unstyled `<input>`/`<button>` when styled equivalents exist. New screens should
look like they were already part of the app. If no primitive exists for
something, match the nearest existing pattern rather than inventing one.
The expectation is a quality UI, not rough form fields.

## Honesty rules (important)
- NEVER report a test/typecheck as passing without showing the actual command
  output. If something fails, say so and show the error.
- If you are blocked or uncertain, stop and ask rather than guessing.
- If you run low on time, tell me what is DONE-and-verified vs. in-progress vs.
  untouched. A short honest status beats an optimistic summary.

## Pacing
- Budget roughly: 8 min orient, then ~12–15 min per feature.
- If an item is ballooning, flag it and propose deferring.
- Prefer the smallest change that meets acceptance criteria.

## Deferred-work log
Keep a running `NOTES.md` of everything noticed but not fixed (issues, smells,
security concerns) so it can be reported at the end.
