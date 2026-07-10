# Implementation Conventions (.NET stack) — feature-builder

Target stack baseline: **ASP.NET Core MVC + EF Core + Bootstrap 5 + jQuery + HTMX + DDD**, repository per
aggregate root. **The database provider (SQL Server / PostgreSQL), column-naming convention, and
handler style (MediatR vs plain `IService`) are read from the EXISTING project** — the `DbContext`, csproj
packages, and the FE's `layering` plan from solution-arch — never assumed from this file. A brownfield
project's conventions always win over any default named here. The FE's `layering` plan names the pieces;
this file says how to build each piece to convention. Implement the plan as written — do not re-design it
here.

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
  clean. Map table/column names to the DD **in the existing project's convention** (snake_case on a
  PostgreSQL project, PascalCase on SQL Server — follow the existing `DbContext`, never this file's default).
- **Enum-backed columns must match the enum's UNDERLYING type** — a C# `enum : short` maps to `SMALLINT`,
  not `INT` (field failure: an `INT` column against a `: short` enum threw `InvalidCastException
  Int32→Int16` on every list endpoint). Check the enum declaration before writing the column type, in both
  EF config and any raw DDL (see `sql-script-conventions.md`).
- Configure relationships to match the ER diagram (FK, navigation, delete behavior). Honor the design's
  cascade / restrict / soft-delete decision — do not invent one.

## 3. Migration / owner-run SQL scripts
- Add an EF Core migration for any new/changed entity (`dotnet ef migrations add <Name>`). The migration
  must exist and be applied in the test path (Gate 7). Name it after the feature/change, not "Migration1".
- Never edit a prior applied migration to change shipped schema — that is a new migration (mirrors the
  locked-scenario rule: shipped = immutable, change via a new migration).
- **When the project's DB is owner-managed** (no EF migrations allowed against the real DB; schema/seed
  ships as reviewed SQL scripts the owner runs), author those scripts per
  **`references/sql-script-conventions.md`** — idempotency, GO-batch traps, collation, width sizing, and
  enum-underlying-type rules are all field-proven failure modes, not style preferences.

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
- **JSON casing across the MVC↔API seam (field-proven silent killer):** ASP.NET Core defaults differ —
  minimal/Web API `JsonSerializerOptions` default to camelCase, but MVC `Json()` results and hand-rolled
  `JsonSerializer.Serialize` calls default to PascalCase. Inline JS in a Razor view reading `d.vehicleGroup`
  against a PascalCase payload fails **silently** (undefined, no error, the feature just never populates).
  Rule: pick ONE casing for every endpoint the views consume (prefer configuring camelCase globally to
  match JS idiom), verify it by probing one real response, and when consuming an endpoint you don't own,
  read defensively (`d.field ?? d.Field` dual-read) — never assume the casing from the C# property name.

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

## Bulk transcription pass (the sanctioned path between "invent" and "block")
Some gaps are not missing *design* but missing *mechanical transfer*: a large body of data/config exists in
an authoritative reference (a legacy rules file, a spreadsheet of rates, a config export) and must be
carried into seed/entities verbatim. Refusing to invent is right; but when the user designates a reference
as authoritative, run a **transcription pass** instead of leaving the gap open:
- **Source-locked:** every transcribed row cites its origin (file + line/row). Nothing is added that the
  reference doesn't contain; ambiguous rows are surfaced, not resolved silently.
- **Parity-verified:** transcription is proven by a check against the source — golden/known-answer cases
  first, then as wide a sweep as the surface allows (field-proven pattern: a parity harness replaying
  reference cases against the built engine, target = zero divergences).
- **Scoped:** the pass is its own delegation/step with its own ledger entry — not smuggled into an
  unrelated feature's loop.
Without a designated authoritative source, it stays a gap for the owner — transcription needs a source, not
a guess.
