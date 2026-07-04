---
description: Resume an interrupted pipeline run from the ledger — pick up at the first phase that isn't gated green
argument-hint: "[module|SC-id]"
allowed-tools: Read, Glob, Grep, Task
---

# /resume — continue an interrupted run

Invoke the **orchestrator** skill to pick up a run where it stopped, re-running nothing that is already
gated green.

Target: `$ARGUMENTS` (a module, an `SC-id`, or empty = current module).

Do this:
1. Read `.scenarioforge/run-ledger.json`. If none exists, there's nothing to resume → tell the user to run
   `/build` or `/plan`. Read `scenarios.json` for the spine — on a brownfield bootstrap run,
   `scenarios.json` legitimately doesn't exist until Phase 1 (`1-analysis`) is `done`; its absence any
   time before that (Phase 0 pending, running, or even gated green) is expected, not an error.
2. Apply the resume rules (`references/run-ledger.md`):
   - Phases `done` (green gate) → skip.
   - A phase `in_progress` (crashed mid-delegation) → re-enter and re-delegate it fresh (the worker resumes
     from its own ledger — `impl-progress.json` / `qa-tracker.json` — so its internal work isn't lost).
   - A phase `gate_failed` with one delegation → re-delegate once with the gap named.
   - A phase `gate_failed` (already retried) or `blocked` → do **not** auto-retry; surface `decision_needed`
     and stop.
3. From the first non-`done` / non-`n/a` phase, continue the `/build` loop (delegate → gate → advance)
   through the rest of the plan, honouring the circuit-breaker caps (counters persist across the resume —
   they are not reset).
4. End with the run report Handoff.

The orchestrator writes only the run ledger; flat hierarchy and one-phase-at-a-time still hold on resume.
