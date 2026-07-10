# Design Artifacts — shapes & how they trace back

> Child reference of `SKILL.md` (domain-design). All design artifacts live under `design/` and every
> one carries a `scenario_ref` so the spine can be walked in both directions.

## Disk layout produced by this worker
```
design/
├── registry.json            # index: artifact id -> file, scenario_ref, kind
├── entities/                # one file per entity OR one data-model.md (scale dependent)
│   └── <Entity>.md
├── data-dictionary.md       # the bridge artifact — all fields, all entities
├── api/
│   └── <module>-api.md      # API contracts grouped by module
└── sitemap.md               # navigation tree for has_ui scenarios
```

## Entity
Each entity records identity, attributes (mirrored in the Data Dictionary), and relationships.
```jsonc
{
  "id": "Invoice",
  "kind": "aggregate_root",        // aggregate_root | entity | value_object
  "scenario_ref": ["SC-billing-001"],
  "attributes": [
    { "name": "InvoiceId", "type": "uuid", "nullable": false, "key": "PK" },
    { "name": "SubscriptionId", "type": "uuid", "nullable": false, "key": "FK->Subscription.SubscriptionId" },
    { "name": "Status", "type": "enum(draft,paid,void)", "nullable": false },
    { "name": "AmountDue", "type": "decimal(12,2)", "nullable": false }
  ],
  "relationships": [
    { "to": "Payment", "cardinality": "1:N", "fk_on": "Payment.InvoiceId" }
  ]
}
```
Rule: every attribute here MUST appear as a Data Dictionary row, and vice-versa (ER↔DD bidirectional).

## Data Dictionary (the bridge — keep it exact)
Markdown table, one row per field across all entities. This is the contract screen-binding / implement / qa read.

| Entity | Field | Type | Null | Key | Constraint | Description | scenario_ref |
|--------|-------|------|------|-----|------------|-------------|--------------|
| Invoice | InvoiceId | uuid | N | PK | — | unique invoice id | SC-billing-001 |
| Invoice | SubscriptionId | uuid | N | FK | →Subscription | owning subscription | SC-billing-001 |
| Invoice | Status | enum(draft,paid,void) | N | — | default draft | lifecycle state | SC-billing-001 |
| Invoice | AmountDue | decimal(12,2) | N | — | ≥ 0 | amount owed | SC-billing-001 |

Hard rules:
- FK type MUST equal the referenced PK type (validated at ENTERPRISE / `/deliver-docs`).
- Type vocabulary is DB-agnostic but concrete (uuid, decimal(p,s), varchar(n), **smallint / int / bigint**,
  bool, timestamptz, enum(...)).
- **An enum field states its storage type when it is not plain int** — `enum(draft,paid,void):smallint` —
  and on a brownfield project the storage type MUST match the codebase's enum underlying type (a C#
  `enum : short` is `smallint`; field bug: a DD-agnostic "int" became an INT column against a `: short`
  enum and crashed every read at runtime). Check the existing convention columns before defaulting to int.
- `varchar(n)` widths must hold the module's known real data **including composite/CSV values** — a width
  that truncates a known seed value is a design error, not an implementation detail.
- Nullable is explicit (Y/N) — never blank.

## Use Case
```jsonc
{
  "id": "UC-billing-001",
  "scenario_ref": "SC-billing-001",
  "title": "Pay monthly invoice by credit card",
  "actor": "subscriber",
  "preconditions": ["active subscription", "card on file"],
  "main_flow": ["select invoice", "confirm card", "submit payment", "receive receipt"],
  "postconditions": ["invoice=paid", "receipt sent"]   // measurable — qa derives tests from these
}
```

## API Contract
```jsonc
{
  "id": "POST /api/payments",
  "scenario_ref": "SC-billing-001",
  "use_case_ref": "UC-billing-001",
  "request": { "invoiceId": "uuid", "paymentMethodId": "uuid" },
  "response": { "paymentId": "uuid", "status": "succeeded|declined" },
  "status_codes": { "200": "paid", "402": "declined", "404": "invoice not found" }
}
```

## Sitemap node (navigation only — not screen design)
```jsonc
{
  "path": "/billing/checkout",
  "label": "Checkout",
  "scenario_ref": ["SC-billing-001"],
  "roles": ["subscriber"],
  "children": []
}
```
screen-binding consumes these nodes and attaches `PG-*` page artifacts + the same `scenario_ref`.

## Writing back to scenarios.json (traces_down)
After producing the above, update each scenario:
```jsonc
"traces_down": {
  "entities": ["Invoice", "Payment"],
  "use_cases": ["UC-billing-001"],
  "apis": ["POST /api/payments"]
  // pages: left for screen-binding; features: left for solution-arch/implement
}
```
Preserve all other scenario fields exactly. Never touch a `locked` scenario's design.

## registry.json
```jsonc
{
  "artifacts": [
    { "id": "Invoice", "kind": "entity", "file": "design/entities/Invoice.md", "scenario_ref": ["SC-billing-001"] },
    { "id": "data-dictionary", "kind": "data_dictionary", "file": "design/data-dictionary.md", "scenario_ref": ["*"] },
    { "id": "POST /api/payments", "kind": "api", "file": "design/api/billing-api.md", "scenario_ref": ["SC-billing-001"] }
  ]
}
```
The registry lets the orchestrator and later phases resolve an artifact without scanning every file.
