# Run Ledger + Circuit Breaker

The run ledger makes a multi-phase run **resumable** and **bounded**. A full STANDARD/ENTERPRISE run spans
six delegated phases (seven with a Phase 0 bootstrap) that can each take a while; a session can end mid-run. The ledger records exactly
which phase the run reached and each gate result, so a fresh session resumes without re-running a
green phase — and the circuit-breaker counters stop a runaway from delegating forever.

It is the **only** file the orchestrator writes. It is bookkeeping about the run, not project content
(no spine field, no design, no code lives here).

## Location

`.scenarioforge/run-ledger.json` — one per build campaign for a module (same `.scenarioforge/` dir the
other workers keep their ledgers in: `impl-progress.json`, `qa-tracker.json`).

## Shape

```json
{
  "schema": "1.0.0",
  "run_id": "run-billing-2026-06-14",
  "created_at": "2026-06-14T...",
  "updated_at": "2026-06-14T...",
  "scale": "STANDARD",
  "scale_source": "meta.effort_scale",        // or "flag:--scale" when overridden this run
  "scope": {
    "module": "billing",
    "ids": ["SC-billing-001", "SC-billing-002", "SC-billing-003"],
    "has_ui": true
  },
  "plan": [
    {
      "phase": "2-planning",
      "worker": "domain-design",
      "status": "done",                       // pending | in_progress | done | gate_failed | blocked | n/a
      "gate": "PASS",                          // PASS | BLOCKED | gate_failed | n/a | (null if not reached)
      "gate_detail": null,                     // reason string when gate_failed / BLOCKED
      "delegations": 1,                        // how many times this phase was delegated (>=2 means it was retried)
      "artifact": "design/ (+ registry)",      // the pointer the worker's handoff returned
      "handoff_summary": "12 entities, 8 apis, sitemap for 3 has_ui scenarios",
      "started_at": "...",
      "finished_at": "..."
    }
  ],
  "counters": {
    "total_delegations": 4,                    // across all phases this run
    "gate_retries": 1                          // re-delegations triggered by a failed gate
  },
  "stopped_at": null,                          // phase id if the line is stopped
  "decision_needed": null                      // the upstream gap / coverage override the user must resolve
}
```

On a brownfield bootstrap (Phase 0 planned), `scope.ids` and `scope.has_ui` start empty/`null` — there is no
spine yet to read them from — and get filled in once Phase 1 creates the confirmed scenarios. `scope`
carries a `codebase_path` field in place of `module` until then (the empty `ids`/`has_ui` keys stay). See
`references/phase-sequence.md` → "Phase 0" for the full planning-output example.

## Lifecycle of a phase entry

```
pending ──delegate──> in_progress ──handoff+gate PASS──> done
                          │
                          ├─ gate FAIL (worker shortfall) ─> gate_failed ─re-delegate once─> in_progress
                          ├─ gate FAIL (refused-to-invent) ─> blocked + decision_needed (surface to user)
                          └─ phase skipped by scale / no has_ui ─> n/a
```

- `done` requires a **green gate** — a phase is never `done` on an ungated or red handoff.
- `n/a` is for a phase the plan legitimately skipped (QUICK skips, or 2u when no has_ui). Recorded, not
  silently dropped, so the report shows what was and wasn't run.
- `blocked` means the line stopped on an upstream gap the worker correctly refused to invent;
  `decision_needed` names what the user must resolve and which upstream worker owns it.

## Resume rules

On start, Read the ledger:
- Phases `done` (green gate) → **skip**. Never re-run a green phase, even if a later phase failed.
- A phase `in_progress` (a crash mid-delegation) → re-enter it: re-delegate it fresh (the worker is itself
  resumable from its own ledger — feature-builder's `impl-progress.json`, scenario-verify's
  `qa-tracker.json` — so its internal work isn't lost).
- A phase `gate_failed` with `delegations == 1` → re-delegate once with the gap named (the gate-retry path).
- A phase `gate_failed` with `delegations >= 2`, or `blocked` → do **not** auto-retry; surface
  `decision_needed` to the user.
- Pick up at the first non-`done`, non-`n/a` phase in plan order.

## Circuit breaker (caps — stop, don't spin)

Anthropic's warning: a coordinator with no per-run cap can fan out absurdly (their first build spawned 50
subagents for a trivial query). The orchestrator caps itself:

| Cap | QUICK | STANDARD | ENTERPRISE | Meaning |
|---|---|---|---|---|
| max total delegations / run | 4 | 11 | 15 | Hard stop on `counters.total_delegations`. A full 6-phase run is 6 delegations; the headroom covers the Phase-1 analysis beats (ideation panel = 1, critic rounds) and gate-retries. A **Phase 0 bootstrap run raises this cap by one** (5 / 12 / 16) — Phase 0 is an extra delegation, and without the bump the headroom the other beats rely on quietly shrinks (a QUICK bootstrap would otherwise consume its entire cap on 0→1→4→4q with no room for the critic). Hitting the cap → stop and report, do not delegate further. |
| max gate-retries / run | 1 | 3 | 4 | A failed gate may re-delegate its phase; `counters.gate_retries` is bounded. Exhausted → surface to the user instead of retrying. |
| max re-delegations / single phase | 1 | 1 | 1 | One phase is re-delegated **at most once** for a worker shortfall. A second failure of the same phase → stop; the problem isn't transient. |

Additional invariants (not numeric, but enforced):
- **One level of delegation.** The orchestrator delegates workers; a worker never spawns a worker; an
  orchestrator never nests an orchestrator. (A worker's own internal subagents — feature-builder's
  per-feature implementers, scenario-verify's per-category batches — are that worker's one allowed level,
  below the orchestrator, and they themselves spawn nothing.)
- **One phase at a time.** Never two concurrent delegations — the chain is sequential.
- **Externalize the plan early.** The plan + counters live in the ledger from Step 1, before context fills,
  so a long run that approaches the context limit can resume from disk rather than from memory.

## What the ledger gives the run report

The final run report (the orchestrator's Handoff) is assembled from the ledger's `plan[]` (phase + gate +
artifact pointer per phase) + `counters` + `stopped_at` / `decision_needed` — never by re-reading the
artifacts. That is the artifact pattern at the top level: the orchestrator reports the shape of the run
from its own light bookkeeping, and the user can open any named artifact for detail.
