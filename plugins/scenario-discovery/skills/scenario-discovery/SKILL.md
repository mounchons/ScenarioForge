---
name: scenario-discovery
description: >-
  Turn a user's raw requirements into a traceable scenarios.json — Phase 1 (Analysis) of ScenarioForge.
  Use when: starting a new module/feature from scratch, when requirements exist as speech or documents but
  there is no formal business scenario yet, when you need to establish the scenario spine before any
  design/code/test work, OR when adding one or more new scenarios to an already-developed system that
  already has a scenarios.json. Also triggered by "discover scenarios", "start scenarios", "analyze
  requirements", "create scenarios from requirements", "add a scenario", "add a new scenario".
  Trigger keywords: scenario-discovery, discover scenario, requirement to scenario, Phase 1, business
  scenario, add scenario, append scenario, new scenario on existing system.
  Do NOT use for: editing design/code/test of scenarios that already exist (that is the job of later-phase workers).
allowed-tools: Read, Write, Edit, Glob, Grep
---

# scenario-discovery (Tier 1 — Workflow Worker)

Convert raw requirements into `scenarios.json`, the **source of truth for Phase 1** and the
spine (Scenario Spine) that every later-phase worker references back to.

> Full output shape + meaning of every field: `references/schema.md`
> Question order for gathering requirements: `references/discovery-questions.md`
> How other agents enrich the analysis layer: `references/multi-agent-analysis.md`
> Ideation-panel personas + external AI providers (beat 1.5 config): `references/persona-registry.md`
> Adding scenarios to an existing file (append safely, no overwrite): `references/incremental-mode.md`

## What this worker does / does not do

Does: capture business intent from the user → write `business{}` + identity for each scenario,
create an empty `analysis{}` shell for other agents to fill, compute `rollup`.

Does NOT (boundary — other phases own these): never write `traces_down` fields such as
use_case/api/entity/page/feature/test (that belongs to system-design-doc, solution-arch, qa-*).
Never decide whether an agent suggestion is accepted/rejected (that is the user's / orchestrator's
right). Never implement or design a solution.

## Principles (hold throughout)

1. **Business intent comes from the user only** — this worker asks, never guesses. If the user
   cannot answer a field, mark it `null` and lower `provenance.confidence`. Never fabricate.
2. **AI may suggest, not commit** — the analysis layer holds proposals (status=pending) only.
3. **scenario = Aggregate Root** — one scenario, one separable business goal. If a single chunk
   mixes several goals → split into multiple scenarios (do not cram them together).
4. **Output must be valid before finishing** — always run the self-check at the end.

## Steps (working backward from the goal)

End goal = a `scenarios.json` whose `rollup.ready_for_next_phase` can be evaluated and where every
scenario has enough `business{}` for the next phase to proceed. Working backward gives these steps:

### Step 0 — Detect mode: CREATE vs APPEND
Before anything, check whether a `scenarios.json` already exists for this target (Glob/Read).
- **No file →** CREATE mode. Proceed normally; the running id starts at 001.
- **File exists →** APPEND mode (adding scenarios to an already-developed system). Read the file first
  and follow `references/incremental-mode.md`. Key rules, summarized:
  - Never overwrite. Load existing scenarios, find the max `SC-<module>-<nnn>` and continue numbering.
  - Never edit any scenario whose `status` is `locked` (it backs shipped code — treat as immutable here).
  - Before adding, scan existing scenarios for overlap; if the new one conflicts/duplicates/should merge
    or split, surface it to the user rather than silently appending (see incremental-mode for the checks).
  - Preserve every existing scenario's `traces_down` and `analysis` untouched.
- New scenarios always enter as `status: "draft"` with empty `traces_down` — later phases fill them,
  exactly like the first scenarios did at project start (now just one at a time).

### Step 1 — Capture scope + set meta
- CREATE: ask the user the module name (`meta.module`) and effort scale (QUICK/STANDARD/ENTERPRISE)
- APPEND: reuse `meta.module` from the existing file; for one added scenario the scale is usually QUICK.
  Do not re-ask what the file already answers.
- If requirements arrive as a document/file → Read it first, record its path in `provenance.source`
- CREATE: set `meta.status = "draft"`, `generated_by = "scenario-discovery"`, current timestamp.
  APPEND: leave existing `meta` as-is; only refresh `generated_at` to mark the update.

### Step 2 — Split requirements into raw scenarios (identity)
- Read the requirements; each "goal that one actor wants to accomplish" = 1 scenario
- Assign id in the form `SC-<module>-<nnn>`. CREATE: start at 001. APPEND: continue from the existing
  max id (e.g. existing top is SC-billing-003 → new ones are SC-billing-004, 005...). Never reuse an id.
- Set a short `title` conveying the goal, `phase_origin = 1`, `status = "draft"`
- Split rule: if "and/or" joins unrelated goals → split. If it is a step of one goal → do not split.

### Step 3 — Capture business{} per scenario (the heart — Q&A)
Ask per scenario using the question set in `references/discovery-questions.md` to fill:
`actor, goal, trigger, preconditions[], postconditions[], business_value, priority, has_ui, domain_concepts[]`
- Ask **one group at a time** — do not dump every question at once (avoids user fatigue); see techniques in references
- Fields the user cannot answer / is unsure about → `null` + note it as a gap the critic should catch
- `postconditions` must be written **measurably** (e.g. invoice=paid) because qa-* derives tests from them
- `has_ui`: ask whether this scenario has a screen a human interacts with (true) or is batch/API-only (false)

### Step 4 — Create empty analysis{} shell + provenance
- Set `analysis.completeness = { score: null, gaps: [] }`, `suggestions: []`, `contributors: []`
  (leave empty for the analysis beats to fill — beat 1.5 ideation panel + beat 2 critic, see
  `references/multi-agent-analysis.md`)
- Fill `provenance`: source, confidence (high if the user confirmed clearly), `human_validated = false`

### Step 5 — Write file + compute rollup + self-check
- CREATE: Write `scenarios.json` (Write) exactly per schema.
  APPEND: merge new scenarios into the existing array and Write the whole file back. Existing scenarios
  (especially `locked` ones) and their `traces_down`/`analysis` must come through byte-for-byte unchanged.
- Compute `rollup` over the WHOLE file (old + new): total, by_status, avg_completeness (null if no critic
  yet), open_gaps_high, pending_suggestions. Set `ready_for_next_phase = false` whenever any new draft
  scenario was added (the added ones still need analysis + validation even if the old ones passed).
- Run the **Self-Check** below. If any item fails → fix before reporting.

## Self-Check (mandatory before returning work)

- [ ] Every scenario has an `id` in the form `SC-<module>-<nnn>`, unique
- [ ] Every scenario has `business.actor` + `business.goal` (these two must not be null)
- [ ] Every `postconditions` item is measurable (clear state/result, not "works correctly")
- [ ] No scenario holds multiple mixed goals (if it does → it must be split)
- [ ] `analysis{}` has the full shell (even if empty) — not a missing key
- [ ] No `traces_down` design/code/test fields were written (must be empty/absent — that is later-phase work)
- [ ] `rollup` numbers match the actual scenario count
- [ ] JSON parses (no trailing commas / leftover comments in the real file)
- [ ] APPEND only: no existing id was reused; no `locked` scenario was modified; every pre-existing
      scenario (with its `traces_down` + `analysis`) is preserved exactly; conflicts were surfaced to
      the user, not silently merged

## Handoff

When done, return a light pointer to the orchestrator (artifact pattern — do not dump the whole file):
```
phase: 1-analysis
artifact: ./scenarios.json
produced: <N> scenarios (draft)
next: delegate persona-panel (beat 1.5, per scale/registry) then scenario-critic (beat 2) to fill
      analysis{}; loop validation until ready_for_next_phase
```

The orchestrator then runs the analysis beats using the 4-part contracts — the ideation panel
(beat 1.5) and the critic (beat 2); call details + available roles are in
`references/multi-agent-analysis.md` and `references/persona-registry.md`.

## Analogy (.NET / DDD)

This worker = a **command handler `CreateScenariosCommand`** that takes user input and creates an
aggregate (`business{}` = the state the handler sets). It does not run validation rules itself —
that is left to the critic agent acting as an `IPipelineBehavior` afterward. Writing the file =
`SaveChangesAsync` persisting the aggregate to the store, and `rollup` = a projection updated at the
same time so the orchestrator can query it quickly without rehydrating the whole aggregate.
