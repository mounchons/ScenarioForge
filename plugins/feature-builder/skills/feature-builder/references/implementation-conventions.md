# Implementation Conventions (.NET stack) — feature-builder

Target stack: **ASP.NET Core 8 MVC + EF Core + PostgreSQL + Bootstrap 5 + jQuery + HTMX + DDD**, MediatR
for command/query handlers, repository per aggregate root. The FE's `layering` plan (from solution-arch)
names the pieces; this file says how to build each piece to convention. Implement the plan as written — do
not re-design it here.

Build a feature roughly in this dependency order (matches the ledger sub-steps):
`entity -> EF config -> migration -> repository -> service/handler -> DTO -> controller -> view/api -> DI`.

## 1. Entity (domain layer)
- Place under the domain/aggregate it belongs to. Properties + types come from the **Data Dictionary** in
  `design/` — names and types must match exactly (Gate 2 checks this). Do not add fields the DD doesn't
  define; a needed-but-missing field is a gap -> `impl-notes.md`, stop.
- Encapsulate invariants on the aggregate root (private setters + behavior methods) rather than exposing
  open setters, per the DDD intent of the design. Value Objects per the design stay immutable.

## 2. EF Core configuration
- Prefer `IEntityTypeConfiguration<T>` (Fluent API) over data annotations for mapping — keep the entity
  clean. Map table/column names to the DD (snake_case columns for PostgreSQL if that is the project
  convention; follow the existing `DbContext`).
- Configure relationships to match the ER diagram (FK, navigation, delete behavior). Honor the design's
  cascade / restrict / soft-delete decision — do not invent one.

## 3. Migration
- Add an EF Core migration for any new/changed entity (`dotnet ef migrations add <Name>`). The migration
  must exist and be applied in the test path (Gate 7). Name it after the feature/change, not "Migration1".
- Never edit a prior applied migration to change shipped schema — that is a new migration (mirrors the
  locked-scenario rule: shipped = immutable, change via a new migration).

## 4. Repository (per aggregate root)
- One repository interface per aggregate root (`IInvoiceRepository`), not per table. Methods reflect the
  feature's needs only (don't pre-build CRUD the FE doesn't claim).
- EF calls are `async` (`ToListAsync`, `FirstOrDefaultAsync`, `SaveChangesAsync`). Eager-load or project
  to avoid N+1 where the design implies a graph (Gate 6).

## 5. Service / handler (application layer)
- Commands -> MediatR `IRequestHandler<TCommand, TResult>`; queries -> handler or `IService` per the FE
  plan. One slice = one handler folder (vertical slice): request, handler, validator, DTOs together.
- Validation rules from the DD / AC live here (FluentValidation or guard clauses per project convention).
  Each rule needs a test (Gate 5).
- The handler orchestrates the aggregate + repository; it does not reach across aggregates directly
  (cross-aggregate work goes through the other aggregate's handler / a domain event).

## 6. DTOs
- Request/response DTOs match the API contract in `design/api/` exactly (Gate 4). Map entity <-> DTO
  explicitly (mapper or manual) — do not leak the entity over the API surface.

## 7. Controller (MVC) / API endpoint
- Thin controller: bind -> send MediatR request -> return view/result. No business logic in the controller.
- MVC action for a `has_ui` feature renders the Razor view that extends the master shell from
  `screen-binding` (`_Layout.cshtml` + theme). API endpoint matches verb/route/shape from `design/api/`.
- `[Authorize(Roles = ...)]` must match the page/control `permission.visible_to_roles` in the manifest
  (permission-wider than designed = Gate/drift block).

## 8. View (has_ui features)
- Razor view extends the existing master `_Layout.cshtml` (do not create a new shell — screen-binding owns
  it). Use Bootstrap 5 classes + the project `theme.css`. jQuery/HTMX for interactivity per the mockup.
- Every form control gets a stable `data-testid` matching the UI Control Manifest selector.
- Bind fields to the DTO; client + server validation reflect the DD rules.

## 9. DI registration (Program.cs)
- Register repositories, handlers (`AddMediatR`), validators, services with the correct lifetime
  (scoped for EF-bound work). Inject everywhere — never `new` a dependency (Gate 6).
- Register `DbContext` + connection string via configuration/`IOptions`, not hard-coded (Gate 7).

## Tests (the fence — written here, run in Gate 5)
- Handler happy-path test + one test per validation rule, minimum.
- For form-control features: the Layer-1 binding test + validation test named in the manifest.
- For each scenario postcondition: >=1 test asserting that outcome (Gate 8 — Scenario Trace Check).
- Use the project's test stack (xUnit + EF in-memory/SQLite or Testcontainers per existing convention).

## Gap handling (do not invent)
If implementing a feature requires an entity/field/API/page that the design never defined: write the gap to
`impl-notes.md` (which feature, what's missing, which upstream worker owns it — domain-design for
entity/API, screen-binding for a page, solution-arch for a layering error), mark the feature `blocked`, and
move on. Guessing the missing piece breaks the spine's traceability and is never correct.
