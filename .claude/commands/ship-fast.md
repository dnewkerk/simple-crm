---
description: Fast-lane implement an obvious-for-bots item — generate, sanity-check, commit (no test-first)
argument-hint: <task to implement>
---

Implement "$ARGUMENTS" in the FAST LANE. Use this only for changes that are
"obvious for bots": mechanical, low-blast-radius, and following an existing
pattern (UI tweak, copy change, an endpoint mirroring an existing one, adding a
field).

Steps:
1. State the task in one sentence and say why it qualifies for the fast lane.
2. Make the minimal change. For any UI, reuse existing components/styling
   conventions (read them first); no ad-hoc unstyled markup.
3. Sanity-check and SHOW the output: `npx tsc --noEmit`, plus the most relevant
   of — a quick `npm test`, a Playwright CLI check, or running the app and
   eyeballing the result. Say which check you chose and why.
4. Commit with a clear message, then stop for the next item.

The quality floor still applies: handle the empty, loading, and error states —
the fast lane changes HOW you verify (run-and-eyeball vs test-first), not whether
the unhappy paths are handled.

ESCALATION RULE: if you uncover hidden complexity, a real edge case, a data-model
or migration change, or anything security-sensitive, STOP, say so out loud, and
switch to the rigorous lane (`/ship`) instead.
