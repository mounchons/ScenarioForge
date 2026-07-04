---
description: Re-run the verify gate for a finished phase against the current spine (read-only check)
argument-hint: "[phase-id, e.g. 2-planning | 4-qa]"
allowed-tools: Read, Glob, Grep
---

# /gate — re-check a phase's verify gate (read-only)

Invoke the **orchestrator** skill to apply a phase's verify gate again against the current handoff + spine,
without delegating the worker. Use it to confirm a gate result, or to re-check after the user manually
changed something upstream.

Target: `$ARGUMENTS` = the phase id (`0-reverse`, `1-analysis`, `2-planning`, `2-planning-ui`,
`3-solutioning`, `4-implementation`, `4-qa`). Empty = re-check the most recently finished phase in the
ledger.

Do this:
1. Read `.scenarioforge/run-ledger.json` for the phase's recorded handoff + the named artifact, and
   `scenarios.json` for the spine.
2. Apply that phase's gate criteria from `references/verify-gates.md` — read the artifact's `rollup` / the
   specific `traces_down` field the gate checks, not the whole file.
3. Report PASS / BLOCKED / FAIL with the exact failing check(s). If FAIL, classify it: worker shortfall
   (a `/build` or `/next` would re-delegate once) vs refused-to-invent gap (an upstream worker must fill it
   — name which one).
4. Do **not** delegate or fix anything; `/gate` only checks. Update only the gate result in the ledger if
   it changed.

Read-only except for recording the refreshed gate result. No worker is dispatched.
