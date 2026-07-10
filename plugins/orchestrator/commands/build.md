---
description: Run the full ScenarioForge pipeline end to end — plan the phases, delegate each worker in order, gate between phases
argument-hint: "[module|SC-id|codebase-path] [--quick|--standard|--enterprise]"
allowed-tools: Read, Glob, Grep, Task, Bash(node:*)
---

# /build — drive the whole pipeline (Tier 0)

Invoke the **orchestrator** skill to take the in-scope work from wherever it is down to tested code,
delegating each phase and gating between them.

Target: `$ARGUMENTS` (a module, a single `SC-<id>`, an existing codebase path when `scenarios.json` is
absent — triggers the Phase 0 brownfield bootstrap — or empty = the current module in
`scenarios.json#meta.module`). A scale flag (`--quick` / `--standard` / `--enterprise`) overrides
`meta.effort_scale` for this run and is logged in the ledger.

Do this:
1. Read `scenarios.json`.
   - Missing, target is a module/`SC-id` with no codebase mentioned → stop and tell the user to start
     with `scenario-discovery` (the orchestrator drives existing work; it does not fabricate a spine).
   - Missing, but the target is an existing codebase (a directory/repo path, or the request explicitly
     asks to reverse-engineer/analyze existing code) → **brownfield bootstrap**: plan Phase 0
     (domain-design, reverse mode) first, then Phase 1 seeded from the `reverse-notes.md` it produces,
     then the normal sequence from Phase 2. See `references/phase-sequence.md` → "Phase 0 — Bootstrap".
2. Read `.scenarioforge/run-ledger.json` if it exists — if a run is in progress, **resume** from the first
   non-`done` phase (use `/resume` semantics); skip every phase already gated green.
3. Plan the ordered phase list for the scale + scope (`references/phase-sequence.md`): include Phase 0
   only for a brownfield bootstrap; include `2-planning-ui` only if an in-scope scenario has
   `has_ui == true`; drop the phases the scale skips; enable ENTERPRISE strict modes/gates. Write the
   plan to the ledger.
4. For each pending phase in order: build the **4-part contract** (`references/delegation-contract.md`),
   **dispatch a fresh subagent** for that worker (or its `/` command) via the Task tool, wait for the
   handoff, then run that phase's **verify gate** (`references/verify-gates.md`).
   - Gate PASS → mark `done`, advance.
   - Gate FAIL (worker shortfall) → re-delegate that phase once with the gap named.
   - Gate FAIL (refused-to-invent gap) → stop the line, surface the upstream decision to the user.
5. Respect the circuit-breaker caps (`references/run-ledger.md`): one phase at a time, never two at once;
   stop at the delegation / gate-retry cap rather than spin. No worker spawns a worker.
6. End with the skill's **run report** Handoff (phases + gate results + artifact pointers, from the ledger
   — never a file dump).

Follow every boundary in the skill: the orchestrator writes only the run ledger; it never writes a spine
field, design, feature, code, or test. A missing precondition is a stop-and-report, not something to invent.
