---
description: Resume an interrupted build from the progress ledger
argument-hint: "[FE-id (optional, to resume a specific feature)]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /continue — resume the Phase 4 build

Invoke the **feature-builder** skill in **resume** mode.

Do this:
1. Read `.scenarioforge/impl-progress.json`. If it's missing, there's nothing to resume — tell the user to
   start with `/feature-builder:implement`.
2. Skip every feature already `done`. For each `in_progress` feature (or the one named in `$ARGUMENTS`):
   re-open its `files_touched`, **re-dispatch a subagent at its recorded `model_tier`** (a replica also
   gets its exemplar's files), jump to the sub-step after `last_substep`, rebuild once to confirm the
   resumed state compiles, then continue the implement loop -> manifest -> 8-step pipeline.
3. Do NOT reset the per-feature `iterations` counter — the circuit-breaker count persists across resumes.
4. Do NOT auto-retry features marked `blocked` (use `/feature-builder:retry` for those). Never start a
   replica whose exemplar is not yet `done`.
5. Continue through remaining `ready_for_impl` features in `depends_on` order. End with the Handoff block.

Respect all skill boundaries and circuit-breaker caps.
