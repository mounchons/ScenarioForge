---
description: Retry a blocked feature (resets its iteration counter and rebuilds)
argument-hint: "<FE-id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /retry — retry a blocked feature

Invoke the **feature-builder** skill to re-attempt a feature that was marked `blocked`.

Target: the `FE-<id>` in `$ARGUMENTS` (required).

Do this:
1. Read the ledger; confirm the feature is `blocked` and show its `blocked_reason`.
2. If it was blocked by a **design gap** (entity/API/page missing), check whether the upstream artifact now
   provides it. If the gap is still open, stop and tell the user which upstream worker must fix it first
   (domain-design / screen-binding / solution-arch) — do not invent the missing piece.
3. If the gap is resolved or it was an iteration-cap block the user wants reattempted: reset this feature's
   `iterations` to 0, set it `in_progress`, re-dispatch a subagent at the appropriate tier (a feature that
   previously failed on Sonnet may be re-dispatched directly to Opus), and run the implement loop + 8-step
   pipeline again.
4. Update the ledger. Report the outcome.

Only retries the one named feature. Respects all boundaries and the circuit-breaker cap on the new attempt.
