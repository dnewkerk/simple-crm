---
description: Implement one approved item with the spec->test->code->verify loop
argument-hint: <feature or issue name>
---

Implement "$ARGUMENTS" using Phase 2 of CLAUDE.md, in order:
1. One-paragraph spec (user story + acceptance criteria). The criteria MUST name
   the empty-state and error-case behavior, not just the happy path.
2. Tests first — including at least the empty state and one error path.
3. Minimal implementation. For any UI, reuse existing components/styling
   conventions (read them first); no ad-hoc unstyled markup.
4. Run tests — show output, must pass.
5. `npx tsc --noEmit` — show output, must pass clean.
6. Playwright CLI check against the dev server — assert expected UI including the
   empty/error rendering where relevant; screenshot on failure.
7. Commit. Then summarize what is verified, and stop for the next item.

Do not mark this complete unless steps 4, 5, and 6 all actually passed with
shown output, AND empty/error states are handled.
