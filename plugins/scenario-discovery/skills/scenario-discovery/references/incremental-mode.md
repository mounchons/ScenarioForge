# Incremental / Append Mode — adding scenarios to an existing system

When a `scenarios.json` already exists, scenario-discovery runs in APPEND mode. This is the common case
once a system is already in development: the user wants to add one (or a few) new scenarios without
disturbing what has shipped. This file holds the detailed rules; SKILL.md Step 0 references it.

## Why append is different from create

At project start, scenarios are born together and nothing downstream exists yet. After development, the
file already carries scenarios whose `traces_down` point at real design/code/tests, and some are
`locked`. A careless write can:
- overwrite the whole file (losing every prior scenario),
- reuse an id (breaking every `scenario_ref` that pointed at the old one),
- silently duplicate a goal that already exists,
- change an entity another scenario depends on (drift).

APPEND mode exists to prevent all four.

## Procedure

### 1. Load and inventory
- Read the existing `scenarios.json`. Parse it. If it does not parse, STOP and report — do not overwrite
  a corrupt file with a fresh one.
- Record: `meta.module`, the set of existing ids, the current max id number, and which scenarios are
  `status: "locked"`.

### 2. Numbering
- New ids continue from the max: existing top `SC-billing-003` → next is `SC-billing-004`.
- Never reuse or renumber an existing id, even if a middle id was deleted earlier (gaps are fine).

### 3. Conflict scan (before writing anything)
For each proposed new scenario, compare against existing ones and classify:

| Finding | Signal | Action |
|---|---|---|
| Duplicate | same actor + same goal as an existing scenario | surface to user; do not add a twin. Offer to refine the existing one instead |
| Overlap / should-merge | shares most of the goal with an existing scenario | propose `suggestion.kind: "merge"` and ask the user |
| Should-split | the new request actually mixes with an existing scenario's scope | propose `suggestion.kind: "split"` and ask |
| Rule conflict | new business rule contradicts an existing scenario's pre/postconditions | record `gap.type: "conflict"`, surface to user |
| Shared entity impact | new scenario needs a change to a `domain_concept` an existing (esp. locked) scenario uses | flag as drift risk; note for system-design-doc + long-running step-8 trace check |
| Clean addition | no overlap | add normally |

The worker raises these; it does not resolve them on its own (Principle 1 + "AI may suggest, not commit").
Resolution is the user's call.

### 4. Locked scenarios are immutable here
- A `locked` scenario backs shipped code. scenario-discovery must never edit its `business`,
  `traces_down`, or `analysis`.
- If the new requirement genuinely requires changing a locked scenario, that is NOT an append — STOP and
  tell the user it needs a change/migration decision (and, once built, the orchestrator + a proper
  change flow), not a silent edit here.

### 5. Write back
- Merge new scenarios into the array; write the whole file.
- Every pre-existing scenario passes through unchanged (deep-equal what you read for the untouched ones).
- Recompute `rollup` across old + new.
- `ready_for_next_phase = false` if any new draft was added — the new ones still owe analysis + validation
  even when the existing ones already passed their gate.

## Handoff note (APPEND)

Report which ids were added and which conflicts were surfaced, e.g.:
```
phase: 1-analysis (append)
artifact: ./scenarios.json
added: SC-billing-004, SC-billing-005 (draft)
conflicts_surfaced: 1 (SC-billing-005 overlaps SC-billing-002 — merge?)
untouched: 3 existing scenarios (1 locked)
next: resolve conflicts with user; then delegate scenario-critic on the new ids only
```

## Analogy (.NET / EF)

CREATE = `EnsureCreated()` — build the whole schema fresh. APPEND = a `Migration` — add new objects
without breaking existing ones, check foreign keys that might be affected (the conflict scan), and treat
`locked` scenarios like tables holding production data: you do not `ALTER` them casually; that needs a
deliberate, reviewed migration, not an ad-hoc write.
