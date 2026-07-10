---
description: Derive E2E test scenarios (TS-xxx) from acceptance criteria + UI Control Manifests into .scenarioforge/qa-tracker.json
argument-hint: "[module|SC-id] [--quick|--standard|--enterprise] [--category render-binding|api-binding|permission|validation|cascade-loading-error]"
allowed-tools: Read, Write, Edit, Glob, Grep, Task
---

# /generate — derive the Phase 4 QA scenario set (Tier 1)

Invoke the **scenario-verify** skill (ScenarioForge Phase 4 QA) to generate, not run, the test scenarios.

Target: `$ARGUMENTS` (a module, a single `SC-<id>`, or empty = the current module).
Scale: use the flag if present, else read `meta.effort_scale` from `scenarios.json`. A `--category` flag
restricts generation to one category.

Do this:
1. Read `features.json` + the UI Control Manifests under `.scenarioforge/ui-controls/`. If there are no
   manifests and no acceptance criteria to prove, stop and tell the user to run `feature-builder` first.
2. Read `.scenarioforge/qa-tracker.json` if it exists -> detect **CREATE vs APPEND** (`references/qa-tracker.md`). In
   APPEND, only mint the delta; never overwrite, never renumber existing `TS` ids, never touch a `passed`
   scenario whose control is unchanged. (A different `qa-tracker.json` at the **repo root** is another
   plugin's ledger — never read it as state, never overwrite it; note it in `qa-notes.md`.)
3. For each control in each manifest, derive its mandatory categories per
   `references/control-spec-scenarios.md` (`render-binding` always; the rest by manifest triggers; one
   `validation` per rule; **`permission` and `LOAD`/`ERR` page-grouped** with full `control_refs` — see
   "Page-level grouping", do not fan them out per control on a role-homogeneous page).
4. Mint each `TS-...` per `references/id-and-selectors.md`, anchor every step on the control's
   `data-testid` (a control with no test id is a **gap** -> `qa-notes.md`, do not use a fragile selector),
   carry the `scenario_ref`, and tag the routed `model_tier` per `references/model-routing.md`.
5. When writing the spec files themselves, follow `references/spec-authoring.md`: **probe each page's real
   DOM first** (control kinds, tabs/modals, rendering model), assert by control kind, `.first()` on prefix
   locators, and **never emit a `TODO(fixture)` body** — real seed data, an honest documented empty-state,
   or a gap. Shared helpers (`login`, `activateTab`) live under the suite's `helpers/`.
6. Write them `pending` into `.scenarioforge/qa-tracker.json` with `control_refs`, `category`, `category_detail`,
   `manifest_path` + `manifest_emitted_at`. Recompute `coverage` + `rollup`.
7. Do **not** run them — end by reporting the generated set (counts by category + tier) and pointing the
   user to `/scenario-verify:run`.

Follow every boundary in the skill: never invent a control / AC / permission rule (gap it instead), never
write app code, never alter locked scenarios, no subagent spawns a subagent.
