---
name: domain-design
description: >-
  Turn validated scenarios into a domain model — Phase 2 (Planning) of ScenarioForge.
  Reads each scenario's business{} + domain_concepts and produces entities, a Data Dictionary,
  use cases, API contracts, and a sitemap, then writes traces_down (entities/use_cases/apis) back
  to scenarios.json so the spine stays connected.
  Use when: scenarios.json exists and is ready for planning, when you need a data model / ER diagram /
  Data Dictionary / API contract / sitemap derived from scenarios, when reverse-engineering an existing
  codebase into the same design artifacts, OR when assembling a full System Design Document for delivery.
  Also triggered by "design the domain", "model entities", "create data dictionary", "ER diagram",
  "API contract from scenarios", "sitemap", "system design document", "deliver docs".
  Trigger keywords: domain-design, domain model, data dictionary, ER diagram, entity design, API contract,
  sitemap, system design document, SDD, planning phase, Phase 2.
  Do NOT use for: capturing business intent / creating scenarios (that is scenario-discovery, Phase 1);
  composing features or components (solution-arch, Phase 3); writing code or tests (Phase 4 workers).
allowed-tools: Read, Write, Edit, Glob, Grep
---

# domain-design (Tier 1 — Workflow Worker)

Phase 2 (Planning). Read the scenario spine and turn each scenario's intent into a **domain model**:
entities + Data Dictionary, use cases, API contracts, and a sitemap. Write the design refs back into
each scenario's `traces_down` so one scenario id still traces from business goal down to design.

> Full design-artifact shapes + the entity/DD/API/sitemap templates: `references/design-artifacts.md`
> Mermaid patterns (ER, DFD, flow, sequence, sitemap, state): `references/mermaid-patterns.md`
> The 10-section System Design Document + cross-validation rules: `references/sdd-sections.md`
> Reverse-engineering an existing codebase into these artifacts: `references/codebase-analysis.md`

## What this worker reads / writes

Reads (from `scenarios.json`, per scenario): `business{}` (actor, goal, pre/postconditions, has_ui)
and `business.domain_concepts[]`. It plans **only** from scenarios that are validated enough for the
chosen scale — never invent business intent (that is Phase 1's job).

Writes back to each scenario's `traces_down`: `entities[]`, `use_cases[]`, `apis[]`. Screen/page design
is **not** written here — `pages[]` is owned by `screen-binding`, which consumes this worker's sitemap +
entities. Produces design files under `design/` (+ a registry) as the artifacts of record.

Also writes **`design/design-notes.md`** — the forward-mode gap/conflict log (the counterpart of
solution-arch's `features-notes.md` and feature-builder's `impl-notes.md`). Every design question this
worker cannot answer from validated `business{}` goes here instead of being invented or dropped: numbered
**GAP-nn** (something the scenarios never specified that the design needs) and **CONFLICT-nn** (two
validated statements that cannot both hold), each with what it blocks and who decides. Downstream workers
flag open GAP/CONFLICT ids on affected pages/features; when the user decides, the decision is recorded
against the id (→ a **DER-nn** decision record) in the same file — so the design's open questions and their
answers live in one auditable place. (`reverse-notes.md` remains the separate reverse/bootstrap-mode
artifact; do not merge the two.)

## What this worker does NOT do (boundaries)

- Never write `business{}` or create new scenarios (scenario-discovery owns Phase 1).
- Never write `traces_down.pages` (screen-binding) or `traces_down.features` (solution-arch / implement).
- Never decide acceptance of an `analysis.suggestion` — that is the user's / orchestrator's right.
- Never write code or tests.

## The bridge that matters most: Data Dictionary

The Data Dictionary (DD) is the single most load-bearing artifact this worker produces. screen-binding turns
DD fields into form fields, implement turns them into entity properties, and qa-* validates against them.
**A DD that does not match the scenario makes everything downstream drift.** Treat DD field names, types,
nullability, and constraints as a contract. Keep ER diagram and DD in lock-step (every entity/attribute in
one appears in the other) — this is enforced by cross-validation at ENTERPRISE scale and in `/deliver-docs`.

## Scale-adaptive output (do only what the scenario needs)

Read `meta.effort_scale` from scenarios.json and the per-scenario priority.

| Scale | Produce | Notes |
|---|---|---|
| QUICK | (skip this phase) | Tiny/CRUD change — go straight to implement. Only run if explicitly asked. |
| STANDARD | Data Dictionary + ER + API contracts + Sitemap (4) | Default working set; fast, no doc bloat. |
| ENTERPRISE | Full 10 sections + cross-validation (ER↔DD bidirectional, FK type match) | Use when delivering or when the domain is large/regulated. |

During development you intentionally produce a **subset** to stay lean. The full 10-section document is
assembled on demand via the `/deliver-docs` command (directive D1) — see Commands below.

## Steps (working backward from the goal)

End goal = a domain model where each planned scenario has valid `entities/use_cases/apis` in its
`traces_down`, a DD that matches the ER, and design files written under `design/`. Working backward:

### Step 0 — Detect mode + load the spine
- Glob/Read `scenarios.json`. If absent **and the input is not a codebase** → stop and tell the user to
  run scenario-discovery first.
- If a codebase is the input instead of (or alongside) scenarios → follow `references/codebase-analysis.md`
  to reverse-engineer entities/routes/APIs. With a spine present, map each artifact back to a
  `scenario_ref`; with **no spine at all** (bootstrap mode — e.g. delegated as the orchestrator's
  Phase 0) → still proceed: write `design/` as usual but no `traces_down` (nothing to attach to), and
  record every artifact as a candidate in `reverse-notes.md` per codebase-analysis.md's bootstrap rules.
  Never create `scenarios.json` yourself — that stays scenario-discovery's job.
- Detect CREATE (no `design/` yet) vs UPDATE (design exists — adding/changing for new scenarios). In
  UPDATE, never clobber design of `locked` scenarios; append/modify only what changed.

### Step 1 — Select the planning set + read scale
- Read `meta.effort_scale`. Pick scenarios whose status is validated enough to plan (skip raw drafts
  unless the user insists). QUICK → normally skip entirely.
- For each selected scenario, load `business{}` + `domain_concepts[]`.

### Step 2 — Model entities + Data Dictionary (the core)
- Turn `domain_concepts[]` into entities (aggregate roots, entities, value objects — domain-first).
- For every entity, write DD rows: field, type, nullable, key (PK/FK), constraint, description.
- Resolve relationships (1:1 / 1:N / N:M) and FK directions; FK types must match the referenced PK.
- Record each entity name into the scenario's `traces_down.entities[]`.

### Step 3 — Derive use cases + API contracts
- From `business.goal` + `postconditions`, derive use case(s) `UC-<module>-<nnn>`; keep postconditions
  measurable so qa-* can later turn them into tests. Record into `traces_down.use_cases[]`.
- For each use case needing a server operation, define an API contract (method, path, request, response,
  status codes). Record the endpoint into `traces_down.apis[]`.
- Endpoints are written to `design/*.md`; do not design screens here (`has_ui` scenarios get screens from
  screen-binding, which reads this sitemap + entities).

### Step 4 — Build the sitemap (navigation, not screens)
- Across all `has_ui == true` scenarios, lay out the page hierarchy / navigation as a sitemap.
- This is the input screen-binding consumes; keep page nodes named so screen-binding can attach `PG-*` + scenario_ref.

### Step 5 — Write design files + write back traces_down + self-check
- Write artifacts under `design/` (per `references/design-artifacts.md`) and update the design registry.
- Write `entities/use_cases/apis` into each scenario's `traces_down` in scenarios.json. Preserve every
  other field of every scenario byte-for-byte (especially `business{}`, `analysis{}`, and locked scenarios).
- Run the **Self-Check** below; fix any failure before reporting.

## Commands

### `/deliver-docs` — assemble the full 10-section System Design Document (directive D1)
Purpose: a deliverable handoff for a client/stakeholder who needs the complete document set, regardless of
the scale used during development. It **assembles** from existing scenario + design artifacts (it does not
re-invent them). The 10 sections: 1.Introduction & Overview 2.System Requirements 3.Module Overview
4.Data Model 5.Data Flow Diagram 6.Flow Diagrams 7.ER Diagram 8.Data Dictionary 9.Sitemap
10.User Roles & Permissions. See `references/sdd-sections.md` for each section's content + Mermaid.

Cross-validation must pass **before** assembly (hard gate):
- ER ↔ DD bidirectional (every entity/attribute in one exists in the other)
- DFD Level 0 ↔ Level 1 consistency
- Sitemap ↔ User Roles (every page reachable by ≥1 role)
- FK type matches referenced PK type
If any rule fails → report the mismatch and stop; do not emit a half-valid deliverable.

Need a `.docx` instead of Markdown (client wants a Word document, diagrams as images, headings
following their own template, per-screen behavior specs with embedded screenshots)? See
`references/word-export.md` + `assets/word-export/` — a docxtpl + mermaid-cli pipeline that
renders `design/system-design-document.md` into a Word file, with an optional `--screens
screens.json` for human-authored screen/process spec tables + screenshot images.

**Brownfield chain** (existing codebase, redevelopment spec needed): `codebase-analysis.md` reverse
mode → `/deliver-docs` → the word-export pipeline above, in that order. Reverse mode never invents
`business{}` for code it can't trace to a scenario — it flags the gap in `reverse-notes.md` for
scenario-discovery to backfill; do not skip that step to make `/deliver-docs` pass.

## Self-Check (mandatory before returning work)

- [ ] Every planned scenario has non-empty `traces_down.entities` (and `use_cases`/`apis` where applicable)
- [ ] Every entity in the ER appears in the Data Dictionary and vice-versa (no orphans)
- [ ] Every FK type matches the PK it references
- [ ] Use cases trace to a scenario `goal`; postconditions remain measurable
- [ ] No screen/page design was produced here (sitemap nodes only — pages belong to screen-binding)
- [ ] `business{}` and `analysis{}` of every scenario are unchanged; no `locked` scenario design clobbered
- [ ] scenarios.json still parses; `traces_down` refs point at artifacts that actually exist under `design/`
- [ ] Every unresolved design question is a numbered GAP/CONFLICT in `design/design-notes.md` (none silently dropped)
- [ ] **Handoff counts re-derived from the artifacts at handoff time** — count the registry's entries / the
      sitemap's actual nodes; never quote a number from memory (field drift: a handoff said 10 pages over a
      9-node sitemap, and the next worker had to pick which to trust)
- [ ] `/deliver-docs` only: all four cross-validation rules pass before assembly

## Handoff

Return a light pointer to the orchestrator (artifact pattern — do not dump files). Every `<N>` below is
**counted from the artifact right before returning**, not recalled:
```
phase: 2-planning
artifact: ./design/ (+ registry), scenarios.json#traces_down updated
produced: <N> entities, <N> use cases, <N> APIs, sitemap with <N> page nodes (<N> has_ui scenarios)
open: <N> gaps + <N> conflicts in design/design-notes.md (ids GAP-.. / CONFLICT-..) | none
next: delegate screen-binding for has_ui scenarios (consumes sitemap + entities),
      then solution-arch to compose features
```

## Analogy (.NET / DDD)

This worker is the **domain modeling pass**: `domain_concepts` → Aggregates / Entities / Value Objects,
and the Data Dictionary is your **EF Core entity configuration** (column types, nullability, keys, FK
constraints) written as a contract before any migration. Use cases map to **application-layer commands/
queries**, API contracts to **controller action signatures**. Writing `traces_down` back is like keeping
a navigation property both ways so you can traverse from the business goal down to the schema and back.
`/deliver-docs` is the **"generate full documentation" build target** — it compiles the complete spec from
the model you already have; the cross-validation gate is the compiler refusing to emit on a type mismatch.
