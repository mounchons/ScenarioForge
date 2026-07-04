---
description: Show overall pipeline status across phases — what's done, gated, pending, blocked (read-only)
argument-hint: "[module|SC-id]"
allowed-tools: Read, Glob, Grep
---

# /status — overall pipeline status (read-only)

Invoke the **orchestrator** skill to report where the run stands across all phases, from the run ledger +
the spine's rollups — without delegating or writing anything.

Target: `$ARGUMENTS` (a module, an `SC-id`, or empty = current module).

Do this:
1. Read `.scenarioforge/run-ledger.json` and `scenarios.json`. If no ledger exists, report "no run started"
   and show what `/plan` would produce. If no spine: on a brownfield bootstrap run whose `1-analysis`
   isn't `done` yet, that's expected (Phase 1 creates the file) — report the bootstrap progress instead;
   otherwise point to `scenario-discovery`.
2. Report per phase from the ledger: status (pending / in_progress / done / gate_failed / blocked / n/a),
   gate result, the artifact pointer, and a one-line handoff summary.
3. Add the spine trace state from rollups (not file dumps): how far `traces_down` is connected
   (business → design → pages → features → code → tests) for the in-scope scenarios.
4. Surface `stopped_at` / `decision_needed` if the line is stopped, and show the circuit-breaker counters
   (delegations used vs cap).
5. End by naming the next action (`/next`, `/build`, or the upstream worker the user must run to clear a
   blocked phase).

Read-only: no Task dispatch, no writes.
