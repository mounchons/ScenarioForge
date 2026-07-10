---
name: solution-arch
description: >-
  Compose a domain model into buildable feature units — Phase 3 (Solutioning) of ScenarioForge.
  Reads each scenario's traces_down (entities + apis from domain-design, pages from screen-binding)
  and produces features.json: FE-xxx units with their layering (controller, service/handler, repository,
  DI registrations, DTOs), dependencies, and acceptance refs — then writes traces_down.features back to
  scenarios.json so the spine stays connected from business goal down to the unit a coder will implement.
  Use when: a domain model exists (design/ + traces_down.entities/apis populated) and is ready to be turned
  into an implementation plan, when you need a feature breakdown / vertical-slice plan / layering map before
  coding, OR when planning how controllers, services, handlers and repositories wire together for a module.
  Also triggered by "compose features", "feature breakdown", "decompose into features", "plan the
  implementation", "layering", "vertical slices", "features.json", "solution architecture", "Phase 3".
  Trigger keywords: solution-arch, feature, features.json, layering, vertical slice, solutioning,
  implementation plan, decomposition, Phase 3.
  Do NOT use for: capturing business intent or creating scenarios (scenario-discovery, Phase 1);
  modeling entities / Data Dictionary / API contracts (domain-design, Phase 2); designing screens
  (screen-binding, Phase 2 UI); writing actual code or tests (implement / qa-*, Phase 4).
allowed-tools: Read, Write, Edit, Glob, Grep
---

# solution-arch (Tier 1 — Workflow Worker)

Phase 3 (Solutioning). Read the domain model the spine already carries and compose it into **feature
units** a coder can pick up: each `FE-<module>-<name>` says *how* the existing entities + APIs + pages
assemble into a controller → service/handler → repository slice, with DI and DTOs named. Write the feature
refs back into each scenario's `traces_down.features` so one scenario id traces from business goal all the
way down to the unit that will be built.

> Full features.json shape + FE-xxx fields + registry: `references/features-schema.md`
> Layering rules for the .NET stack (Controller/Service/MediatR/Repository/DI): `references/layering-rules.md`
> How to slice entities + apis + pages into vertical features: `references/feature-decomposition.md`
> Scale-adaptive behavior (QUICK / STANDARD / ENTERPRISE): `references/scale-adaptive.md`

## The line that defines this worker

`domain-design` answers **"what"** (entities, fields, relationships, API contracts).
`solution-arch` answers **"how it assembles"** (which controller, which service/handler, which repository,
how DI wires, which vertical slice). It is the bridge between a validated domain model and the implement
loop — it plans the build without doing the build.

If a feature would need an entity, field, or API that does **not** exist in the design yet, that is a
**gap**, not a thing to invent. Record it in `features-notes.md` and stop for that feature — sending it
back upstream to domain-design is correct; guessing the missing piece is not.

## What this worker reads / writes

Reads (from `scenarios.json`, per scenario): `traces_down.entities[]`, `traces_down.apis[]`, and
`traces_down.pages[]` (present only when `business.has_ui == true`). Reads the design artifacts they point
at under `design/` (entities, data-dictionary.md, api/) and the screen registry from `mockups/` to know
which pages a feature must serve. Plans **only** from scenarios whose `traces_down.entities` is populated
(i.e. domain-design has run for them).

Writes the feature plan to `features.json` (artifact of record) and writes each new feature id into the
owning scenario's `traces_down.features[]`. Every FE carries a `scenario_ref` back to its scenario.

## What this worker does NOT do (boundaries)

- Never create or edit entities, Data Dictionary rows, or API contracts (that is domain-design). Missing
  design → record a gap and stop for that feature; do not invent it.
- Never design or alter screens (`traces_down.pages` is owned by screen-binding). Read pages; don't write them.
- Never write `business{}` or `analysis{}`, and never create scenarios (scenario-discovery, Phase 1).
- Never write code, build, or tests (implement / qa-* own Phase 4). Output is a *plan*, not source.
- Never compose a feature for a `locked` scenario in a way that changes its meaning — locked scenarios back
  shipped code; new work on them is a change/migration decision, not silent re-planning.
- Never let a worker spawn another worker (flat hierarchy — circuit breaker).

## Scale-adaptive output (do only what the work needs)

Read `meta.effort_scale` from scenarios.json. Details + examples in `references/scale-adaptive.md`.

| Scale | Behavior |
|---|---|
| QUICK | Normally skipped — a tiny/CRUD change goes straight to implement. Run only if explicitly asked, and then compose just the one FE requested (no full-module sweep). |
| STANDARD | Default. Compose every planned scenario in the module into FE units with layering + dependencies. |
| ENTERPRISE | STANDARD + dependency-graph validation (no cycles, every dep resolvable) + cross-cutting concern pass (auth, logging, transaction boundaries noted per feature). Pairs with the code-critic gate at implement. |

## Steps (working backward from the goal)

End goal = a `features.json` where every planned scenario's entities + apis + pages are accounted for by
≥1 FE unit, each FE has a concrete layering plan and a valid `scenario_ref`, dependencies form no cycle,
and `traces_down.features` is written back. Working backward:

### Step 0 — Detect mode + load the spine
- Glob/Read `scenarios.json`. If absent → stop; tell the user to run scenario-discovery, then domain-design.
- If `design/` is absent or `traces_down.entities` is empty for the target scenarios → stop; tell the user
  to run domain-design first (this worker plans from a model, it does not create one).
- Detect CREATE (no `features.json` yet) vs APPEND (it exists — new/changed scenarios to plan). In APPEND,
  Read first, never clobber: reuse existing FE ids, continue numbering, and never re-plan a `locked`
  scenario's features. Preserve every existing FE byte-for-byte.

### Step 1 — Select the planning set + read scale
- Read `meta.effort_scale`. Select scenarios whose `traces_down.entities` is populated (domain-design done).
  Skip raw drafts and un-modeled scenarios. QUICK → only the explicitly requested FE.

### Step 2 — Read the model each scenario points at
- For each selected scenario, load its `traces_down.entities/apis/pages`, then Read the artifacts they
  reference under `design/` (entity attributes from the Data Dictionary, API method/path/request/response)
  and the page rows from the screen registry. This is the raw material; do not modify it.

### Step 3 — Slice into vertical features
- Decompose by use case / acceptance criterion, not by layer: one FE is an end-to-end slice (one screen or
  endpoint's worth of behavior over its entities), not "all controllers" or "all repositories".
- Follow `references/feature-decomposition.md`: one scenario may yield several FE; an FE may span entities
  but should map to a single coherent capability. Classify each: `crud | command | query | batch |
  integration | report`.
- For a `has_ui` scenario, every page in `traces_down.pages` must be served by ≥1 FE.

### Step 4 — Plan the layering of each feature
- Per `references/layering-rules.md` and the user's stack (ASP.NET Core MVC + EF Core + DDD; the handler
  style — MediatR vs plain `IService` — follows the EXISTING project's convention, never assumed):
  name the `controller`, the `service`/`handler` (commands → handler, queries → handler or service),
  the `repository`(ies), the `di_registrations`, and the `dtos`. Names are a plan, not code.
- **Page-structure facts come from the artifact, not from memory:** when an FE's description or acceptance
  notes mention a page's structure (tab count, sections, modals), read it from the page's record/mockup
  under `mockups/` at write time — a restated-from-memory count goes stale and misleads Phase 4 (field
  case: a task said "5 tabs" over a page that had 8).
- Map each FE's API operations to the contracts already in `design/api/`; do not introduce new endpoints
  (a needed-but-missing endpoint is a gap → domain-design).
- Record `depends_on` between FE (e.g. "pay invoice" depends on "generate invoice") and `acceptance_refs`
  (the `AC-*` the feature satisfies) so qa-* can later derive tests against the right unit.

### Step 5 — Write features.json + write back traces_down + self-check
- Write `features.json` per `references/features-schema.md`; update its `rollup`.
- Write each new FE id into the owning scenario's `traces_down.features[]`. Preserve every other field of
  every scenario byte-for-byte (especially `business{}`, `analysis{}`, and locked scenarios).
- Run the **Self-Check** below; fix any failure before reporting.

## Self-Check (mandatory before returning work)

- [ ] Every planned scenario has ≥1 FE covering its entities + apis (+ every page, if has_ui)
- [ ] Every FE has a valid `scenario_ref` pointing at an existing scenario
- [ ] Every FE references only entities / APIs that already exist in `design/` — no invented design
- [ ] Every FE has a concrete layering plan (controller + service/handler + repository + DI + DTOs)
- [ ] **Run the bundled checker at every scale** — `node <plugin>/scripts/verify-features.mjs features.json
      scenarios.json` from the project root must print PASS (ids unique, `scenario_ref`s resolve,
      `depends_on` resolves + acyclic via Kahn, every traced page served by ≥1 FE, spine backrefs intact,
      `rollup.by_status` matches the actual statuses). This replaces hand-verifying those properties; a
      FAIL is fixed before returning, and the PASS line goes into the handoff
- [ ] No screen/page was designed or altered here; pages are read-only inputs
- [ ] `business{}` / `analysis{}` of every scenario unchanged; no `locked` scenario re-planned silently
- [ ] Any missing design recorded in `features-notes.md` as a gap (not invented)
- [ ] scenarios.json still parses

## Handoff

Return a light pointer to the orchestrator (artifact pattern — do not dump files):
Every `<N>` is **counted from features.json right before returning**, not recalled.
```
phase: 3-solutioning
artifact: ./features.json, scenarios.json#traces_down.features updated
produced: <N> features across <N> scenarios (<crud/command/query/...> mix)
verified: verify-features.mjs PASS (acyclic, depth <N>, pages served, rollup consistent)
gaps: <N> recorded in features-notes.md (need domain-design) | none
next: delegate implement (long-running) for ready features — it adds Scenario Trace Check (step 8);
      qa-* derives tests from each feature's acceptance_refs
```

## Analogy (.NET / DDD)

domain-design hands you the **Aggregates, Entities, Value Objects and their EF Core configuration** — the
*what*. solution-arch is the **application-layer / vertical-slice plan**: for each capability you decide the
`Controller` action, the MediatR `IRequest`/`Handler` (or `IService`), the `IRepository` it leans on, and
the `Program.cs` DI registrations — the *how it wires*. An `FE-*` is one **feature folder / vertical slice**
(request → handler → repository → response) before a single line of its body exists. `depends_on` is the
**build order** between slices; `acceptance_refs` is the link a test will later assert against. You are
writing the blueprint the implement loop will pour concrete into — naming every beam, pouring none.
