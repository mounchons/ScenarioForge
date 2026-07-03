# Phase Sequence Planning + Scale Routing

The orchestrator plans the ordered phase list once (Step 1) and writes it to the run ledger before
executing. The plan depends on (a) the effort scale and (b) which scenarios are in scope (do any have UI?).

## The canonical order (dependency chain)

```
1   Analysis        scenario-discovery   (+ beat 1.5 ideation panel + critic loop until ready_for_next_phase)
2   Planning        domain-design
2u  Planning/UI     screen-binding       (only if any in-scope scenario has_ui == true)
3   Solutioning     solution-arch
4   Implementation  feature-builder
4q  QA              scenario-verify
```

The order is fixed by data dependency, not preference:
- 2 reads 1's `business{}`.
- 2u reads 2's sitemap + entities (so 2u runs **after** 2, even though both are "Phase 2").
- 3 reads 2's entities/apis **and** 2u's pages (so 3 runs after both planning halves).
- 4 reads 3's `features.json` + the artifacts each FE traces up to.
- 4q reads 4's UI control manifests + 2's acceptance criteria.

2u is the one conditional phase. Decide it from the spine: if **no** in-scope scenario has
`business.has_ui == true`, drop 2u from the plan and record its gate `n/a`. If at least one does, 2u runs
between 2 and 3.

## Scale routing

Read `meta.effort_scale` (or the `--scale` override flag, which wins for this run and is logged). The scale
changes **which phases run** and **which gates block** — not the order.

### QUICK — a tiny / CRUD change on an existing system
The design + features usually already exist; the point is to add a small thing fast, not re-run planning.
- **Plan:** `1 (append one scenario) → 4 (the one FE) → 4q (that control's coverage)`. QUICK never
  runs the beat-1.5 ideation panel (the critic may still run per the analysis rules).
- Skip 2 / 2u / 3 **only if** their artifacts already exist and cover the change (the existing
  `scenarios.json` is in APPEND mode, `design/` + `features.json` already hold the entities/FE the change
  touches). If a needed artifact is genuinely missing (e.g. the change needs a new entity with no DD row),
  the gate for that phase will fail as a refused-to-invent gap → the orchestrator inserts the missing
  planning phase or surfaces it. QUICK is an optimization, never a way to skip a genuinely-needed phase.
- feature-builder is called directly on the one `FE-id` (`/feature-builder:implement FE-... --quick`);
  scenario-verify on that one control (`/scenario-verify:generate SC-... --quick` then `/run`).

### STANDARD — the default full chain
- **Plan:** `1 → 2 → (2u if any has_ui) → 3 → 4 → 4q`, each gated.
- Workers run their default modes (domain-design's 4-artifact working set, screen-binding wireframe
  fidelity, solution-arch full-module compose, feature-builder full 8-step pipeline, scenario-verify full
  5-category set + Gate 4). Phase 1 runs the beat-1.5 ideation panel capped at 5 personas (one
  panel-runner delegation), then the critic loop.

### ENTERPRISE — full chain, strict modes, blocking coverage
- **Plan:** same order as STANDARD, with the strict worker modes turned on and the coverage gates enforced
  as blocking:
  - scenario-discovery: full beat-1.5 ideation panel (cap 10; external AI providers per the
    registry — model diversity encouraged) before the critic beat.
  - domain-design: cross-validation (ER↔DD, FK types) + `/deliver-docs` available for the full 10-section
    SDD; Gate 2 requires cross-validation passed.
  - screen-binding: HTML fidelity + design tokens + per-page states/roles.
  - solution-arch: dependency-graph validation + cross-cutting pass (auth / transaction boundaries noted).
  - feature-builder: the **code-critic gate** (fresh Opus subagent critiques each code diff).
  - scenario-verify: the **qa-critic gate** (edge cases / weak assertions reviewed before the run) +
    every permission role + every validation negative path tested.
  - Gate 4q is **blocking** — a coverage gap or fail stops release; an override must be an explicit,
    logged user decision.

The orchestrator passes `scale=<value>` in every contract's `context_refs`; the workers also read
`meta.effort_scale` themselves, so the scale is honoured both in *which phases run / gates block*
(orchestrator) and in *how each worker behaves* (worker).

## Scope: what "in-scope" means

The user's target sets the in-scope scenario set:
- a **module** (`/build billing`) → every scenario with `meta.module == billing` (or the `SC-billing-*` ids).
- a single **`SC-id`** (`/build SC-billing-002`) → just that scenario's chain.
- **empty** (`/build`) → the current module in `scenarios.json#meta.module`.
The in-scope ids go into every contract's `context_refs` so each worker acts only on them and the gates
check only them.

## Planning output (written to the run ledger)

Step 1 produces, and the ledger stores:
```
scale: STANDARD
scope: { module: "billing", ids: ["SC-billing-001","SC-billing-002","SC-billing-003"], has_ui: true }
plan: [
  { phase: "1-analysis",        worker: "scenario-discovery", status: "pending" },
  { phase: "2-planning",        worker: "domain-design",      status: "pending" },
  { phase: "2-planning-ui",     worker: "screen-binding",     status: "pending" },   // included: has_ui true
  { phase: "3-solutioning",     worker: "solution-arch",      status: "pending" },
  { phase: "4-implementation",  worker: "feature-builder",    status: "pending" },
  { phase: "4-qa",              worker: "scenario-verify",    status: "pending" }
]
```
`/plan` shows this and stops. `/build` executes it phase by phase. `/next` executes exactly one pending
phase (delegate + gate) and stops — useful for stepping through a run under supervision.
