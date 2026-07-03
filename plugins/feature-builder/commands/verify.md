---
description: Re-run the 8-step verification pipeline on a feature (or all done features)
argument-hint: "[FE-id | --all]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# /verify — re-run the verification pipeline

Invoke the **feature-builder** skill's verification pipeline without re-implementing.

Target: `$ARGUMENTS` — a single `FE-<id>`, or `--all` for every feature currently `done`.

Do this:
1. Read `features.json` + `.scenarioforge/impl-progress.json`. Resolve the target feature(s).
2. Run the 8-step pipeline for each (see the skill's `references/verification-pipeline.md`):
   Build, Design Compliance, CRUD, API Integration, Test Coverage, Tech Audit, Config,
   and Scenario Trace Check (scenario_ref valid + every postcondition asserted by >=1 test).
3. Record each gate result in the ledger. If a gate goes red, set the feature back to `in_progress`,
   report which gate and why, and (only if the user asks) fix and re-run that gate.
4. Report a per-gate pass/fail table per feature.

This command checks; it does not implement new features. Don't mark anything `done` on a red gate.
