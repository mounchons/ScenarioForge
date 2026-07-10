---
description: Edit a test scenario, or re-sync scenarios when a UI Control Manifest changed (delta detection)
argument-hint: "<TS-id> | --from-control-spec [FE-id]"
allowed-tools: Read, Write, Edit, Glob, Grep
---

# /edit — adjust a scenario or re-sync from a changed manifest

Invoke the **scenario-verify** skill to edit a single `TS` or to reconcile the suite after a manifest
changed (the APPEND delta path).

Two modes from `$ARGUMENTS`:

**A) `<TS-id>` — edit one scenario.**
- Read it from `.scenarioforge/qa-tracker.json`. Adjust what the user asks (assertion, selector reference, category_detail)
  while keeping it anchored on a `data-testid` and keeping its `scenario_ref` intact.
- Never silently change which control/category it proves — if that changes, it's a different `TS` (deprecate
  + mint new), not an in-place edit.

**B) `--from-control-spec [FE-id]` — delta re-sync.**
- Compare each control's current manifest `manifest_emitted_at` to what the scenarios recorded
  (`references/qa-tracker.md`, APPEND rules).
- For a control whose manifest **changed**: mark superseded scenarios `deprecated`, mint new `pending`
  scenarios for the affected categories only (continue id numbering, never renumber).
- For a control **removed** from the manifest: mark its scenarios `deprecated` (keep for history).
- A control **unchanged**: leave its `passed` scenarios byte-for-byte; do not re-run.
- Recompute `coverage` + `rollup`; report the delta (deprecated N, new pending N).

Boundaries: never invent a control/rule; a manifest that's contradictory is a gap to `qa-notes.md`. Editing
never touches app code or locked scenarios.
