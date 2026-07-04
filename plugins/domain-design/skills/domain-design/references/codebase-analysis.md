# Codebase Analysis — reverse-engineer code into the domain model

> Child reference of `SKILL.md` (domain-design). Use when the input is an existing codebase (with or
> without scenarios.json). Goal: extract the same artifacts (entities, DD, use cases, APIs, sitemap)
> and — when a spine exists — map each back to a `scenario_ref` so the spine stays intact. With no
> spine at all, run in **bootstrap mode** (below): same artifacts, candidates instead of refs.

## Step order
1. **Scan** the project tree (Glob/list) — identify framework + stack from config files.
2. **Identify** the layers: where are models/entities, controllers/services, routes/views, config.
3. **Analyze** each layer into the matching artifact (table below).
4. **Map to scenarios** — for each extracted artifact, attach `scenario_ref`. If scenarios.json exists,
   match by entity/goal; if not → bootstrap mode: record the artifact as a candidate in
   `reverse-notes.md` (format below) and recommend scenario-discovery to backfill Phase 1.
5. **Generate** artifacts per `references/design-artifacts.md`; **Validate** against the code.

## Bootstrap mode (no scenarios.json at all)

This is the path the orchestrator delegates as its **Phase 0** on a brownfield target, and equally what
a direct "reverse-engineer this codebase" call does when no spine exists yet.
- Produce `design/` (+ registry) exactly as in a normal reverse pass — artifact shape is identical.
- Write **no** `traces_down` and **no** `scenario_ref` values (there is nothing to attach to), and never
  create `scenarios.json` — that file is scenario-discovery's to write, even here.
- For every extracted entity/route/API, add a **candidate** entry to `reverse-notes.md`:
  ```md
  ## Candidate: <inferred title>            <!-- e.g. "Pay invoice by card" -->
  status: needs_user_confirmation
  inferred_actor: <from [Authorize] roles / route prefix, or "unknown">
  inferred_goal: <one sentence from what the code does — a starting point for the question,
                  NOT confirmed business intent>
  evidence: <controller/action/entity file:line this came from>
  ```
  The inferred fields exist to make scenario-discovery's Phase 1 interview faster; they are questions
  to put to the user, never answers. Code shows a route exists — not why, or whether it's still wanted.

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
Same artifacts as a forward design (entities/DD/API/sitemap under `design/`), each carrying `scenario_ref`
when a spine exists, plus a short `reverse-notes.md` listing any code-without-scenario gaps for the
user/orchestrator to resolve. In bootstrap mode there are no refs to carry — `reverse-notes.md` instead
holds the full candidate list (format above) and is the primary handoff to scenario-discovery.
