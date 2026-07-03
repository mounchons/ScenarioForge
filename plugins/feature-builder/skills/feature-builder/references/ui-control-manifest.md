# UI Control Manifest + Two-Layer Fence (feature-builder)

A feature that touches **form controls** (input / select / combobox / radio / checkbox / data-bound) pins
the developer's *intent* into a manifest at the moment of implementation — binding source, permission
scope, validation rules, cascade dependencies. Without it, the QA worker would have to **guess** that intent
weeks later by scanning code. The manifest is the contract QA reads from.

Emit/update it only for features that actually touch form controls. Pure batch / API-only / read-only
features skip this entirely.

## Location + id convention

`.scenarioforge/ui-controls/FE-<id>.json` (one per form-control feature, keyed to the FE id, which carries
the `scenario_ref`).

## Manifest schema (summary)

```jsonc
{
  "schema_version": "1.0.0",
  "feature_id": "FE-billing-pay",
  "scenario_ref": "SC-billing-001",
  "page_refs": ["PG-billing-checkout"],          // from traces_down.pages / mockups
  "mockup_refs": ["mockups/030-billing-checkout.html"],
  "pages": [{
    "page_id": "PG-billing-checkout",
    "url_pattern": "/billing/checkout/{id}",
    "view_path": "Views/Billing/Checkout.cshtml",
    "controls": [{
      "id": "card-select",
      "type": "combobox",
      "selector": "[data-testid='billing-card']",
      "binding": {
        "source": "api",                          // api | static | computed
        "options_endpoint": "GET /api/cards",
        "value_field": "id",
        "display_field": "masked_number"
      },
      "validation": { "required": true, "server_side": true },
      "permission": {
        "visible_to_roles": ["subscriber"],
        "data_scope": "tenant_id == user.tenant_id",
        "fallback_when_unauthorized": "hide"
      },
      "depends_on": null
    }],
    "unit_test_status": {
      "card-select": {
        "binding_test": true,
        "validation_test": true,
        "test_file": "Tests/Billing/CardSelectTests.cs"
      }
    }
  }],
  "drift_check": { "drift_findings": [], "acknowledged_findings": [] }
}
```

`data-testid` selectors are first-class — QA here is code-based (no browser-MCP guessing), so a stable
test id per control is required.

## Two-layer fence (defense in depth)

```
Layer 1 — Dev fence (build time, owned by THIS worker)
  Every control needs a binding_test (control binds the right field) +
  a validation_test (rules fire correctly). Missing -> feature cannot pass Gate 5.

Layer 2 — QA fence (release time, owned by qa-ui-test)
  Every control x mandatory category needs a passing E2E scenario in qa-tracker.
  Not this worker's job to run — but this worker MUST emit the manifest QA reads.
```

This worker owns Layer 1 (the unit fence in Gate 5) and **emits the manifest** that Layer 2 consumes.

## Drift policy (cross-validate against mockups — Hybrid B)

When emitting the manifest, compare each control against the page row in `mockups/`:

| Drift type | Severity | Block? | Reason |
|---|---|---|---|
| missing-implementation | error | YES | mockup specifies the control, code lacks it |
| type-mismatch | error | YES | mockup combobox, code plain input |
| permission-wider | error | YES | code allows more roles than designed -> SECURITY RISK |
| permission-narrower | warn | no | code stricter than designed (a restriction, not a leak) |
| binding-source-mismatch | warn | no | mockup says api, code static |
| undocumented-control | warn | no | code has a control the mockup doesn't |

Rule of thumb: **wider permission than designed = block** (leak); **narrower = warn** (safe). An
`error`-severity drift blocks the feature until resolved; a `warn` is logged in `drift_findings` and the
loop continues.

## 5 mandatory test categories (what QA will derive — emit enough for it)

The manifest must carry enough per control for qa-ui-test to derive these later:

| Category | Trigger | Always? |
|---|---|---|
| render-binding | every control | yes |
| api-binding | `binding.source == "api"` | conditional |
| permission | `permission != null` (1 test per role) | conditional |
| validation | `validation` has a rule | conditional |
| cascade-loading-error | `depends_on != null` or loading/error states | conditional |

This worker only guarantees the Layer-1 subset (render-binding + validation as unit tests). The full
5-category E2E set is qa-ui-test's job, derived from this manifest.

## Override flags (logged, never silent)

| Flag | Effect | When acceptable |
|---|---|---|
| `--skip-control-manifest` | skip manifest emit + the control fence for this run | production hotfix only |
| `--force-control-coverage` | mark manifest gate satisfied despite a gap | pre-launch + explicit sign-off |

Any override is written to the feature's ledger entry + `impl-notes.md` with a timestamp and reason.
Overriding a `permission-wider` error should be exceptional and always called out — it is a security gap.
