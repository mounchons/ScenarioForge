---
description: Preview the per-category model routing (Opus/Sonnet/Haiku) for a set before generating or running
argument-hint: "[module|SC-id]"
allowed-tools: Read, Glob, Grep
---

# /route — preview the QA routing plan (read-only)

Invoke the **scenario-verify** skill in a read-only planning mode to show how scenarios would be routed
across models — a cost/coverage check before `/generate` or `/run`.

Target: `$ARGUMENTS` (a module, `SC-id`, or empty = current module).

Do this:
1. Read the UI Control Manifests (or `.scenarioforge/qa-tracker.json` if scenarios already exist).
2. For each control, list the mandatory categories it triggers (`references/control-spec-scenarios.md`).
3. Map each category to its model tier per `references/model-routing.md` (permission/cascade -> Opus;
   api-binding/validation -> Sonnet; render-binding -> Haiku) and show the projected counts:
   `N Opus, N Sonnet, N Haiku`, plus the estimated scenario total (3-7 per control).
4. Flag anything notable: controls that route heavily to Opus (security-dense), controls missing a
   `data-testid` (would gap at generation), manifests stale vs the current build.
5. Change nothing — this is preview only. Point the user to `/scenario-verify:generate` to materialize.

Keep it concise. Do not generate or run; do not write to .scenarioforge/qa-tracker.json.
