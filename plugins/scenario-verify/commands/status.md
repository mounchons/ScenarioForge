---
description: Show QA progress — status rollup, coverage gaps, model-tier mix (read-only)
argument-hint: "[module|SC-id|TS-id]"
allowed-tools: Read, Glob, Grep
---

# /status — Phase 4 QA progress (read-only)

Invoke the **scenario-verify** skill in read-only mode to report progress from `.scenarioforge/qa-tracker.json`.

Target: `$ARGUMENTS` (a module / `SC-id` for the rollup, or a `TS-id` for one scenario's detail).

Do this:
1. Read `.scenarioforge/qa-tracker.json`. If absent, tell the user nothing has been generated yet.
2. For a module / SC: report `rollup` — total, by_status (passed/failed/pending/deprecated), by_category,
   by_tier — and the **Gate 4** line (`gap_control_ids`, `fail_control_ids`, PASS/BLOCKED) and
   `release_ready`.
3. For a single `TS-id`: report its `category`, `control_refs`, `model_tier`, `status`, retries,
   `escalated_to`, `failure_reason`, and any `finding_ref`.
4. Surface open `findings[]` (real app bugs routed to feature-builder) with severity.

Read-only — change nothing. Keep it scannable.
