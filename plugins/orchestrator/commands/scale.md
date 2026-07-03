---
description: Set or preview the effort scale (QUICK/STANDARD/ENTERPRISE) for the run and show how it changes the phase plan
argument-hint: "[quick|standard|enterprise]"
allowed-tools: Read, Glob, Grep
---

# /scale — set or preview the run's effort scale

Invoke the **orchestrator** skill to show what a given scale does to the phase plan, and record the chosen
scale for the run.

Target: `$ARGUMENTS` = `quick` | `standard` | `enterprise`. Empty = show the current effective scale
(`meta.effort_scale` or a logged override) and what each scale would change.

Do this:
1. Read `scenarios.json#meta.effort_scale` and `.scenarioforge/run-ledger.json` (if any).
2. If a scale was given, explain how it changes the plan (`references/phase-sequence.md`):
   - **quick** — append-one-scenario → the one FE → that control's coverage; planning phases skipped where
     the artifact already exists.
   - **standard** — full chain `1 → 2 → (2u) → 3 → 4 → 4q`, default worker modes.
   - **enterprise** — full chain + strict modes (cross-validation, HTML fidelity, dependency-graph
     validation, code-critic, qa-critic) + blocking coverage gate.
   Record the override in the ledger as `scale_source: "flag:--scale"` for this run (it overrides the file
   value but does not edit `meta.effort_scale` — that's the user's call in scenario-discovery).
3. If no scale was given, just report the current effective scale and the per-scale differences.
4. Point the user to `/plan` to see the resulting ordered phases, or `/build` to run.

Note: changing the scale changes which phases the orchestrator runs and which gates block — the workers
also read `meta.effort_scale` themselves, so for a permanent change the user should set it in the spine
(scenario-discovery), not just per-run here.
