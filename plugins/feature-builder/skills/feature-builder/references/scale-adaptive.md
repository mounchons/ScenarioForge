# Scale-Adaptive + Circuit Breaker + Overrides (feature-builder)

Read `meta.effort_scale` from `scenarios.json` at run start (mirror it into the ledger). Do only the
coordination the work needs — don't maximize sophistication.

## The three scales

### QUICK
- A single small / CRUD feature, usually called directly (bug fix, one field, one endpoint).
- Implement just the one requested FE. Skip cross-feature dependency sweeps (still respect a direct
  `depends_on` that is already `done`).
- Still resumable (ledger) and still runs the full 8-step pipeline for that one feature — QUICK reduces
  *scope*, never *verification*.

### STANDARD (default)
- Implement every `ready_for_impl` feature in the module, in `depends_on` topological order.
- Each feature: routed to its model tier -> implement loop -> UI Control Manifest (if form controls) ->
  8-step pipeline -> done.
- No code-critic gate.

### ENTERPRISE
- STANDARD plus:
  - **Code-critic gate** — trigger rule `scale == ENTERPRISE AND output is code`. After a feature's 8 gates
    pass, delegate a **fresh Opus** sub-agent to critique the diff (4-part contract: objective = find
    correctness / security / maintainability issues; output = findings list; boundaries = critique only, no
    edits, no spawning; context = the diff + FE plan). Iterate the implement loop on the findings until only
    nitpicks remain. The critic is flat — it spawns nothing.
  - **Stricter cross-cutting checks** — auth and transaction boundary explicitly asserted per feature
    (a test proving the authorize boundary, a check that the unit of work wraps the right operations).

## Model routing interacts with scale, it does not replace it

`effort_scale` (QUICK/STANDARD/ENTERPRISE) decides **how much pipeline** runs. **Model routing** (see
`references/model-routing.md`) decides **which model writes each feature** within that scale. They are
orthogonal: a STANDARD run still routes hard features to Opus and simple groups to an Opus-exemplar +
Sonnet-replicas; an ENTERPRISE run does the same and additionally puts every code feature through the Opus
critic gate.

## Circuit breaker (bounded loops — non-negotiable)

The agentic loop must never spin forever. Caps:

| Cap | QUICK | STANDARD | ENTERPRISE |
|---|---|---|---|
| Max failed-build iterations per feature | 8 | 12 | 15 |
| Replica escalation threshold (Sonnet -> Opus) | half the cap (4) | half (6) | half (7) |
| Max critic iterations per feature | n/a | n/a | 5 |
| Max features per run before checkpoint+report | 3 | 20 | 20 |

- The per-feature iteration counter (`iterations` in the ledger) **persists across resumes** — closing and
  reopening a session does not reset it. A stuck feature stays stuck on resume, as intended.
- **Replica escalation:** a Sonnet replica still red at the escalation threshold is re-dispatched **once**
  to Opus (Mode A, `escalated_to: opus`). Its iteration counter continues (not reset) — escalation buys a
  stronger model, not a fresh budget. If it still fails the full cap on Opus, mark `blocked`.
- On reaching the full cap: stop the feature, mark it `blocked`, write the last error + failing state to the
  ledger and `impl-notes.md`, and either move to the next independent feature or report. **Never** continue
  past the cap on the same feature.
- **No worker spawns a worker** (flat hierarchy). The dispatcher spawns one implementer subagent per feature
  (and one Opus critic per feature on ENTERPRISE); those subagents implement/critique and return — they
  spawn nothing themselves.
- Externalize the plan/ledger to disk before context grows large (long builds can exceed the context
  window — the ledger, not memory, is the source of truth on resume).

## Override flags (logged, never silent)

| Flag | Effect | When acceptable |
|---|---|---|
| `--skip-control-manifest` | skip manifest emit + control fence for this run | production hotfix |
| `--force-control-coverage` | satisfy the manifest gate despite a gap | pre-launch + sign-off |
| `--critic` | force the code-critic gate on a non-ENTERPRISE run | extra assurance on a risky feature |
| `--no-critic` | skip the critic on an ENTERPRISE code run | when explicitly waived |
| `--model opus` / `--model sonnet` | force the model tier for the targeted feature(s), bypassing the routing score | you know better than the heuristic for this FE |
| `--exemplar FE-<id>` | mark a feature as the group exemplar (Opus builds it first; others reference it) | steer which feature becomes the reference pattern |
| `--no-replicate` | implement every feature directly at its scored tier; skip the exemplar/replica split | small batches where replication overhead isn't worth it |
| `--force-all` | bypass all gates (extreme) | last-resort, must be justified |

Every override is recorded in the feature's ledger entry and `impl-notes.md` with a timestamp + reason.
Overriding a `permission-wider` security drift or a red Scenario Trace Check should be exceptional and
always surfaced to the user — those bypasses defeat the point of the spine. Forcing a security-sensitive
feature onto Sonnet is allowed but logged as a warning (routing normally sends those to Opus).
