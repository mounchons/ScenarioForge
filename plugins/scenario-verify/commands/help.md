---
description: Show the scenario-verify commands and how Phase 4 QA fits the ScenarioForge spine
allowed-tools: Read
---

# /help — scenario-verify command guide

Explain this plugin to the user in Thai (per their preference), concisely. Cover:

**What this plugin is:** ScenarioForge Phase 4 (QA), the end-of-spine **prover** (renamed from qa-ui-test).
It reads each scenario's acceptance criteria + the UI Control Manifests that feature-builder emitted, and
derives traceable E2E test scenarios (`TS-xxx`) into `qa-tracker.json` — **Layer 2** of the two-layer fence.
**Generate** is a deterministic Tier 1 pass; **run** is a Tier 2 agentic loop (run -> debug -> retry through
Playwright until green). It's a per-category dispatcher: permission/cascade -> **Opus**, api-binding/
validation -> **Sonnet**, render-binding -> **Haiku**. It enforces **Gate 4** (control coverage): every
control x mandatory category must have a passing scenario before release. It fixes *the test*, never the app
— a real bug becomes a **finding** routed back to feature-builder.

**The 5 mandatory categories:** render-binding (always), api-binding, permission (per role), validation
(per rule), cascade-loading-error — derived from each control's manifest fields.

**The commands:**
- `/scenario-verify:generate [module|SC-id] [--quick|--standard|--enterprise] [--category ...]` — derive TS into qa-tracker.json (no run).
- `/scenario-verify:run [module|SC-id|TS-id|--all] [--category ...] [--model ...] [--no-escalate]` — run the suite (agentic loop).
- `/scenario-verify:route [module|SC-id]` — preview the Opus/Sonnet/Haiku routing + cost. Read-only.
- `/scenario-verify:continue [module|SC-id|TS-id]` — resume an interrupted run from the ledger.
- `/scenario-verify:retest <TS-id|--failed|--all>` — re-run after a fix.
- `/scenario-verify:status [module|SC-id|TS-id]` — progress rollup + Gate 4 + findings. Read-only.
- `/scenario-verify:coverage [module|SC-id] [--include-controls] [--force-control-coverage]` — Gate 4 fence. Read-only (override logged).
- `/scenario-verify:edit <TS-id> | --from-control-spec [FE-id]` — edit a TS or re-sync after a manifest change.
- `/scenario-verify:gaps` — list gaps + upstream owner. Read-only.
- `/scenario-verify:help` — this guide.

**Where it sits in the pipeline:**
scenario-discovery (P1) -> domain-design (P2) -> screen-binding (P2 UI) -> solution-arch (P3) ->
feature-builder (P4) -> **scenario-verify (P4 QA)**. It is the last worker before the orchestrator reports
the spine green.

**Key guarantees:** never invents a control/AC/permission rule (records gaps), never edits app code (files
findings), every `TS` traces back to its `SC-...`, Gate 4 blocks release on any control-coverage gap, flat
hierarchy (no subagent spawns a subagent), circuit-breaker bounds every run (a stuck Haiku/Sonnet scenario
escalates to Opus once).

Keep it short and in Thai. Point to `USER-GUIDE.md` for the full walkthrough.
