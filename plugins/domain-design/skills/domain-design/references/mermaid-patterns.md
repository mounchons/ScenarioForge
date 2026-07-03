# Mermaid Patterns

> Child reference of `SKILL.md` (domain-design). Copy a pattern, fill it from the design artifacts.
> Keep every diagram consistent with the Data Dictionary and entity set (single source of truth).

## ER Diagram (Section 7) — must mirror the Data Dictionary
```mermaid
erDiagram
    SUBSCRIPTION ||--o{ INVOICE : has
    INVOICE ||--o{ PAYMENT : receives
    INVOICE {
        uuid InvoiceId PK
        uuid SubscriptionId FK
        string Status
        decimal AmountDue
    }
    PAYMENT {
        uuid PaymentId PK
        uuid InvoiceId FK
        string Status
    }
```
Rule: every entity/attribute shown here exists in the Data Dictionary and vice-versa.

## Data Flow Diagram — Level 0 (context) then Level 1
```mermaid
flowchart LR
    subscriber([Subscriber]) -->|payment request| P0((Billing System))
    P0 -->|receipt| subscriber
    P0 <-->|charge| gateway([Payment Gateway])
```
Level 1 decomposes P0 into numbered processes (1.0, 2.0 ...). DFD L0 ↔ L1 must stay consistent
(every external entity and data store in L0 reappears in L1).

## Flow Diagram (process / business logic)
```mermaid
flowchart TD
    A[Start: invoice due] --> B{Card on file?}
    B -- no --> C[Prompt add card] --> D
    B -- yes --> D[Charge card]
    D --> E{Charge ok?}
    E -- yes --> F[invoice=paid; send receipt]
    E -- no --> G[mark declined; notify]
```

## Sequence Diagram (use case interaction)
```mermaid
sequenceDiagram
    actor U as Subscriber
    participant API as Payments API
    participant GW as Gateway
    U->>API: POST /api/payments
    API->>GW: charge(card, amount)
    GW-->>API: succeeded
    API-->>U: 200 {status: succeeded}
```

## Sitemap (navigation tree)
```mermaid
flowchart TD
    Home --> Billing
    Billing --> Checkout[/billing/checkout/]
    Billing --> Invoices[/billing/invoices/]
```

## State Diagram (entity lifecycle — useful for enum fields)
```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> paid: charge succeeded
    draft --> void: cancelled
    paid --> [*]
```

## Class Diagram (domain model, when DDD layering matters)
```mermaid
classDiagram
    class Invoice {
        +Guid InvoiceId
        +InvoiceStatus Status
        +decimal AmountDue
        +Pay(Payment)
    }
    Invoice "1" --> "*" Payment
```

## Tips
- Prefer ER + DD as the canonical model; other diagrams must not contradict them.
- Keep node labels stable across diagrams so cross-validation (and humans) can match them.
- For `has_ui == false` scenarios, skip the sitemap node; a DFD/sequence usually communicates better.
