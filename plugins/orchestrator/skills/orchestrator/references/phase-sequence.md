# Phase Sequence Planning + Scale Routing

The orchestrator plans the ordered phase list once (Step 1) and writes it to the run ledger before
executing. The plan depends on (a) the effort scale and (b) which scenarios are in scope (do any have UI?),
plus (c) whether this run is a **brownfield bootstrap** (see Phase 0 below).

## The canonical order (dependency chain)

```
0   Bootstrap       domain-design (reverse)  (conditional — only when scenarios.json is absent AND
                                              the target is an existing codebase; see "Phase 0" below)
1   Analysis        scenario-discovery   (+ beat 1.5 ideation panel + critic loop until ready_for_next_phase)
2   Planning        domain-design
2u  Planning/UI     screen-binding       (only if any in-scope scenario has_ui == true)
3   Solutioning     solution-arch
4   Implementation  feature-builder
4q  QA              scenario-verify
```

The order is fixed by data dependency, not preference:
- 0 (when it runs) produces `design/` + `reverse-notes.md` with **no** scenario to attach to yet.
- 1 reads 0's `reverse-notes.md` when bootstrapping (the candidate list needing user-confirmed business
  intent), otherwise reads the user's raw requirements directly.
- 2 reads 1's `business{}` — and, after a Phase 0 bootstrap, also reconciles against the `design/`
  Phase 0 already produced (an UPDATE pass: attach `traces_down`, don't re-extract from the codebase).
- 2u reads 2's sitemap + entities (so 2u runs **after** 2, even though both are "Phase 2").
- 3 reads 2's entities/apis **and** 2u's pages (so 3 runs after both planning halves).
- 4 reads 3's `features.json` + the artifacts each FE traces up to.
- 4q reads 4's UI control manifests + 2's acceptance criteria.

2u is the one has_ui-conditional phase. Decide it from the spine: if **no** in-scope scenario has
`business.has_ui == true`, drop 2u from the plan and record its gate `n/a`. If at least one does, 2u runs
between 2 and 3.

## Phase 0 — Bootstrap: brownfield without a `scenarios.json` yet

**Trigger:** `scenarios.json` is absent (Step 0's normal check) **and** the user's target is an existing
codebase — a directory/repo path, or the request explicitly says to reverse-engineer / analyze existing
code (not just a bare module name or `SC-id`, which is the plain "no spine yet, start from scratch" case
that still stops and points to `scenario-discovery`).

**What happens:** delegate `domain-design` in **reverse mode** (`references: codebase-analysis.md` in the
domain-design skill) against the codebase path. It extracts entities, Data Dictionary, API contracts, and
sitemap straight from the code and writes `design/` (+ registry) — same artifact shape as a forward design.
Because there is no `scenarios.json` yet, it writes **no** `traces_down` (nothing to attach to) and instead
records every extracted artifact with no matching scenario in `reverse-notes.md`, each a *candidate*
(inferred title/actor/goal from the code structure) marked `needs_user_confirmation` — never asserted as
confirmed business intent. This is domain-design's documented **bootstrap mode** (see its
`codebase-analysis.md` → "Bootstrap mode", which defines the candidate format) — Phase 0 is the
orchestrator actually routing to it instead of stopping cold.

**Then Phase 1 runs differently too:** scenario-discovery's objective is seeded from `reverse-notes.md`'s
candidates — it still **asks the user** to confirm/correct each candidate's actor, goal, business value,
and postconditions (scenario-discovery's core principle — business intent from the user only — holds even
here; the code structurally shows a route exists, not *why* it exists or whether it's still wanted). The
candidates make discovery faster (nothing to invent from scratch) without letting the orchestrator or
domain-design assert business intent on the user's behalf.

**Then Phase 2 runs again**, now in domain-design's own UPDATE mode (design/ already exists from Phase 0):
attach `traces_down.entities/use_cases/apis` for the newly-confirmed scenarios to the already-extracted
artifacts. It does not re-read the codebase a second time.

From Phase 2 onward the sequence is identical to a normal run (2u if any confirmed scenario has_ui, 3, 4,
4q). Gate criteria: see `references/verify-gates.md` → "Gate 0-reverse". Delegation contract shape: see
`references/delegation-contract.md` → "Phase 0".

**Scale note:** Phase 0 does not have its own scale variant — it always does the full reverse-engineer pass
(there is no "quick" partial extraction; you cannot reverse-engineer only 4 of 10 entities without also
reading the code that defines the other 6). The scale still governs Phase 1 onward as usual.

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
- a **codebase path** (`/build D:\GitHub\LegacyApp`, `scenarios.json` absent) → triggers the Phase 0
  bootstrap above. The in-scope ids are **not known yet** at planning time — the ledger's `scope.ids`
  starts empty and is filled in once Phase 1 creates the confirmed scenarios from `reverse-notes.md`.
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

## AMEND — user decisions arriving mid-run (the update-pass contract)

Runs accumulate **open decisions** (gaps/conflicts workers refused to resolve). When the user answers a
batch of them, do NOT re-run whole phases and do NOT let workers improvise — run a bounded **amendment**:

1. **Record the amendment** in the run ledger: `amendments[] += { id: "AMEND-<date>-<slug>", date,
   reason, decisions: { <GAP/CONFLICT-id>: "<the user's decision>" } }`. The decision text is the contract —
   workers translate it, never reinterpret it.
2. **Determine the affected phases** from what each decision touches (an entity/DD decision → domain-design;
   a screen behavior → screen-binding; a feature/layering split → solution-arch; built code → feature-builder)
   and run **update passes in canonical phase order** — only the affected workers, each delegated in its
   UPDATE/APPEND mode with the decisions verbatim in the objective and the standard boundaries (append-safe:
   never renumber, never touch unrelated artifacts, `business{}`/`analysis{}`/locked intact).
3. **Gate each update pass** with a spot-check (artifacts parse; only the expected sections/traces changed;
   the decision's ids now resolve; other gaps untouched), recorded under the amendment's `update_passes[]`.
4. Each update pass **counts against the delegation cap**; a large amendment may need a user-approved cap
   raise (`run-ledger.md`).

The per-worker UPDATE/APPEND modes are the building blocks; this section is the cross-phase choreography —
one amendment record, ordered update passes, one gate each, everything on the ledger.

A **brownfield bootstrap** run plans differently — no ids yet, and Phase 0 leads:
```
scale: STANDARD
scope: { codebase_path: "D:\\GitHub\\LegacyApp", ids: [], has_ui: null }   // ids/has_ui unknown until Phase 1
plan: [
  { phase: "0-reverse",          worker: "domain-design (reverse)", status: "pending" },
  { phase: "1-analysis",         worker: "scenario-discovery",      status: "pending" },
  { phase: "2-planning",         worker: "domain-design",           status: "pending" },
  // 2-planning-ui / 3 / 4 / 4q added once Phase 1 confirms scope.ids + has_ui
]
```
