# Scale-Adaptive Behavior — solution-arch

> Child reference of `SKILL.md` (solution-arch). Read `meta.effort_scale` from scenarios.json and do only
> as much as the work needs. Mirrors the effort-scaling rule of the orchestrator (QUICK/STANDARD/ENTERPRISE).

## QUICK — normally skipped
A tiny or single-field/CRUD change goes straight to implement; the spine doesn't need a formal feature plan
for it. Run solution-arch under QUICK **only if explicitly asked**, and then:
- compose just the one FE the user named — no full-module sweep,
- minimal layering (controller + service/repo or a single handler),
- still write `scenario_ref` + `traces_down.features` so the spine stays intact,
- skip dependency-graph and cross-cutting validation.

## STANDARD — the default
Compose every planned scenario in the target module:
- one pass over scenarios whose `traces_down.entities` is populated,
- slice into FE per use case / AC (`feature-decomposition.md`),
- full `layering{}` per FE (`layering-rules.md`),
- set `depends_on` + `acceptance_refs`,
- write features.json + rollup + write-back.
No explicit graph proof, but `depends_on` should still be obviously acyclic by construction.

## ENTERPRISE — STANDARD plus validation + cross-cutting pass
Everything STANDARD does, then:
- **Dependency-graph validation** — prove the `depends_on` graph is acyclic and every id resolves to a real
  FE. A cycle or dangling id is a hard self-check failure (report + stop, don't emit a broken plan).
- **Cross-cutting concern pass** — every FE must carry explicit notes for **auth** (guarding role/policy)
  and **transaction boundary**; flag audit/logging-relevant features. Missing either note = self-check fail.
- Pairs with the **code-critic gate** at implement (ENTERPRISE + output==code → critic mandatory). A clean,
  fully-validated feature plan is what lets the critic focus on code, not plan repair.

## Choosing the scale (if the user didn't say)
- bug fix / one field / one CRUD screen → QUICK (often skip this worker entirely)
- one module / a handful of scenarios → STANDARD
- whole system / regulated / hand-off to a team → ENTERPRISE

## APPEND interaction with scale
Scale governs depth, not whether to preserve. In any scale, APPEND mode still:
- reads features.json first, reuses ids, continues numbering, never re-plans `locked` scenarios,
- recomputes rollup over the whole file,
- sets `ready_for_next_phase = false` while any new FE is still `planned` (un-built), even if older FE shipped.
