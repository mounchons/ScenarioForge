# Model Routing — Opus / Sonnet per feature (feature-builder)

This worker does not implement every feature itself at the same model tier. It acts as a **per-feature
dispatcher**: for each `FE`, it reads the feature's shape from `features.json`, decides a model tier, and
delegates the actual coding to a **fresh subagent** running that tier. The dispatcher stays flat — a
delegated executor implements its one feature and returns; it never spawns anything (circuit breaker:
no worker spawns a worker; the only sub-spawn is this dispatch and the ENTERPRISE critic).

Goal (the user's instruction): **hard / complex / cross-page work → Opus**; **simple / master / repetitive
work → Opus writes ONE exemplar, then Sonnet replicates the pattern** for the rest. This trades cost down
without losing quality where quality matters.

## Two routing modes

### Mode A — Direct (hard features)
A feature judged **hard** is implemented directly by an **Opus** subagent, start to finish, through the
full implement loop + 8-step pipeline. No exemplar step — these are the features where reasoning, security,
and cross-feature wiring matter most, so the strong model does the whole thing.

### Mode B — Exemplar-then-replicate (simple / repetitive features)
A group of **simple, structurally similar** features (e.g. a set of near-identical CRUD pages, or simple
pages built on the master shell) is handled in two phases:
1. **Opus builds the exemplar** — pick ONE representative feature from the group and have an **Opus**
   subagent implement it fully (loop + 8 gates). This becomes the **reference implementation**: the
   pattern, file structure, naming, and conventions the rest will copy.
2. **Sonnet replicates** — for every other feature in the group, a **Sonnet** subagent implements it
   *following the exemplar* (the exemplar's files are passed as `context_refs`), then runs the 8-step
   pipeline. Sonnet is copying a proven pattern, not reasoning from scratch — fast, cheap, consistent.

The **master page / shell** is the canonical Mode-B exemplar: Opus builds the master `_Layout` + a first
simple page on it as the reference, then Sonnet builds the remaining simple pages against that same shell.

## Routing decision (read from features.json — the user's chosen criterion)

For each feature, score it from fields already in `features.json` (`effort`, `type`, `depends_on`,
`traces_up`). No new judgment source — the plan already carries the signal.

A feature is **HARD → Opus direct (Mode A)** if ANY of:
- `effort == "L"`, OR
- `type` in (`command`, `integration`, `batch`, `report`) — these carry real logic / external wiring, OR
- `depends_on` has **>= 2** entries (it sits on several other features — cross-feature reasoning), OR
- `traces_up.entities` spans **>= 3** entities (touches a wide slice of the domain), OR
- the feature touches a control with `permission != null` AND a non-trivial `data_scope`
  (security-sensitive — Opus reasons about the authorization boundary), OR
- `traces_up.pages` spans **>= 2** pages (cross-page flow).

A feature is **SIMPLE → Mode B** if it is NOT hard, i.e.:
- `effort` in (`S`, `M`) AND `type` in (`crud`, `query`) AND `depends_on.length <= 1` AND
  `traces_up.entities.length <= 2` AND not security-sensitive.

When SIMPLE features cluster (same `type`, same `effort`, overlapping entity/page shape), they form a
**replication group** → one Opus exemplar + Sonnet for the rest. A lone simple feature with no group still
gets Opus for its exemplar (there is nothing to amortize), OR Sonnet directly if an existing exemplar in
the same group is already `done` and can be referenced.

> The thresholds above are the defaults. They can be tuned per project; if the user overrides per feature
> (see flags below) the override wins.

## Grouping rule (which simple features replicate together)

Two simple features are in the same replication group when they share **type** and have **structurally
similar layering** — same shape of controller + handler + repository + view, differing mainly by entity.
Typical group: "the CRUD admin pages" (Product, Category, Supplier admin) — one Opus exemplar
(e.g. Product), Sonnet does the rest. Pages that merely share the master shell but differ in behavior are
NOT one group — only structural twins replicate cleanly.

## Delegation contract (4-part — every dispatch, per the orchestrator note)

Every subagent dispatch carries the standard 4-part contract:
```
delegate(<opus|sonnet>-implementer) {
  objective:     implement FE-<id> to done (build + 8-step pipeline pass)
  output_format: source into the target solution + update the progress ledger entry for FE-<id>
  boundaries:    implement THIS feature only; never invent design (gap -> impl-notes.md, stop);
                 never re-plan/renumber; never alter locked scenarios; do NOT spawn any subagent
  context_refs:  features.json#FE-<id>, its traces_up artifacts (design/ + mockups/),
                 scenarios.json#<scenario_ref> (postconditions);
                 [Mode B replicate only] the exemplar's files as the pattern to follow
}
```

For a Mode-B replicate dispatch, `context_refs` MUST include the exemplar's actual file paths so Sonnet
copies the proven structure rather than re-deriving it.

## Tier assignment summary

| Situation | Subagent model | Why |
|---|---|---|
| Hard feature (Mode A) | **Opus** | reasoning / security / cross-feature wiring |
| Simple group — exemplar | **Opus** | build the best reference pattern once |
| Simple group — the rest | **Sonnet** | replicate a proven pattern (fast, cheap, consistent) |
| Master page / shell | **Opus** (exemplar) then **Sonnet** (pages on it) | shell is the canonical exemplar |
| ENTERPRISE code-critic | **Opus** | judgment-heavy critique (unchanged from base design) |

## Verification is model-agnostic

Routing decides **who writes the code**, not whether it is checked. **Every** feature — Opus or Sonnet,
exemplar or replica — runs the full 8-step verification pipeline (incl. Scenario Trace Check) and, for
form-control features, the UI Control Manifest gate. A Sonnet replica that drifts from the exemplar or
fails a gate goes back into the loop exactly like any other feature; if it cannot converge within the
circuit-breaker cap it is marked `blocked` and (optionally) re-dispatched to Opus.

## Escalation (a Sonnet replica that struggles)

If a Sonnet replica hits **half** its iteration cap still red, the dispatcher **escalates it to Opus**
(re-dispatch Mode A) once, then continues. Persisted in the ledger as `escalated_to: opus`. This keeps a
mis-grouped feature (looked simple, wasn't) from burning the whole cap on the cheaper model.

## Ledger fields added for routing

Each feature entry in `.scenarioforge/impl-progress.json` records the routing decision (see
`progress-ledger.md` for the full schema): `model_tier` (`opus` | `sonnet`), `routing_mode`
(`direct` | `exemplar` | `replica`), `exemplar_ref` (the FE id whose pattern a replica followed, or null),
and `escalated_to` (set if a replica was bumped to Opus).

## Flags (override the automatic routing)

| Flag | Effect |
|---|---|
| `--model opus` / `--model sonnet` | force the model tier for the targeted feature(s), bypassing the score |
| `--exemplar FE-<id>` | mark a feature as the group exemplar (Opus builds it first; others reference it) |
| `--no-replicate` | implement every feature directly at its scored tier; skip the exemplar/replica split |

All overrides are logged in the feature's ledger entry with a reason. Routing never overrides safety: a
security-sensitive feature forced to Sonnet is still allowed, but the dispatcher records a warning in
`impl-notes.md` so the choice is visible.
