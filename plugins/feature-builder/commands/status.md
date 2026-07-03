---
description: Show build progress — ledger rollup, per-feature status, model tier and gate state
argument-hint: "[FE-id (optional, for one feature's detail)]"
allowed-tools: Read, Glob, Grep
---

# /status — report build progress

Read-only. Invoke the **feature-builder** skill's reporting view.

Do this:
1. Read `.scenarioforge/impl-progress.json`. If it's missing, say there's no build in progress and point to
   `/feature-builder:implement`.
2. If `$ARGUMENTS` names an `FE-id`, show that feature's detail: status, model_tier, routing_mode,
   exemplar_ref, escalated_to, iterations, last_substep, the 8 gate states, manifest path, blocked_reason,
   files_touched.
3. Otherwise show the rollup: total / done / in_progress / blocked / pending, the `by_tier` mix
   (Opus vs Sonnet), escalations, `all_green`, and a short table of each feature with its status,
   model tier, and which gates are still pending or red.
4. List any features blocked on a design gap (point the user to `impl-notes.md`), and any replica still
   waiting on an unfinished exemplar.

Do not modify anything — this is a status read only.
