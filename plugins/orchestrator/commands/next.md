---
description: Execute exactly one pending phase — delegate it, run its gate, then stop (step through a run under supervision)
argument-hint: "[--standard|--enterprise]"
allowed-tools: Read, Glob, Grep, Task
---

# /next — run a single phase, then stop

Invoke the **orchestrator** skill to execute exactly **one** pending phase (delegate + gate) and stop, so
the user can inspect each handoff before the next phase runs. Useful for a supervised or first-time run.

Do this:
1. Read `.scenarioforge/run-ledger.json`. If there's no plan yet, compute it (the same planning step
   `/plan` previews) and — since `/next` executes — write it to the ledger (read `scenarios.json`; if no
   spine and the target is a module/`SC-id`, stop and point to `scenario-discovery`; if no spine and the
   target is an existing codebase, plan the Phase 0 brownfield bootstrap instead — see
   `references/phase-sequence.md` → "Phase 0").
2. Find the first phase that is not `done` / `n/a` in plan order. If every phase is `done`, report the run
   complete and stop.
3. For that one phase: build the **4-part contract** (`references/delegation-contract.md`), dispatch a
   fresh subagent for its worker via the Task tool, wait for the handoff, then run that phase's **verify
   gate** (`references/verify-gates.md`).
   - PASS → mark `done` in the ledger.
   - FAIL (worker shortfall) → re-delegate once with the gap named, then gate again.
   - FAIL (refused-to-invent gap) → mark `blocked`, set `decision_needed`.
4. Report just this phase's result (worker, artifact pointer, gate outcome) and what the next pending phase
   would be. Do **not** continue to it — that's the point of `/next`.

Respect the circuit-breaker caps and flat hierarchy. The orchestrator writes only the run ledger.
