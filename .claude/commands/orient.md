---
description: Orient on the codebase and produce a ranked, approval-gated plan
---

Execute Phase 1 from CLAUDE.md. Stay READ-ONLY. Produce:
1. A 10-line architecture summary (React -> Express -> TypeORM -> SQLite).
2. The UI design system in use: CSS approach (confirm Tailwind vs other) and the
   reusable primitives (Button, Input, Card, Modal, form patterns). Note these
   so all later UI reuses them.
3. A ranked list of must-do features with one-line specs each.
4. Known issues: fix-now vs. defer.
5. Discovered issues/smells/security concerns, ranked by severity.
Then STOP and ask me (in one batch) any clarifying questions. Do not implement
anything until I approve.
