---
description: List recorded QA gaps + their upstream owner (missing manifests, missing AC, missing test ids)
allowed-tools: Read, Glob, Grep
---

# /gaps — list recorded QA gaps (read-only)

Invoke the **scenario-verify** skill to list everything this worker could **not** test because the contract
upstream was missing — never guessed.

Do this:
1. Read `qa-notes.md` + `qa-tracker.json`.
2. List each gap with its kind + upstream owner:
   - **missing-manifest** — a built form-control FE with no `.scenarioforge/ui-controls/FE-*.json`
     -> owner: **feature-builder**.
   - **missing-testid** — a control in a manifest with no `data-testid` selector -> owner: **feature-builder**.
   - **missing-AC** — a scenario whose `postconditions` have no acceptance criteria to derive a test from
     -> owner: **domain-design**.
   - **contradictory-manifest** — e.g. mockup implied role-gating but `permission` is null
     -> owner: **feature-builder / screen-binding**.
3. For each, show the affected control/FE/scenario and a one-line reason.
4. Separately list open **findings[]** (real app bugs already tested + routed to feature-builder) — these are
   not gaps (the test exists and is red), but the user usually wants both lists together.

Read-only. End by pointing to the owning worker for each gap. Never propose inventing the missing piece.
