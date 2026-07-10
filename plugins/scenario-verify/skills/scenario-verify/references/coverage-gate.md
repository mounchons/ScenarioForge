# Gate 4 — Control Coverage (the Layer 2 release fence)

Gate 4 is the **release-time half** of the two-layer fence. feature-builder's Gate 5 (build-time unit
fence) proves each control binds + validates in isolation (Layer 1). Gate 4 proves each control's
**user-facing behavior** is covered by passing E2E scenarios (Layer 2). A build cannot be reported
release-ready while Gate 4 is blocked.

## The rule

> For **every control** in the module's UI Control Manifests, **every mandatory category it triggers** must
> have a `passed` scenario in `.scenarioforge/qa-tracker.json`.

Mandatory categories per control come from `control-spec-scenarios.md`: `render-binding` always, plus each
conditional category whose trigger fires (`api-binding`, `permission` per role, `validation` per rule,
`cascade-loading-error`).

## The math (computed into `coverage`)

For each control:
- `mandatory_categories` = the set its manifest triggers.
- `covered` = categories with at least one scenario (any status).
- `passed` = categories with at least one `passed` scenario.
- `gap_categories` = `mandatory_categories` − `covered` (triggered but no scenario exists at all).
- `fail_categories` = `covered` − `passed`, intersected with mandatory (a scenario exists but none green).

Then:
- `gap_control_ids` = controls with a non-empty `gap_categories`.
- `fail_control_ids` = controls with a non-empty `fail_categories`.
- **`gate_4 = PASS`** iff both lists are empty. Otherwise **`BLOCKED`**, and the report names exactly which
  `control x category` is missing (gap) or red (fail).

`release_ready` in the rollup = `gate_4 == PASS` AND no `pending`/`running`/`failed` scenarios remain.

## What blocks vs what doesn't

- A **gap** (mandatory category, zero scenarios) blocks — coverage is incomplete.
- A **fail** (scenario exists, red) blocks — behavior is unproven (and usually has a finding filed).
- A `deprecated` scenario does **not** count toward `covered` — if a control still triggers a category whose
  only scenario is deprecated, that category is a gap again.
- A **non-mandatory** category never blocks (there are none today — all five are mandatory-when-triggered —
  but the math leaves room for future advisory categories).

## Reporting

When BLOCKED, the report is specific and actionable, e.g.:
```
Gate 4: BLOCKED
  card-select   gap:  [validation]          -> no VAL scenario derived/passing
  amount-input  fail: [permission:manager]  -> TS-...-PERM-manager-001 red (FND-billing-003)
```
Never report a bare "coverage incomplete" — always the control, the category, and (for fails) the failing
`TS` + any `finding_ref`.

## Override

`--force-control-coverage` marks Gate 4 satisfied despite a gap/fail. It is **logged, never silent**: write
the override + reason + timestamp to `qa-notes.md` and the meta. Acceptable only pre-launch with explicit
sign-off; overriding a red `permission` scenario is a **security** decision and must be called out as one.

## Where Gate 4 sits relative to feature-builder

```
feature-builder Gate 5 (Layer 1, build time)   scenario-verify Gate 4 (Layer 2, release time)
  every control: binding_test + validation_test   every control x mandatory category: passing E2E
  missing -> feature can't pass                    gap/fail -> release blocked
```
feature-builder **emits** the manifest; scenario-verify **consumes** it and enforces Gate 4. Neither owns
both halves — that separation is the defense in depth.

## Analogy (.NET / DDD)

Gate 4 is **required status checks on a protected branch**. Each mandatory category is a required check
registered for that control; the branch (release) can't merge until every required check is green. A `gap`
is a required check that was never configured to run (so the merge button stays disabled until it exists); a
`fail` is a configured check that ran red. `--force-control-coverage` is an admin "merge without passing
checks" — possible, logged, and a smell when used on a security check.
