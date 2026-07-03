---
description: Re-run a failed or deprecated scenario after a fix (in the app or the test)
argument-hint: "<TS-id|--failed|--all>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /retest — re-run scenarios after a fix

Invoke the **scenario-verify** skill to re-run scenarios that were `failed` (or `deprecated` and now
revived), typically after feature-builder resolved a finding or the test fixture was corrected.

Target: `$ARGUMENTS` — a single `TS-id`, `--failed` (all failed in the module), or `--all`.

Do this:
1. Read `qa-tracker.json`. Select the target scenario(s). If a target is `passed`, say so and skip it
   (use `/run` to add new coverage, not `/retest` to re-prove green work).
2. For a scenario with an open `finding_ref`, check whether the finding is marked `resolved` (feature-builder
   fixed the app). If still `open`, warn that the underlying bug may persist — re-run anyway and report.
3. Re-dispatch at the scenario's recorded `model_tier` and run it. **Reset the retry counter for an explicit
   retest** (this is a deliberate new attempt after a fix, not a resume) — but still bounded by the cap.
4. Green -> `passed`, close the finding if it was the cause. Still red -> keep `failed`, update the
   `failure_reason`, keep/refile the finding.
5. Recompute `coverage` + `rollup`, re-enforce **Gate 4**, report what changed.

Boundaries: fix the test not the app; a still-failing app behavior stays a finding routed to feature-builder.
