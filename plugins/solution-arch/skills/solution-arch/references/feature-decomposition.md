# Feature Decomposition — how to slice entities + apis + pages into vertical features

> Child reference of `SKILL.md` (solution-arch). The judgment call: where does one FE end and the next begin.

## Slice vertically, not by layer
A feature is an **end-to-end capability** (one coherent thing an actor can do), realized across whatever
layers it needs. It is NOT "all controllers" or "the repository layer". Wrong vs right:

- ❌ FE-billing-controllers / FE-billing-repositories / FE-billing-services  (horizontal — never do this)
- ✅ FE-billing-pay / FE-billing-invoice-gen / FE-billing-view-history       (vertical — each is a capability)

## Primary slicing axis: use case / acceptance criterion
Start from the scenario's use cases (`UC-*`) and acceptance criteria (`AC-*`) that domain-design recorded.
Each distinct capability with its own AC tends to be one FE:
- "pay an invoice" → `FE-billing-pay` (AC: success path + declined path)
- "generate invoice at cycle end" → `FE-billing-invoice-gen` (a batch FE; has_ui == false)
- "view payment history" → `FE-billing-view-history` (a query FE)

One scenario commonly yields **several** FE. A single FE may touch **several entities** (pay touches Invoice
+ Payment + Receipt) but should still be one capability — if you can't name it as one verb-phrase, split it.

## Map every input to ≥1 feature
After slicing, check coverage — this is what the self-check enforces:
- every entity in `traces_down.entities` is owned/used by ≥1 FE,
- every API in `traces_down.apis` is invoked by exactly the FE that needs it,
- every page in `traces_down.pages` (has_ui) is served by ≥1 FE.
A page or API with no FE = a hole in the plan. An entity with no FE may be fine (pure value object inside an
aggregate) — note it, don't force a feature.

## Dependencies (build order)
Set `depends_on` when a feature genuinely needs another's output to exist:
- `FE-billing-pay` depends_on `FE-billing-invoice-gen` (can't pay what isn't generated).
Keep it acyclic. If two features seem mutually dependent, they're probably one feature, or the boundary is
wrong — re-slice. At ENTERPRISE, the dependency graph is validated explicitly (no cycle, all ids resolve).

## CRUD scenarios — don't over-slice
A plain master-data CRUD screen is usually **one** `crud` FE (Index/Details/Create/Edit/Delete together),
not five features. Split only when an operation carries real extra logic (e.g. "approve" is a command FE
distinct from "edit").

## has_ui vs batch
- `has_ui == true` → the FE(s) serve `PG-*` pages; layering names a controller + view/partials.
- `has_ui == false` → batch/integration/query-only; no controller, a job or adapter instead. Don't invent a
  screen for a background scenario.

## When something's missing → gap, not invention
If slicing reveals a capability that needs an entity/field/endpoint the design doesn't have:
1. do NOT add it to the model (that's domain-design's job),
2. record it in `features-notes.md` with the scenario_ref,
3. leave that FE unplanned (or mark blocked), continue with the rest.
Returning a clean partial plan + a precise gap list is a success. A plan built on guessed design is not.

## Sizing (effort S/M/L)
Rough, for orchestrator routing — not hours:
- S — one entity, simple CRUD or single query.
- M — a command touching 2–3 entities, one transaction, a couple of AC.
- L — multi-aggregate command, integration, or a feature with several edge-case AC. Consider whether an L
  should split into two M features along its AC.
