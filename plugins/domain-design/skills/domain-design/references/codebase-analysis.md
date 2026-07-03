# Codebase Analysis — reverse-engineer code into the domain model

> Child reference of `SKILL.md` (domain-design). Use when the input is an existing codebase (with or
> without scenarios.json). Goal: extract the same artifacts (entities, DD, use cases, APIs, sitemap)
> AND map each back to a `scenario_ref` so the spine stays intact.

## Step order
1. **Scan** the project tree (Glob/list) — identify framework + stack from config files.
2. **Identify** the layers: where are models/entities, controllers/services, routes/views, config.
3. **Analyze** each layer into the matching artifact (table below).
4. **Map to scenarios** — for each extracted artifact, attach `scenario_ref`. If scenarios.json exists,
   match by entity/goal; if not, note the gap and recommend scenario-discovery to backfill Phase 1.
5. **Generate** artifacts per `references/design-artifacts.md`; **Validate** against the code.

## Layer → artifact map (stack-aware)

| Source in code | Extract into |
|---|---|
| Models / Entities / `DbContext` (EF Core) | entities + Data Dictionary (types from C# props + Fluent API / data annotations) |
| Migrations / SQL schema | confirm DD types, nullability, FK, constraints (ground truth for types) |
| Controllers / Minimal APIs / `[HttpGet/Post]` | API contracts (method, route, request/response DTOs, status codes) |
| Services / handlers (MediatR commands/queries) | use cases (main flow, pre/postconditions) |
| Razor views / routes / `MapControllerRoute` | sitemap nodes + roles (from `[Authorize(Roles=...)]`) |
| `appsettings`, DI registration, `Program.cs` | architecture overview, module boundaries |

## EF Core specifics (this stack)
- `DbSet<T>` → an entity; navigation properties → relationships (cardinality from collection vs reference).
- Data annotations (`[Required]`, `[MaxLength]`, `[Key]`, `[ForeignKey]`) and Fluent API
  (`HasMaxLength`, `IsRequired`, `HasForeignKey`) → DD nullability/constraint/key columns.
- `[Authorize(Roles="...")]` on controllers/actions → Section 10 role/permission matrix + sitemap roles.

## Validation against code (must pass)
- Every DD type matches the actual C# property / column type (no guessing — read migrations/schema).
- Every API contract corresponds to a real action method/route.
- Every FK in the DD matches a real navigation property + DB constraint.
- Flag drift: code that implements behavior with **no** matching scenario → surface as a gap (a scenario
  may be missing), do not silently invent the business intent.

## Output
Same artifacts as a forward design (entities/DD/API/sitemap under `design/`), each carrying `scenario_ref`,
plus a short `reverse-notes.md` listing any code-without-scenario gaps for the user/orchestrator to resolve.
