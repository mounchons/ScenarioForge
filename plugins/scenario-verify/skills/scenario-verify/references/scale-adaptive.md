# Scale-Adaptive Behavior + Circuit Breaker (scenario-verify)

Read `meta.effort_scale` from `scenarios.json`. Scale answers **"how much QA"**; model routing
(`model-routing.md`) answers **"who runs it"** — independent axes. A QUICK run still routes by category; an
ENTERPRISE run still sends render checks to Haiku.

## The three scales

| Scale | Generate | Run | Gates |
|---|---|---|---|
| **QUICK** | One scenario or one control's coverage, called directly. Emit `render-binding` + whichever conditional categories that one control's manifest triggers. | Run just that set. | Report the control's coverage; skip module-wide Gate 4 sweep. Still traced + resumable. |
| **STANDARD** (default) | Full 5-category set for every control in every manifest in the module. | Run all, by routed tier. | Enforce Gate 4 across the module before reporting release-ready. |
| **ENTERPRISE** | STANDARD + the **qa-critic** pre-run gate (fresh Opus subagent reviews the generated set for missing edge cases / weak assertions / untested roles; accepted findings become extra scenarios). | Run all, including the critic's additions. | STANDARD + stricter coverage: **every** permission role tested explicitly (no representative-role shortcut), a negative path for **every** validation rule, and an error-state assertion for every api-bound control. |

## Circuit-breaker caps (per scale)

A loop that can't converge must **report, not spin**. Caps bound every retry/iteration:

| Cap | QUICK | STANDARD | ENTERPRISE |
|---|---|---|---|
| retries per scenario (run loop) | 4 | 6 | 8 |
| escalate-to-Opus at (half cap) | 2 | 3 | 4 |
| scenarios per run (one invocation) | 5 | 40 | 40 |
| qa-critic iterations (ENTERPRISE) | — | — | 5 |
| max category-batch subagents in flight | 3 | 5 | 5 |

On hitting a cap: leave the scenario `failed`, write the reason + last failure to the ledger + `qa-notes.md`,
move on. Never exceed a cap silently. Caps hold **across resume** — a counter is never reset by restarting a
session (that's the whole point of the breaker).

## Flat hierarchy (hard rule)

The dispatcher spawns one subagent per category-batch (+ one Opus qa-critic on ENTERPRISE). Those subagents
generate/run/critique and **return** — a subagent never spawns another subagent. This keeps the breaker
meaningful (no uncounted nested loops) and matches the orchestrator architecture (no worker spawns a worker).

## Override flags (all logged, never silent)

| Flag | Effect | When acceptable |
|---|---|---|
| `--quick` / `--standard` / `--enterprise` | force a scale (overrides `meta.effort_scale`) | targeted run; a release push wanting ENTERPRISE rigor on a STANDARD project |
| `--force-control-coverage` | mark Gate 4 satisfied despite a gap/fail (see `coverage-gate.md`) | pre-launch + explicit sign-off |
| `--no-escalate` | disable half-cap Opus escalation (see `model-routing.md`) | strict cost ceiling |
| `--skip-deprecated` | don't re-evaluate deprecated scenarios on APPEND | speeding a delta run |

Every override is written to `qa-notes.md` + meta with timestamp + reason. Overriding a red `permission`
scenario is a security decision — call it out explicitly.

## How scale meets routing + the gate (one picture)

```
effort_scale  ->  HOW MUCH to generate/run  (this file)
category      ->  WHO runs it (Opus/Sonnet/Haiku)  (model-routing.md)
manifest      ->  WHAT categories are mandatory  (control-spec-scenarios.md)
Gate 4        ->  RELEASE fence over the result  (coverage-gate.md)
circuit breaker -> WHEN to stop a stuck loop  (this file)
```

## Analogy (.NET / DDD)

Scale is the **test plan depth** you agree before a release: a hotfix gets a smoke pass (QUICK), a normal
sprint gets the full regression (STANDARD), a regulated release gets full regression + an exploratory QA
review pass + every role/edge enumerated (ENTERPRISE). The **circuit breaker** is a `Polly`
retry-then-break policy on a flaky E2E run — retry a bounded number of times, then fail the build and
surface the reason rather than hammer a broken environment until the pipeline times out. Caps holding across
resume is the policy state being persisted, not reset every time the pipeline re-triggers.
