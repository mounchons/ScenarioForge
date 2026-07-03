# Progress Ledger + Feature Status Lifecycle (feature-builder)

The ledger is what makes this worker **resumable**: an agentic loop iterates an unknown number of times, so
a session can end mid-build. The ledger records exactly where the build is, so a fresh session resumes
without redoing finished work and without losing a half-built feature. It also records the **model-routing
decision** per feature, so a resume re-dispatches at the same tier and replicas still know their exemplar.

## Location

`.scenarioforge/impl-progress.json` (per target solution / repo). One ledger per build campaign for a module.

## Schema (summary)

```jsonc
{
  "schema_version": "1.1.0",
  "module": "billing",
  "effort_scale": "STANDARD",           // mirrors meta.effort_scale at run start
  "started_at": "2026-06-14T09:00:00Z",
  "updated_at": "2026-06-14T09:42:00Z",
  "build_order": ["FE-billing-generate", "FE-billing-pay", "FE-billing-receipt"],  // topo of depends_on
  "replication_groups": {               // simple-feature clusters (Mode B)
    "billing-crud": {
      "exemplar": "FE-billing-list",     // Opus builds this first
      "replicas": ["FE-billing-archive", "FE-billing-export"]  // Sonnet follows the exemplar
    }
  },
  "features": {
    "FE-billing-generate": {
      "status": "done",                 // see lifecycle below
      "scenario_ref": "SC-billing-001",
      "model_tier": "opus",             // opus | sonnet  (who wrote it)
      "routing_mode": "direct",         // direct | exemplar | replica
      "exemplar_ref": null,             // for a replica: the FE id whose pattern it followed
      "escalated_to": null,             // set to "opus" if a Sonnet replica was bumped up
      "iterations": 3,                   // failed-build count this run (circuit-breaker counter)
      "last_substep": "verify:8",        // resume pointer (see sub-steps below)
      "gates": { "1": "pass", "2": "pass", "3": "pass", "4": "pass",
                 "5": "pass", "6": "pass", "7": "pass", "8": "pass" },
      "manifest": null,                  // path if a UI control manifest was emitted
      "blocked_reason": null,
      "files_touched": ["src/Features/Billing/GenerateInvoiceHandler.cs", "..."],
      "updated_at": "2026-06-14T09:20:00Z"
    },
    "FE-billing-archive": {
      "status": "in_progress",
      "scenario_ref": "SC-billing-002",
      "model_tier": "sonnet",
      "routing_mode": "replica",
      "exemplar_ref": "FE-billing-list",   // copies this exemplar's structure
      "escalated_to": null,
      "iterations": 2,
      "last_substep": "impl:controller",
      "gates": { "1": "pass", "2": "pending", "...": "pending" },
      "manifest": null,
      "blocked_reason": null,
      "files_touched": ["src/Features/Billing/ArchiveInvoiceController.cs"],
      "updated_at": "2026-06-14T09:42:00Z"
    }
  },
  "rollup": {
    "total": 3, "done": 1, "in_progress": 1, "blocked": 0, "pending": 1,
    "by_tier": { "opus": 1, "sonnet": 2 },
    "escalations": 0,
    "all_green": false
  }
}
```

## Feature status lifecycle

```
pending ──route+select──▶ in_progress ──all 8 gates pass──▶ done
                               │
                               ├──iteration cap hit / unrecoverable error──▶ blocked
                               ├──missing design (gap)────────────────────▶ blocked (gap recorded)
                               └──[replica] half cap still red────────────▶ escalated_to=opus (re-dispatch Mode A)
```

- `pending` — selected for this run, routed (tier assigned) but not started.
- `in_progress` — implementation loop running; `last_substep` is the resume pointer.
- `done` — built AND all 8 verification gates `pass`. Mirrored into `features.json` `status`.
- `blocked` — stopped before done: iteration cap reached, an unrecoverable build error, or a design gap.
  Always carries `blocked_reason`; gap blocks also write to `impl-notes.md`. Never silently abandoned.

A feature only moves to `done` when **all eight gates** are `pass`, no matter which model wrote it. A red
gate keeps it `in_progress` (back into the loop), it does not get marked done.

## Routing fields (set at Step 1, used on resume)

- `model_tier` — `opus` or `sonnet`; which tier the dispatcher sent this feature to.
- `routing_mode` — `direct` (Opus, hard feature), `exemplar` (Opus builds the group's reference), or
  `replica` (Sonnet follows an exemplar).
- `exemplar_ref` — for a `replica`, the FE id of the exemplar whose files it copies. The exemplar must be
  `done` before a replica starts (the build_order / replication_groups enforce this).
- `escalated_to` — if a Sonnet replica stayed red past half its iteration cap, it is re-dispatched to Opus
  once and this is set to `opus`. On resume, an escalated feature stays on Opus.

## Sub-steps (`last_substep` resume pointer)

Ordered values the loop writes after each completed sub-step, so a crash resumes at the right place:

```
impl:entity -> impl:efconfig -> impl:migration -> impl:repository -> impl:service
  -> impl:dto -> impl:controller -> impl:view (has_ui) -> impl:api -> impl:di
  -> manifest (form-control features) -> verify:1 ... verify:8 -> critic (ENTERPRISE) -> done
```

On resume, re-read the files already touched (don't rewrite them blindly), re-dispatch at the recorded
`model_tier` (an escalated feature on Opus), continue from the next sub-step, and **re-run the build once**
to confirm the resumed state still compiles before continuing.

## Resume rules (Step 0)

1. Read the ledger. Skip every `status == done` feature entirely.
2. For an `in_progress` feature: re-open `files_touched`, re-dispatch at its recorded `model_tier` (incl.
   the exemplar files if it is a `replica`), jump to the sub-step after `last_substep`, rebuild once to
   confirm state, then continue the loop. Do NOT reset `iterations` — the circuit-breaker counter persists
   across resumes for that feature.
3. For a `blocked` feature: do not auto-retry. Surface it to the user/orchestrator; only retry if the user
   explicitly asks (`/feature-builder:retry FE-...`) or the upstream gap was fixed.
4. Never start a `replica` whose `exemplar_ref` is not yet `done` — build the exemplar first.
5. Recompute `rollup` after any change. `all_green = (done == total AND blocked == 0)`.

## Idempotent write-back

When a feature reaches `done`, write its id into the owning scenario's `traces_down.features[]` only if not
already present (solution-arch may have planned it there already). Never duplicate, never reorder, never
touch other scenarios. Preserve `business{}`, `analysis{}`, and every `locked` scenario byte-for-byte.
