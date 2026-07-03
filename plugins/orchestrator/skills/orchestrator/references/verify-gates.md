# Verify Gates — Per-Phase Criteria

A verify gate runs **after** a worker returns its handoff and **before** the next phase is delegated. It is
the orchestrator's equivalent of an `IPipelineBehavior` post-condition: a small set of checks the *next*
phase depends on. The gate reads the handoff block + the named artifact's `rollup` / the specific
`traces_down` field — never the whole artifact (artifact pattern).

## Gate outcomes

- **PASS** → mark the phase `done` in the run ledger; delegate the next pending phase.
- **FAIL (worker shortfall)** — the worker could have done it but left a hole (e.g. a scenario un-modeled,
  a gate it skipped). → record `gate_failed` + the reason; **re-delegate the same phase once** with the
  hole named in the objective. Count it against the gate-retry cap (`run-ledger.md`). A second failure →
  stop and surface to the user.
- **FAIL (refused-to-invent gap)** — the worker correctly stopped because an upstream artifact is missing
  and its boundary forbids inventing it (the gap is in its `*-notes.md`). → do **not** retry the same
  phase; **surface the gap to the user** and point at the upstream worker that must fill it. Re-running the
  same phase can't fix an upstream hole.

The gate never *fixes* anything itself — it stops the line and routes the fix. The orchestrator writing a
missing entity to make Gate 2 pass would be the exact boundary violation the whole design forbids.

## Gate 1 — after Phase 1 (scenario-discovery + critic loop)

The next phase (domain-design) needs scenarios with real business intent and a converged analysis layer.
Check, for the in-scope ids:
- [ ] `scenarios.json` exists and parses; the handoff's `artifact` points at it.
- [ ] Every in-scope scenario has `business.actor` AND `business.goal` non-null (the two that must never be null).
- [ ] Every `postconditions` item is measurable (the handoff/critic should have flagged vague ones) — qa
      derives tests from these later, so a vague postcondition is a downstream gap.
- [ ] `rollup.ready_for_next_phase == true` — i.e. the analysis beats filled `analysis{}` and the
      validation loop converged. If it is still `false`, the **loop has not finished**: re-delegate
      the critic beat (not full discovery) until it converges or the user accepts the open gaps.
      Panel suggestions and open questions resolve through the same loop — they are
      `pending_suggestions` until the user decides them.
- [ ] If the scale/registry enabled the beat-1.5 ideation panel, it ran (or its skip reason is in the
      ledger — QUICK always skips; a registry may disable it for a scale). Individually **skipped
      personas** (missing key, provider outage) are soft — noted in the panel handoff, never a gate
      failure.
- [ ] No single scenario mixes multiple goals (discovery should have split them).

FAIL here is usually "critic loop not converged" (re-delegate the critic) or "user hasn't supplied a
required business field" (surface — the orchestrator cannot invent business intent).

## Gate 2 — after Phase 2 (domain-design)

The next phases (screen-binding, solution-arch) need a domain model bound to the spine.
- [ ] Every in-scope scenario has non-empty `traces_down.entities` (and `use_cases` / `apis` where the
      scenario implies a server op).
- [ ] The handoff's named artifact (`design/` + registry) exists; `traces_down` refs point at files that
      actually exist under `design/`.
- [ ] `business{}` / `analysis{}` unchanged vs before the phase (the worker must not have edited them).
- [ ] ENTERPRISE only: cross-validation passed (ER↔DD bidirectional, FK type match) — required before
      `/deliver-docs` and before solutioning a regulated/large domain.
- [ ] A scenario the worker could not model because a `domain_concept` was missing → that's a **gap** in
      its notes, surfaced to the user (Phase 1 must add the concept), not a domain-design retry.

## Gate 2u — after Phase 2u (screen-binding) — only if the phase ran

The next phase (solution-arch) needs pages bound for has_ui scenarios.
- [ ] The shell exists under `mockups/shell/` (master page + theme.css + navbar + menu) and renders.
- [ ] Every in-scope `has_ui == true` scenario has non-empty `traces_down.pages`; no `has_ui == false` one
      gained pages.
- [ ] Every `PG-*` carries a valid `scenario_ref`, `fidelity`, and a `design_ref` that points at a file
      that exists.
- [ ] Every screen field maps to a Data Dictionary row — the handoff's `gaps` line lists any field with no
      DD row. A non-empty gaps line → **surface to the user** (domain-design owns the missing field), do
      not retry screen-binding.
- [ ] `business{}` / `analysis{}` unchanged; the shell + locked scenarios' pages not clobbered (UPDATE mode).

If no in-scope scenario has `has_ui == true`, this phase is **skipped** and the gate is recorded `n/a` —
not failed.

## Gate 3 — after Phase 3 (solution-arch)

The next phase (feature-builder) needs a buildable feature plan with a safe build order.
- [ ] Every in-scope (modeled) scenario has non-empty `traces_down.features`; the handoff names
      `features.json` and it parses.
- [ ] Every FE has a valid `scenario_ref` and a concrete layering plan (controller + service/handler +
      repository + DI + DTOs).
- [ ] `depends_on` forms **no cycle** and every dependency id resolves to a real FE (the handoff reports
      this; ENTERPRISE validates it explicitly). A cycle is a solution-arch error → re-delegate Phase 3
      once with the cycle named.
- [ ] For each has_ui scenario, every page in `traces_down.pages` is served by ≥1 FE.
- [ ] Any FE that needed a missing entity/API → a **gap** in `features-notes.md`, surfaced (domain-design
      fills it), not invented.

## Gate 4 — after Phase 4 (feature-builder)

The next phase (scenario-verify) needs built code + control manifests to test.
- [ ] The handoff reports every targeted feature `done` (8 gates green) OR explicitly `blocked` with a
      reason recorded in `impl-progress.json` / `impl-notes.md`. A `blocked` feature is allowed to advance
      the run **only** if the user accepts proceeding with it unbuilt; otherwise stop.
- [ ] No feature was marked `done` on a red verification gate; no iteration cap was exceeded silently
      (the worker's self-check asserts this — the orchestrator trusts the handoff but spot-checks the
      ledger `rollup`).
- [ ] Every form-control feature emitted a UI Control Manifest (`.scenarioforge/ui-controls/FE-*.json`) —
      scenario-verify cannot generate without these.
- [ ] No `error`-severity manifest drift left unresolved (esp. `permission-wider` = security risk).
- [ ] `traces_down.features` reflects what was actually built; `business{}` / `analysis{}` / locked
      scenarios unchanged.
- [ ] Gaps the worker refused to invent (missing design) → surfaced to the user (domain-design /
      solution-arch), not a feature-builder retry.

## Gate 4q — after Phase 4q (scenario-verify) — the release fence

This is the end of the line; the gate decides release-ready.
- [ ] The handoff reports **Gate 4 (control coverage) = PASS** — i.e. `gap_control_ids` and
      `fail_control_ids` are both empty: every control × every mandatory category it triggers has a
      `passed` scenario.
- [ ] If Gate 4 = BLOCKED, the run is **not** release-ready. Report exactly which control × category is a
      gap (no scenario) or a fail (red scenario). A `--force-control-coverage` override is allowed **only**
      if the user explicitly accepted it and it is logged — never waved through by the orchestrator.
- [ ] A red scenario that revealed a real app bug became a **finding** routed back to feature-builder
      (not patched in QA). If findings exist, the decision is the user's: loop back to Phase 4 to fix them,
      or accept and defer.
- [ ] Every `TS` carries a `scenario_ref`; `traces_down.test_scenarios` matches what was generated.

## Gate result in the run report

Each gate's outcome is recorded in the run ledger and surfaced in the final run report's `phases:` block
(PASS / BLOCKED / n/a / gate_failed→retried). The point of the gates, end to end, is that a green run
report means **the spine is connected and every phase's post-condition held** — not merely that every
worker returned without erroring.
