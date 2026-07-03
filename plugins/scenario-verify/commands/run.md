---
description: Run the derived E2E scenarios through Playwright, looping run->debug->retry until green (Tier 2)
argument-hint: "[module|SC-id|TS-id|--all] [--category ...] [--model opus|sonnet|haiku] [--no-escalate]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /run — execute the QA suite (Tier 2 agentic loop)

Invoke the **scenario-verify** skill to run the generated scenarios. This is the agentic half — it loops
run -> read failure -> debug -> retry until each scenario is green or the circuit breaker caps it.

Target: `$ARGUMENTS` (a module, `SC-id`, single `TS-id`, or `--all`). `--category` restricts to one
category; `--model` forces a tier; `--no-escalate` disables the half-cap Opus escalation.

Do this:
1. Read `qa-tracker.json`. If there are no `pending`/`failed` scenarios, tell the user to run
   `/scenario-verify:generate` first (or that everything is already green).
2. If a run is already mid-flight (scenarios `running`), tell the user to use `/scenario-verify:continue`
   instead, unless they explicitly want to restart a specific `TS`.
3. Group `pending`/`failed` scenarios by routed tier and **dispatch a fresh subagent per category-batch**
   (4-part contract from `references/model-routing.md`; context = qa-tracker#TS pointers + manifest
   controls + resolved URLs from `mockups/`).
4. For each scenario the subagent runs it through Playwright. Green -> `passed`. Red -> classify: a **test**
   defect (selector/wait/fixture) is fixed and retried (the loop); a **real app** defect is filed as a
   `finding` against the owning FE and the scenario is left `failed`. **Never edit app code to pass a test.**
5. Respect the circuit-breaker caps in `references/scale-adaptive.md` — at the cap, leave `failed` with a
   reason in `qa-notes.md` and move on. A Haiku/Sonnet scenario stuck past half its cap escalates to Opus
   once (unless `--no-escalate`).
6. Update the ledger after every scenario (resumable). Recompute `coverage` + `rollup`, then enforce
   **Gate 4** (`references/coverage-gate.md`) and end with the skill's Handoff block.

Boundaries: fix the test, not the app; anchor on `data-testid`; no subagent spawns a subagent; never alter
locked scenarios or `business{}`/`analysis{}`.
