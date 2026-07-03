# Features Schema — shape & how it traces back

> Child reference of `SKILL.md` (solution-arch). `features.json` is the artifact of record for Phase 3.
> Every feature carries a `scenario_ref` so the spine walks in both directions.

## Disk layout produced by this worker
```
features.json                 # the feature plan (this file)
features-notes.md             # gaps found (missing entity/api/page) — sent back to domain-design
```
`features.json` lives at the project root alongside `scenarios.json` (sibling artifacts of the spine).

## features.json shape
```jsonc
{
  "$schema": "https://scenarioforge/schemas/features.v1.json",
  "meta": {
    "module": "billing",
    "schema_version": "1.0.0",
    "generated_by": "solution-arch",          // Tier 1 worker
    "generated_at": "2026-06-14T10:00:00Z",
    "effort_scale": "STANDARD",               // QUICK | STANDARD | ENTERPRISE
    "status": "draft"                         // draft | validated | locked
  },
  "features": [
    {
      // identity
      "id": "FE-billing-pay",
      "scenario_ref": "SC-billing-001",        // REQUIRED — back to the aggregate root
      "title": "Pay monthly invoice by credit card",
      "type": "command",                       // crud | command | query | batch | integration | report

      // what this feature is built from (read from design/, never invented here)
      "traces_up": {
        "entities": ["Invoice", "Payment"],    // from domain-design (traces_down.entities)
        "apis": ["POST /api/payments"],        // from design/api/*
        "pages": ["PG-billing-checkout"]       // from screen-binding (only if has_ui)
      },

      // HOW it assembles — the heart of solution-arch (a plan, not code)
      "layering": {
        "controller": "PaymentController",
        "service": "PayInvoiceHandler",        // MediatR IRequestHandler, or IPaymentService
        "repository": ["IInvoiceRepository", "IPaymentRepository"],
        "di_registrations": [
          "IPaymentService -> PaymentService (Scoped)",
          "IInvoiceRepository -> InvoiceRepository (Scoped)"
        ],
        "dtos": ["PayInvoiceRequest", "ReceiptDto"]
      },

      // build order + verification links
      "depends_on": ["FE-billing-invoice-gen"], // other FE ids that must exist first
      "acceptance_refs": ["AC-billing-001", "AC-billing-002"], // AC this feature satisfies
      "effort": "M",                            // S | M | L (rough size, not hours)
      "status": "planned"                       // planned | ready_for_impl
    }
  ],

  // read model so the orchestrator checks the gate without scanning every feature
  "rollup": {
    "total": 1,
    "by_type": { "command": 1 },
    "by_status": { "planned": 1 },
    "open_gaps": 0,
    "ready_for_next_phase": false               // verify gate Phase 3 -> 4
  }
}
```

## Field rules
- `id` = `FE-<module>-<name>`, kebab/lower; stable once written (APPEND mode never renumbers).
- `scenario_ref` is mandatory and must resolve to a scenario in scenarios.json.
- `traces_up` lists only names that already exist in `design/` / mockups; anything missing is a gap.
- `type` drives the layering default (see `layering-rules.md`): `command`/`query` lean MediatR handler,
  `crud` leans controller+service+repo, `batch` leans a hosted/scheduled job, `integration` an adapter,
  `report` a query + view/export.
- `depends_on` must be acyclic and every id must resolve to another FE.
- `acceptance_refs` point at `AC-*` so qa-* can derive a test for the right unit.
- `status: ready_for_impl` only when no gap blocks it and all `depends_on` are themselves planned.

## features-notes.md (gap log)
When a feature needs something not in the design, do not invent it — log it and stop for that feature:
```
## Gaps blocking feature composition

- FE-billing-refund needs entity `Refund` — not in design/ (domain-design must model it).
  scenario_ref: SC-billing-004
- FE-billing-pay expects `POST /api/payments` to return ReceiptDto — design/api/billing-api.md
  defines no response body. (domain-design must complete the contract.)
```

## traces_down write-back
After writing features.json, for each FE add its id to the owning scenario's `traces_down.features[]` in
scenarios.json. Preserve all other scenario fields byte-for-byte. Example result inside a scenario:
```jsonc
"traces_down": {
  "entities": ["Invoice", "Payment"],
  "apis": ["POST /api/payments"],
  "pages": ["PG-billing-checkout"],
  "features": ["FE-billing-pay", "FE-billing-invoice-gen"]   // <- written by solution-arch
}
```
