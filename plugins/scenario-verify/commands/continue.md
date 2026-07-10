---
description: Resume an interrupted QA run from the qa-tracker ledger
argument-hint: "[module|SC-id|TS-id]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /continue — resume the Phase 4 QA run

Invoke the **scenario-verify** skill to resume a run that was interrupted, reading state from
`.scenarioforge/qa-tracker.json`.

Target: `$ARGUMENTS` (optional — narrow to a module / `SC-id` / `TS-id`; empty = resume the whole module).

Do this:
1. Read `.scenarioforge/qa-tracker.json`. If it doesn't exist, tell the user to run `/scenario-verify:generate` then
   `/scenario-verify:run`.
2. **Resume** per `references/qa-tracker.md`: skip every `passed` scenario, pick up `running`/`failed`
   ones at their recorded state (same `category`, `control_refs`, `model_tier`, `retries`). **Never reset a
   retry counter** — the circuit-breaker cap holds across sessions.
3. Re-dispatch each batch at its recorded tier (4-part contract) and continue the run loop exactly as
   `/run` does: preflight the app URL first, run blocking in-turn with per-spec JSON results under
   `.scenarioforge/test-results/`, fix the test on a test defect (per `references/spec-authoring.md`),
   file a finding on a real app defect, respect the caps, escalate a half-cap Haiku/Sonnet scenario to
   Opus once.
4. Recompute `coverage` + `rollup`, keep `meta.run_status` in sync, enforce **Gate 4**, end with the
   Handoff block.

Boundaries identical to `/run`: fix the test not the app, anchor on `data-testid`, flat hierarchy, never
alter locked scenarios.
