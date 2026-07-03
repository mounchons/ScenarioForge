# qa-tracker.json — Schema, Lifecycle, Resume (scenario-verify)

`qa-tracker.json` is the **source of truth for Phase 4 QA** — the derived `TS-xxx` scenarios, their routing,
and their run results. It is the end-of-spine artifact: every `TS` carries a `scenario_ref` back to the
`SC-...` it proves, so "is SC-billing-001 green?" is answerable by reading this file. Location:
`.scenarioforge/qa-tracker.json` (alongside the impl ledger feature-builder wrote).

## Schema (summary)

```jsonc
{
  "$schema": "https://scenarioforge/schemas/qa-tracker.v1.json",
  "meta": {
    "module": "billing",
    "schema_version": "1.0.0",
    "generated_by": "scenario-verify",
    "generated_at": "2026-06-14T10:00:00Z",
    "effort_scale": "STANDARD",
    "status": "running"                         // draft | generating | running | complete | blocked
  },
  "scenarios": [
    {
      "id": "TS-billing-checkout-PERM-manager-001",
      "scenario_ref": "SC-billing-001",          // trace UP to the business scenario
      "control_refs": ["card-select"],           // control(s) this proves (from the manifest)
      "category": "permission",                  // render-binding|api-binding|permission|validation|cascade-loading-error
      "category_detail": "role=manager",         // role for permission, rule for validation, etc.
      "manifest_path": ".scenarioforge/ui-controls/FE-billing-pay.json",
      "manifest_emitted_at": "2026-06-14T09:00:00Z",   // staleness check for APPEND
      "page_ref": "PG-billing-checkout",
      "url_pattern": "/billing/checkout/{id}",
      "selectors": ["[data-testid='billing-card']"],   // code-based, no fuzzy text
      "spec_path": "Tests/E2E/billing/card-select.perm.manager.spec.ts",
      "model_tier": "opus",                      // routed by category
      "status": "passed",                        // pending|running|passed|failed|deprecated
      "result": {
        "last_run_at": "2026-06-14T10:05:00Z",
        "retries": 0,
        "escalated_to": null,                    // set to "opus" if a lower tier was escalated
        "failure_reason": null,                  // captured on red
        "finding_ref": null                      // FND-xxx if a real app bug was filed back to feature-builder
      }
    }
  ],
  "findings": [                                  // real app defects (NOT test defects) routed upstream
    {
      "id": "FND-billing-001",
      "ts_ref": "TS-billing-checkout-VAL-required-001",
      "fe_ref": "FE-billing-pay",
      "severity": "high",                        // high|medium|low
      "detail": "server accepts empty card_id despite [Required]; client-only validation",
      "status": "open"                           // open|routed|resolved|wont_fix
    }
  ],
  "coverage": {                                  // Gate 4 read model
    "by_control": {
      "card-select": {
        "mandatory_categories": ["render-binding","api-binding","permission","validation"],
        "covered": ["render-binding","api-binding","permission"],
        "passed":  ["render-binding","api-binding","permission"],
        "gap_categories": ["validation"],        // mandatory but no scenario -> Gate 4 block
        "fail_categories": []                    // scenario exists but red -> Gate 4 block
      }
    },
    "gap_control_ids": ["card-select"],          // any control with a gap_categories entry
    "fail_control_ids": [],
    "gate_4": "BLOCKED"                           // PASS only when both id lists are empty
  },
  "rollup": {
    "total": 22,
    "by_status": { "passed": 18, "failed": 1, "pending": 3 },
    "by_category": { "render-binding": 5, "api-binding": 4, "permission": 8, "validation": 3, "cascade-loading-error": 2 },
    "by_tier": { "opus": 10, "sonnet": 7, "haiku": 5 },
    "release_ready": false                        // = gate_4 == PASS AND no pending/failed
  }
}
```

## Scenario status lifecycle

```
pending ──run──> running ──green──> passed
                    │
                    └──red──> failed ──(test fix + retry)──> running ...
                                  │
                                  └──(real app bug)──> failed + finding filed (FND-xxx)
deprecated  <── control removed / manifest no longer triggers this category
```

- `passed` is terminal unless its manifest changes (APPEND may re-open it).
- `failed` from a **test** defect re-enters the loop (fix selector/wait/fixture, retry). `failed` from a
  **real app** defect stays failed and gets a `finding_ref`; the fix belongs to feature-builder.
- `deprecated` when the underlying control or its triggering field is gone — never delete history, mark it.

## CREATE vs APPEND (incremental)

- **CREATE** — no `qa-tracker.json` -> generate the full set from current manifests, ids from `001`.
- **APPEND** — file exists (build evolved, manifests changed). Rules:
  - Read first; find max index per `TS` prefix; continue numbering. Never reuse / renumber an existing id.
  - A `passed` scenario whose control's manifest is **unchanged** (`manifest_emitted_at` matches) is
    preserved byte-for-byte — do not re-run it.
  - A control whose manifest changed since `manifest_emitted_at` -> regenerate only that control's affected
    categories; mark superseded scenarios `deprecated`, mint new ones for the delta.
  - A control removed from the manifest -> mark its scenarios `deprecated` (keep for history).
  - Recompute `coverage` + `rollup` across the whole file. `release_ready=false` while any new `pending`
    exists, even if the old set was green.

## Resume (Tier 2 run loop)

A `running`/`failed` scenario resumes at its recorded state: same `category`, `control_refs`, `model_tier`,
`retries`. Skip every `passed`. Re-dispatch the batch at its recorded tier. Never restart a passed scenario;
never reset a retry counter on resume (the circuit-breaker cap must hold across sessions).

## Analogy (.NET / DDD)

`qa-tracker.json` is the **test-result store + traceability matrix** combined: each `scenario` is a test
case row that points up to the `SC-...` requirement it covers (the matrix) and holds its latest run verdict
(the result store). `findings[]` are **bug tickets** filed against the dev's code — separate from a flaky
test you just fix. `coverage` is the **required-checks projection** the release gate queries, the way a CI
dashboard shows "3 required checks, 1 missing" without re-running the suite. APPEND is a **migration** again:
add rows for new controls, mark removed ones obsolete, never rewrite the history of a shipped, green check.
