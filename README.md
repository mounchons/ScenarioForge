# ScenarioForge

A scenario-spined plugin suite for Claude Code. Built on BMAD's 4-phase pipeline
(Analysis -> Planning -> Solutioning -> Implementation) with an orchestrator + 3-tier
worker architecture, where a **business scenario is the aggregate root** that every
phase traces back to.

## Core idea: the Scenario Spine

```text
SC-<module>-<nnn> (Business Scenario)        <- Phase 1 Analysis
  +- US-xxx (User Stories)
       +- UC-xxx + AC-xxx                     <- Phase 2 Planning
            +- Entities + Pages + APIs        <- Phase 3 Solutioning
                 +- Features (code)           <- Phase 4 Implementation
                      +- TS-xxx (Test Scenarios) <- Phase 4 QA
```

Every node carries `scenario_ref="SC-..."`, so the whole chain is traceable in both
directions: open one scenario and you can see its tables, screens, code, and tests.

## Plugins

| Plugin | Phase | Tier | Status |
| --- | --- | --- | --- |
| scenario-discovery | 1. Analysis (+ beat 1.5 ideation panel, external AI personas) | 1 | available (v0.2.0) |
| domain-design | 2. Planning | 1 | available (v0.1.0) |
| screen-binding | 2. Planning / UI | 1 | available (v0.2.0) |
| solution-arch | 3. Solutioning | 1 | available (v0.1.0) |
| feature-builder | 4. Implementation | 2 | available (v0.2.0) |
| scenario-verify | 4. QA | 1+2 | available (v0.1.0) |
| orchestrator | all phases | 0 | available (v0.1.1) |

## Install

```text
/plugin marketplace add <path-or-git-url-to-this-repo>
/plugin install scenario-discovery@scenarioforge
/plugin install domain-design@scenarioforge
/plugin install screen-binding@scenarioforge
/plugin install solution-arch@scenarioforge
/plugin install feature-builder@scenarioforge
/plugin install scenario-verify@scenarioforge
/plugin install orchestrator@scenarioforge
```

Then start Phase 1 by describing your requirements and invoking scenario-discovery, and let
the orchestrator drive the rest (`/orchestrator:build <module>`).

## Docs

- **User guide (Thai, all plugins):** [`docs/user-guide.md`](docs/user-guide.md) — what each
  plugin does, how to command it, scale levels, artifacts, troubleshooting.
- Per-plugin deep dives: `plugins/<name>/USER-GUIDE.md` (scenario-discovery uses `USAGE.md`).
- Ideation-panel personas + external AI providers:
  `plugins/scenario-discovery/skills/scenario-discovery/references/persona-registry.md`.

## Design principles

1. Every SKILL.md is process-only and stays small; detailed templates/rules/examples live in `references/`.
2. Descriptions are sharp from day one (what + when + trigger keywords) so routing is reliable.
3. Fresh context per phase via delegation; workers hand off light artifact pointers, not full dumps.
