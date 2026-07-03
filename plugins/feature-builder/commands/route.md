---
description: Preview the Opus/Sonnet routing plan for ready features without building anything
argument-hint: "[module|FE-id]"
allowed-tools: Read, Glob, Grep
---

# /route — preview the model-routing plan

Read-only dry run. Show how the **feature-builder** worker WOULD route each feature
(Opus vs Sonnet) before any code is written — useful for sanity-checking cost and assignments.

Target: `$ARGUMENTS` (a module, a single `FE-<id>`, or empty = current module).

Do this:
1. Read `features.json` (stop if missing -> run solution-arch first). Select `ready_for_impl` features.
2. Apply the routing rules from `references/model-routing.md` to each feature, scoring from its
   `effort`, `type`, `depends_on`, and `traces_up`:
   - **Opus, direct** — hard / cross-page / security-sensitive (effort L, command/integration/batch/report,
     depends_on >= 2, entities >= 3, pages >= 2, or a permissioned control).
   - **Opus, exemplar** — the reference feature of a simple replication group (the master shell counts here).
   - **Sonnet, replica** — the remaining members of each simple group, following their exemplar.
3. Present a table: `FE-id | type | effort | model_tier | routing_mode | exemplar_ref | reason`, grouped by
   replication group, with a summary count (`N Opus-direct, N Opus-exemplar, N Sonnet-replica`).
4. Note that this is a preview — nothing is built and the ledger is not written. To build, run
   `/feature-builder:implement` (optionally with `--model` / `--exemplar` / `--no-replicate` to adjust).

Do not implement, do not write the ledger — routing preview only.
