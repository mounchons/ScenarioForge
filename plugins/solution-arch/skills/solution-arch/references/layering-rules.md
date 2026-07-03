# Layering Rules — ASP.NET Core 8 MVC + EF Core + MediatR + DDD

> Child reference of `SKILL.md` (solution-arch). Names a feature's layers as a **plan**. No code is written.
> Target stack: ASP.NET Core 8 MVC, EF Core (PostgreSQL), Bootstrap 5 + jQuery + HTMX, DDD/domain-first.

## The layers (and what names to assign)
For each FE, fill `layering{}` with concrete type names following the stack's conventions:

| Layer | What to name | Convention |
|---|---|---|
| controller | the MVC controller + action that fronts this feature | `<Aggregate>Controller` + action verb |
| service / handler | the application-layer unit that holds the use-case logic | command/query → MediatR `<Verb><Aggregate>Handler`; simple CRUD → `I<Aggregate>Service` |
| repository | the data-access port(s) the handler leans on | `I<Aggregate>Repository` (one per aggregate root touched) |
| di_registrations | how the above wire in `Program.cs` | `Interface -> Impl (Lifetime)` — usually Scoped for EF-bound services/repos |
| dtos | request/response/view-model contracts | `<Verb><Aggregate>Request`, `<Aggregate>Dto`, `<Aggregate>ViewModel` |

Rule: name to the aggregate root, not the table. One repository per aggregate root, even if it spans
several tables/entities inside that aggregate.

## Layering defaults by feature type
The FE `type` sets the default shape. Adjust when the scenario warrants it.

- **crud** — `<Aggregate>Controller` (Index/Details/Create/Edit/Delete) + `I<Aggregate>Service` +
  `I<Aggregate>Repository`. DTOs: `<Aggregate>ViewModel`, `<Aggregate>Request`. HTMX partials count as the
  controller returning partial views; note them in the DTO/view list.
- **command** — MediatR `<Verb><Aggregate>Command` + `<Verb><Aggregate>Handler` + repository(ies). Controller
  action is thin (`_mediator.Send(...)`). DTOs: `<Verb><Aggregate>Request` -> command, result DTO out.
- **query** — MediatR `<Name>Query` + `<Name>QueryHandler` (read model / projection, often a read-only repo
  or direct `DbContext` query). DTOs: filter/request in, `<Name>Dto`/list out.
- **batch** — a hosted/scheduled job (`BackgroundService` or a scheduled runner) that invokes a command/
  handler; no controller. Note the trigger (cron/queue). These come from `has_ui == false` scenarios.
- **integration** — an adapter/client (`I<External>Client` + impl) wrapping the outbound call, invoked by a
  handler. Note the external contract it adapts. DI registers the typed client.
- **report** — a query handler + a view or export (PDF/Excel) producer. DTOs: report request + row DTO.

## Cross-cutting concerns (note per feature; required at ENTERPRISE)
Do not design these into separate features — note them as attributes of the FE so implement honours them:
- **auth** — which roles/policy guards the controller action (from the scenario's actor + roles matrix).
- **transaction boundary** — a command that mutates several aggregates notes "single UoW / SaveChanges once".
- **logging / audit** — flag features whose postconditions are audit-relevant (money, status changes).
- **validation** — where request validation lives (FluentValidation / data annotations) — name it, don't write it.

At ENTERPRISE scale, every FE must carry an explicit note for auth + transaction boundary; absence is a
self-check failure.

## What stays OUT of layering (boundaries)
- No SQL, no migration, no EF mapping decisions — column types live in the Data Dictionary (domain-design).
- No new endpoints — the API surface is fixed by `design/api/`; a needed-but-absent endpoint is a gap.
- No view markup or styling — screens belong to screen-binding; layering only references the `PG-*` it serves.
- No method bodies — names and wiring only. The implement loop writes the bodies.

## Analogy (.NET)
This is the moment you sketch a **vertical slice folder** before coding: you list
`PayInvoiceController.cs`, `PayInvoiceCommand/Handler.cs`, `IInvoiceRepository`, the `Program.cs`
`AddScoped` lines, and the `PayInvoiceRequest/ReceiptDto` — then stop. Every beam named, no concrete poured.
