---
description: Plan the phase sequence for the scale + scope and show it — delegate nothing yet (read-only)
argument-hint: "[module|SC-id] [--quick|--standard|--enterprise]"
allowed-tools: Read, Glob, Grep
---

# /plan — show the run plan without executing (read-only)

Invoke the **orchestrator** skill to compute the ordered phase list and show it, so the user can review
(and check cost) before any worker runs. This is `/build` Step 1 only — it stops before delegating.

Target: `$ARGUMENTS` (a module, an `SC-<id>`, or empty = current module). Scale flag overrides
`meta.effort_scale` for the preview.

Do this:
1. Read `scenarios.json` (and `.scenarioforge/run-ledger.json` if it exists). If no spine, stop and point
   the user to `scenario-discovery`.
2. Determine the in-scope set and `has_ui` from the spine; read the scale (flag or `meta.effort_scale`).
3. Compute the ordered phase list per `references/phase-sequence.md`: include `2-planning-ui` only if any
   in-scope scenario has `has_ui == true`; drop phases the scale skips; note which ENTERPRISE strict
   modes/gates would turn on.
4. Show the plan: each phase, its worker, what it consumes/produces, and (if a ledger exists) its current
   status (so the user sees what's done vs pending). Do **not** delegate, do **not** write artifacts.
5. Tell the user to run `/build` to execute, or `/next` to step one phase at a time.

Read-only: no Task dispatch, no writes (not even the ledger — `/plan` previews; `/build` is what
externalizes the plan to the ledger).
