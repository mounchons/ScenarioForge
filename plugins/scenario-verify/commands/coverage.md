---
description: Enforce Gate 4 — check every control x mandatory category has a passing scenario (release fence)
argument-hint: "[module|SC-id] [--include-controls] [--force-control-coverage]"
allowed-tools: Read, Glob, Grep
---

# /coverage — Gate 4 control-coverage check (read-only)

Invoke the **scenario-verify** skill to compute and report **Gate 4**, the Layer 2 release fence
(`references/coverage-gate.md`).

Target: `$ARGUMENTS` (a module / `SC-id`, or empty = current module). `--include-controls` shows the
per-control breakdown; `--force-control-coverage` records an override (logged, never silent).

Do this:
1. Read `qa-tracker.json` + the UI Control Manifests.
2. For every control, compute `mandatory_categories`, `covered`, `passed`, `gap_categories`,
   `fail_categories` per `references/coverage-gate.md`. A `deprecated` scenario does NOT count as covered.
3. Roll up `gap_control_ids` + `fail_control_ids`. **Gate 4 = PASS** iff both are empty, else **BLOCKED**.
4. Report **specifically** — never a bare "incomplete":
   ```
   Gate 4: BLOCKED
     card-select   gap:  [validation]
     amount-input  fail: [permission:manager] -> TS-...-PERM-manager-001 (FND-billing-003)
   ```
   With `--include-controls`, list every control's mandatory-vs-passed categories.
5. If `--force-control-coverage` is passed, mark the gate satisfied but write the override + reason +
   timestamp to `qa-notes.md` and meta, and call out explicitly if any overridden scenario is a
   `permission` (security) check.

Read-only except the override log. Point the user to `/scenario-verify:generate` (for gaps) or
`/scenario-verify:retest` (for fails).
