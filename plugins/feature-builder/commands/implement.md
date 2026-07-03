---
description: Start building ready features from features.json through the full pipeline
argument-hint: "[module|FE-id] [--quick|--standard|--enterprise] [--model opus|sonnet] [--no-replicate]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /implement — start the Phase 4 build

Invoke the **feature-builder** skill (ScenarioForge Tier 2 worker) to begin building.

Target: `$ARGUMENTS` (a module name, a single `FE-<id>`, or empty = the whole current module).
If a scale flag is present (`--quick` / `--standard` / `--enterprise`) use it; otherwise read
`meta.effort_scale` from `scenarios.json`. Routing/override flags (`--model`, `--exemplar`,
`--no-replicate`) are passed through to the routing step.

Do this:
1. Read `features.json`. If it's missing, stop and tell the user to run `solution-arch` first.
2. Read `.scenarioforge/impl-progress.json` if it exists — if there's unfinished work, tell the user to
   use `/feature-builder:continue` instead of restarting, unless they explicitly want a fresh run.
3. Select `ready_for_impl` features (just the one FE if an FE-id was given) and order them by `depends_on`.
4. **Route each feature** (see `references/model-routing.md`): hard / cross-page / security-sensitive ->
   Opus direct; clusters of simple, similar features -> one Opus exemplar + Sonnet replicas (the master
   shell is the canonical exemplar). Record the routing in the ledger; schedule each exemplar before its
   replicas. Honor any `--model` / `--exemplar` / `--no-replicate` override.
5. For each feature, **dispatch a fresh subagent at its routed tier** (4-part contract; a replica also gets
   the exemplar's files as context), run the implement loop -> UI Control Manifest (if it has form
   controls) -> the 8-step verification pipeline. Every feature is verified regardless of model.
6. Keep the progress ledger updated after every feature so the build is resumable.
7. End with the skill's Handoff block (what built, the routing mix, what's blocked, gaps, next worker).

Follow every boundary in the skill: never invent entities/APIs/pages (record gaps instead), never re-plan
features, never alter locked scenarios, no subagent spawns a subagent, respect the circuit-breaker caps
(a Sonnet replica stuck past half its cap is escalated to Opus once).
