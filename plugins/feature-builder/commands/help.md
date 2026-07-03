---
description: Show the feature-builder commands and how Phase 4 fits the ScenarioForge spine
allowed-tools: Read
---

# /help — feature-builder command guide

Explain this plugin to the user in Thai (per their preference), concisely. Cover:

**What this plugin is:** ScenarioForge Phase 4 (Implementation), the Tier 2 *agentic* worker
(renamed from long-running). It reads `features.json` (from solution-arch) and builds each feature into
working code, looping build -> fix until green, verified by an 8-step pipeline, resumable across sessions
via a progress ledger. It also acts as a **per-feature dispatcher**: hard / cross-page / security-sensitive
features go to an **Opus** subagent; clusters of simple, similar features get **one Opus exemplar + Sonnet
replicas** (the master shell is the canonical exemplar). Verification runs on every feature regardless of
which model wrote it.

**The commands:**
- `/feature-builder:implement [module|FE-id] [--quick|--standard|--enterprise] [--model opus|sonnet] [--no-replicate]` — start the build.
- `/feature-builder:route [module|FE-id]` — preview the Opus/Sonnet routing plan without building (cost check). Read-only.
- `/feature-builder:continue [FE-id]` — resume an interrupted build from the ledger.
- `/feature-builder:status [FE-id]` — show progress (rollup + model-tier mix, or one feature's gates). Read-only.
- `/feature-builder:verify [FE-id|--all]` — re-run the 8-step pipeline without re-implementing.
- `/feature-builder:retry <FE-id>` — re-attempt a blocked feature.
- `/feature-builder:gaps` — list recorded design gaps + their upstream owner. Read-only.
- `/feature-builder:help` — this guide.

**Where it sits in the pipeline:**
scenario-discovery (P1) -> domain-design (P2) -> screen-binding (P2 UI) -> solution-arch (P3) ->
**feature-builder (P4)** -> qa-ui-test (P4 QA).

**Key guarantees:** never invents entities/APIs/pages (records gaps), never re-plans features, Scenario
Trace Check (gate 8) proves each feature satisfies its scenario's postconditions, flat hierarchy (no
subagent spawns a subagent), circuit-breaker bounds every loop (a stuck Sonnet replica escalates to Opus once).

Keep it short and in Thai. Point to `USER-GUIDE.md` for the full walkthrough.
