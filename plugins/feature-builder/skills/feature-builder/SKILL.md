---
name: feature-builder
description: >-
  Implement ready features into working code — Phase 4 (Implementation) of ScenarioForge, the
  Tier 2 agentic worker. Reads features.json (from solution-arch) plus the entities/pages each
  feature traces to, then implements one feature at a time in resumable iterations against the
  user's stack (ASP.NET Core 8 MVC + EF Core + PostgreSQL + Bootstrap 5 + jQuery + HTMX + DDD),
  looping implement -> build -> fix until green. Acts as a per-feature dispatcher: routes hard /
  cross-page features to an Opus subagent and simple / repetitive ones to a Sonnet subagent that
  replicates an Opus-built exemplar, to cut cost without losing quality. Runs an 8-step
  verification pipeline before a feature is marked done (build, design compliance, CRUD, API
  integration, test coverage, tech audit, config, and Scenario Trace Check) and a UI Control
  Manifest gate for any feature that touches form controls. Resumable across sessions through a
  progress ledger; bounded by a circuit breaker (max iterations per loop, no worker spawns a worker).
  Use when: a feature plan exists (features.json present, features marked ready_for_impl) and is
  ready to be built, when resuming a long build that was interrupted, when you need to implement /
  continue / finish a module's features with verification, OR when wiring controllers, EF Core
  repositories, services/handlers, views and APIs into a running app from an existing plan.
  Also triggered by "implement features", "build the features", "continue the build", "build the
  module", "resume implementation", "feature-builder", "finish the feature", "verification pipeline",
  "Phase 4".
  Trigger keywords: feature-builder, implement, implementation, build features, continue, build,
  agentic worker, verification, scenario trace check, ui control manifest, resumable, model routing,
  Phase 4.
  Do NOT use for: capturing business intent / scenarios (scenario-discovery, Phase 1); modeling
  entities, Data Dictionary, or API contracts (domain-design, Phase 2); designing screens
  (screen-binding, Phase 2 UI); planning feature units or layering (solution-arch, Phase 3);
  generating or running the QA test suite itself (qa-ui-test, Phase 4 QA).
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# feature-builder / implement (Tier 2 — Agentic Worker)

Phase 4 (Implementation). Take the feature units the spine already plans and **pour the concrete**:
read each `FE-<module>-<name>` from `features.json`, implement its controller -> service/handler ->
repository -> view/API slice against the user's stack, and loop `implement -> build -> fix` until the
feature compiles, passes its verification pipeline, and traces cleanly back to its scenario. Unlike the
Tier 1 workers (which finish in one deterministic pass), this worker is **agentic**: it iterates an open
number of times until the feature converges — so it must be **resumable** (a progress ledger survives
across sessions) and **bounded** (a circuit breaker caps iterations so a stuck loop reports instead of
spinning).

It is also a **per-feature dispatcher**: rather than coding everything at one model tier, it reads each
feature's shape and delegates the work to a fresh subagent at the right tier — **Opus** for hard /
cross-page / security-sensitive features, and an **Opus-built exemplar + Sonnet replicas** for clusters of
simple, structurally-similar features. This keeps the strong model on the work that needs it and the cheap
model on proven patterns.

> Full progress-ledger shape + feature status lifecycle + resume rules: `references/progress-ledger.md`
> The 8-step verification pipeline (each gate's pass/fail rule): `references/verification-pipeline.md`
> UI Control Manifest schema + two-layer fence + drift policy: `references/ui-control-manifest.md`
> Implementation conventions for the .NET stack (layer-by-layer): `references/implementation-conventions.md`
> Scale-adaptive + circuit-breaker + override flags: `references/scale-adaptive.md`
> Model routing — Opus for hard/cross-page work, Sonnet replicating an Opus exemplar: `references/model-routing.md`

## The line that defines this worker

`solution-arch` answers **"how it assembles"** (the FE plan: which controller, which handler, which
repository, named but empty). `feature-builder` answers **"now it runs"** — it writes the bodies, wires DI
in `Program.cs`, creates the EF Core migration, builds the views, and proves the slice works end to end. It
is the only worker that produces source and the only one that loops. It plans nothing new: a feature that
needs an entity, field, API, or page the plan never defined is a **gap**, not a thing to invent — record it
and stop for that feature; sending it back upstream is correct, guessing the missing piece is not.

## What this worker reads / writes

Reads `features.json` (the FE plan + layering, from solution-arch) and, per feature, the `traces_up`
artifacts it points at: entity definitions + Data Dictionary from `design/`, API contracts from
`design/api/`, and the page rows + master shell from `mockups/` (for `has_ui` features). Reads
`scenarios.json` only to resolve each feature's `scenario_ref` and the scenario's `postconditions` (the
Scenario Trace Check asserts those are covered).

Writes **source code** into the target solution (controllers, services/handlers, repositories, EF Core
entities + `DbContext` config + migration, DTOs, views, API endpoints, DI registrations), the
**progress ledger** (`.scenarioforge/impl-progress.json` — resumable state, incl. the routing decision per
feature), a **UI Control Manifest** (`.scenarioforge/ui-controls/FE-<id>.json`) for any feature that
touches form controls, and writes each implemented feature id into the owning scenario's
`traces_down.features[]` (idempotent — solution-arch may already have planned it; this confirms it is built).

## What this worker does NOT do (boundaries)

- Never create or change scenarios, `business{}`, `analysis{}` (scenario-discovery, Phase 1).
- Never invent entities, Data Dictionary rows, or API contracts (domain-design, Phase 2). Missing design ->
  record a gap in `impl-notes.md` and stop for that feature; do not guess it into existence.
- Never design or alter screens — read `mockups/`, do not redraw them (screen-binding, Phase 2 UI).
- Never re-plan features, change layering, or renumber FE ids (solution-arch, Phase 3). Implement the plan
  as written; a plan that is wrong goes back to solution-arch, it is not silently rewritten here.
- Never author or run the formal QA suite (qa-ui-test). This worker writes the unit tests its own fence
  requires and emits the control manifest QA reads from — it does not own E2E scenario generation.
- Never touch a `locked` scenario's meaning. **Flat hierarchy:** the dispatcher spawns one implementer
  subagent per feature (and, on ENTERPRISE, one code-critic) — those subagents implement/critique and
  return; a subagent never spawns another subagent (circuit breaker).

## Scale-adaptive behavior (do only what the work needs)

Read `meta.effort_scale` from scenarios.json. Details + the circuit-breaker numbers in
`references/scale-adaptive.md`.

| Scale | Behavior |
|---|---|
| QUICK | A single small/CRUD feature, called directly. Implement just the one FE, run the pipeline, skip cross-feature dependency sweeps. Still resumable, still verified. |
| STANDARD | Default. Implement every `ready_for_impl` feature in the module in dependency order, each through the full 8-step pipeline + control manifest gate where it applies. |
| ENTERPRISE | STANDARD + the code-critic gate (`scale == ENTERPRISE AND output is code` -> a fresh sub-agent critiques each feature's diff and the loop iterates until only nitpicks remain) + stricter cross-cutting checks (auth + transaction boundary asserted per feature). |

## Model routing (who writes each feature — Opus vs Sonnet)

Full rules + thresholds + flags: `references/model-routing.md`. In short, score each feature from fields
already in `features.json` (`effort`, `type`, `depends_on`, `traces_up`):

- **HARD -> Opus, direct (Mode A):** `effort == L`, or `type` in (command/integration/batch/report), or
  `depends_on >= 2`, or `traces_up.entities >= 3`, or a security-sensitive control, or `pages >= 2`
  (cross-page flow). Opus implements the whole feature.
- **SIMPLE -> exemplar + replica (Mode B):** small CRUD/query features with shallow dependencies cluster
  into replication groups by shared `type` + similar layering. **Opus builds ONE exemplar** for the group
  (the reference pattern); **Sonnet replicates** each remaining member, receiving the exemplar's files as
  `context_refs`. The **master page / shell** is the canonical exemplar — Opus builds it + a first simple
  page, Sonnet builds the rest on it.
- Routing decides *who writes*, never *whether it is verified* — every feature (Opus or Sonnet, exemplar or
  replica) runs the full 8-step pipeline. A Sonnet replica that stays red past half its iteration cap is
  **escalated to Opus** once.

## Steps (working backward from the goal)

End goal = every targeted feature is **built, green, and traced**: it compiles, its CRUD/API behaviors
work, it has the tests its fence requires, any form controls are covered by a manifest, its scenario's
postconditions are asserted by >=1 test, and `traces_down.features` reflects what was actually built — with
a progress ledger that lets a fresh session resume mid-build without redoing finished work. Working
backward from that:

### Step 0 — Resume or start (read the ledger first)
- Glob/Read `features.json`. Absent -> stop; tell the user to run solution-arch (this worker builds a
  plan, it does not create one). No `ready_for_impl` features -> stop and report.
- Read `.scenarioforge/impl-progress.json` if it exists. **Resume** from it: features already `done` are
  skipped, a feature left `in_progress` resumes at its last completed sub-step (the ledger records which,
  and which model tier it was on). Never restart finished work. If absent, this is a fresh run -> create
  the ledger (CREATE mode).
- Read `meta.effort_scale` and the circuit-breaker caps from `references/scale-adaptive.md`.

### Step 1 — Select, order, and route the build set
- Select features with `status == ready_for_impl` (QUICK -> only the explicitly requested FE). Order by
  `depends_on` (topological; a dependency must be `done` before its dependent starts). A cycle is a
  solution-arch error -> stop and report, do not break it arbitrarily.
- **Route each feature** per `references/model-routing.md`: tag it HARD (Opus, Mode A) or SIMPLE, and group
  SIMPLE features into replication groups (one Opus exemplar + Sonnet replicas). Record `model_tier`,
  `routing_mode`, and any `exemplar_ref` in the ledger before implementing. Within a group, schedule the
  **exemplar first** so replicas can reference its files.

### Step 2 — Dispatch + implement one feature (the inner loop)
For each feature, **dispatch a fresh subagent** at its routed tier with the 4-part contract from
`model-routing.md` (objective = implement FE to done; output = source + ledger update; boundaries =
this feature only, no invented design, no re-plan, no spawning; context = features.json#FE + traces_up
artifacts + scenario postconditions, **plus the exemplar's files for a replica**). The subagent works
through the layers per `references/implementation-conventions.md` and the FE's `layering`. After each
meaningful change:
- **build** (`dotnet build`). Red -> read the error, fix, rebuild. This is the agentic loop. Each failed
  build increments the feature's iteration counter; on reaching the cap (circuit breaker) -> stop the
  feature, mark `blocked`, write the failing state + last error to the ledger and `impl-notes.md`, and move
  on or report — never spin past the cap. A Sonnet replica stuck at **half** its cap is **escalated to
  Opus** once (re-dispatch Mode A, record `escalated_to: opus`).
- Update the ledger sub-step pointer so a crash mid-feature is resumable.

### Step 3 — Emit / update the UI Control Manifest (form-control features only)
- If the feature touches form controls (input / select / combobox / radio / checkbox / data-bound), detect
  them and write/update `.scenarioforge/ui-controls/FE-<id>.json` per `references/ui-control-manifest.md`.
- Cross-validate against the page rows in `mockups/` (Hybrid B): an `error`-severity drift
  (missing-implementation, type-mismatch, **permission-wider** = security risk) BLOCKS; a `warn` drift is
  logged and the loop continues.
- Require the per-control unit fence (Layer 1): each control needs a binding test + a validation test.
  Missing -> the feature cannot pass; write the missing tests before proceeding.

### Step 4 — Run the 8-step verification pipeline
Run the gates in `references/verification-pipeline.md` for the feature. All must pass before `done`,
**regardless of which model wrote it**:
1. **Build** — compiles, no errors. 2. **Design Compliance** — entities/fields/APIs match `design/`
   (no drift from the Data Dictionary). 3. **CRUD** — create/read/update/delete paths work for the
   feature's aggregate. 4. **API Integration** — endpoints match `design/api/` contracts (verb, route,
   request/response shape). 5. **Test Coverage** — the feature's required unit tests exist and pass.
   6. **Tech Audit** — stack conventions honored (async EF, no N+1 in the hot path, DI not `new`-ed,
   nullable handled). 7. **Config** — connection strings / options / migrations registered, not hard-coded.
   8. **Scenario Trace Check** — the feature has a valid `scenario_ref`, and every `postcondition` of that
   scenario is asserted by >=1 test. Any gate red -> fix and re-run that gate (back into the loop); do not
   mark `done` on a red gate. A replica that fails Design Compliance/CRUD by drifting from the exemplar is
   corrected against the exemplar pattern.

### Step 5 — ENTERPRISE only: code-critic gate
- When `scale == ENTERPRISE`, delegate a **fresh** Opus sub-agent to critique the feature's diff (4-part
  contract: objective = find correctness/security/maintainability issues; output = a findings list;
  boundaries = critique only, do not edit, do not spawn; context = the diff + the FE plan). Iterate the
  implement loop on its findings until only nitpicks remain. Flat hierarchy: the critic spawns nothing.

### Step 6 — Mark done + write back + checkpoint
- Mark the feature `done` in the ledger and `features.json` `status`. Write the feature id into the owning
  scenario's `traces_down.features[]` (idempotent). Preserve every other scenario field byte-for-byte
  (especially `business{}`, `analysis{}`, locked scenarios).
- Checkpoint the ledger so the next feature (or the next session) resumes cleanly. Loop to the next feature
  in dependency order (exemplar before its replicas).

## Self-Check (mandatory before returning work)

- [ ] Every targeted feature is `done` (built + all 8 gates green) OR explicitly `blocked` with a reason in the ledger
- [ ] No feature was marked `done` with a red gate; no iteration cap was exceeded silently
- [ ] Each feature records its routing (`model_tier`, `routing_mode`, `exemplar_ref`); every replica references a `done` exemplar
- [ ] Hard / security-sensitive / cross-page features went to Opus; simple replicas followed an Opus exemplar (or override logged)
- [ ] Every form-control feature has a UI Control Manifest; no `error`-severity drift left unresolved (esp. permission-wider)
- [ ] Each feature's scenario postconditions are asserted by >=1 test (Scenario Trace Check passed)
- [ ] No entity / API / page was invented; every gap is recorded in `impl-notes.md`, not guessed
- [ ] features.json layering followed as planned; no FE renumbered or re-planned here
- [ ] `business{}` / `analysis{}` of every scenario unchanged; no `locked` scenario altered
- [ ] No subagent spawned another subagent (flat hierarchy held)
- [ ] The progress ledger is consistent and resumable; `traces_down.features` matches what was built
- [ ] scenarios.json + features.json still parse

## Handoff

Return a light pointer to the orchestrator (artifact pattern — do not dump files):
```
phase: 4-implementation
artifact: source committed, .scenarioforge/impl-progress.json updated, scenarios.json#traces_down.features confirmed
built: <N> features done (<crud/command/query/...> mix) | <N> blocked (see impl-notes.md)
routing: <N> Opus-direct, <N> Opus-exemplar, <N> Sonnet-replica (<N> escalated to Opus)
manifests: <N> UI control manifests emitted (.scenarioforge/ui-controls/)
gaps: <N> recorded in impl-notes.md (need domain-design/solution-arch) | none
next: delegate qa-ui-test — it reads each feature's acceptance_refs + the control manifests to derive E2E tests
```

## Analogy (.NET / DDD)

solution-arch handed you a folder of **vertical slices named but empty** — `Controller`, MediatR
`IRequest`/`Handler`, `IRepository`, DI lines, all declared, no bodies. This worker is the **tech lead who
assigns the slices and presses F5 until they're green**: the gnarly, security-touching, cross-aggregate
slices go to the senior dev (**Opus**); for a stack of near-identical CRUD admin pages the lead has the
senior build **one exemplar** cleanly, then hands the pattern to a mid-level dev (**Sonnet**) to stamp out
the rest — same structure, different entity. The **master `_Layout`** is that first exemplar everyone builds
against. The **progress ledger** is the `git`-tracked board of who's doing what and how far. The
**verification pipeline** is the PR checklist every slice passes no matter who wrote it, **Scenario Trace
Check** is the reviewer asking "does this satisfy the business postcondition it claims?", and the **circuit
breaker** is a `Polly` policy — retry, then stop and escalate rather than hammer a broken build forever.
