---
description: List recorded design gaps that block features, with the upstream owner of each
allowed-tools: Read, Glob, Grep
---

# /gaps — list recorded design gaps

Read-only. Surface the gaps the implement worker recorded instead of guessing.

Do this:
1. Read `impl-notes.md` and the ledger (`.scenarioforge/impl-progress.json`).
2. List every recorded gap: which feature is blocked, what's missing, and which upstream worker owns the
   fix — domain-design (entity / field / API contract), screen-binding (a page / control), or
   solution-arch (a layering / plan error).
3. Group by upstream owner so the user can fix them in one pass per worker.
4. If there are no gaps, say so.

Read only — do not modify anything or attempt to fill a gap here.
