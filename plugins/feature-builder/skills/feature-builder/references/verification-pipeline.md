# 8-Step Verification Pipeline (feature-builder)

Every targeted feature passes all eight gates before its status becomes `done`. A red gate sends the
feature back into the implement loop (fix -> rebuild -> re-run that gate); it does not get marked done.
Gates run in order, but a later red gate does not erase an earlier pass — re-run only what the fix touched.

Steps 1-7 are the verification pipeline carried over from the original AgentMarketPlace long-running
worker. **Step 8 (Scenario Trace Check) is new in ScenarioForge** — it is what ties code back to the
business scenario that justifies it.

---

## Gate 1 — Build
- **Check:** `dotnet build` succeeds with no errors (warnings logged, not blocking unless `TreatWarningsAsErrors`).
- **Pass:** exit code 0.
- **Fail action:** read the compiler error, fix, rebuild. This is the core agentic loop; each failed build
  increments the feature's `iterations` (circuit-breaker counter).

## Gate 2 — Design Compliance
- **Check:** the entity, its fields/types, and relationships in code match the Data Dictionary + ER in
  `design/`. Property names + types == DD rows; FK/navigation == ER relationships; nullability matches.
  **Type compliance includes the storage type**: an enum-backed property's column type matches the enum's
  underlying type (`: short` → SMALLINT, `: byte` → TINYINT) in EF config **and** in any raw DDL script the
  feature ships (`sql-script-conventions.md` §6) — an int-widened column passes the build and crashes at
  runtime. Column widths hold the module's real seed/reference data, not just the DD's guess (a too-narrow
  width found during implementation is a DD gap, routed up — not silently widened in one place).
- **Pass:** no drift from `design/`.
- **Fail action:** if code is wrong, fix the code. If the design itself is missing/incomplete, that is a
  **gap** -> record in `impl-notes.md`, mark `blocked`, do NOT invent the field. Code must conform to
  design, never the reverse.

## Gate 3 — CRUD
- **Check:** the feature's aggregate supports the create/read/update/delete paths the feature needs (only
  the operations the FE claims — not every entity needs full CRUD). EF Core round-trips: save -> reload ->
  values intact; update persists; delete respects soft-delete/cascade rules from the design.
- **Pass:** each claimed operation works against a real (test/in-memory) context.
- **Fail action:** fix the repository/handler/mapping until the round-trip holds.

## Gate 4 — API Integration
- **Check:** each endpoint the feature exposes matches its contract in `design/api/` — HTTP verb, route
  template, request DTO shape, response DTO shape, status codes. No undocumented endpoint introduced.
- **Pass:** verb + route + request/response shape == contract.
- **Fail action:** align code to the contract. A genuinely needed-but-undocumented endpoint is a gap ->
  back to domain-design; do not silently add it to the public surface.

## Gate 5 — Test Coverage
- **Check:** the unit tests this feature's fence requires exist and pass. Minimum: the handler/service
  happy path + each validation rule + (for form-control features) the Layer-1 binding + validation tests
  named in the UI Control Manifest.
- **Pass:** required tests present AND green (`dotnet test` for the feature's tests).
- **Fail action:** write the missing tests; fix code or test until green. Missing a required test BLOCKS
  `done` (you cannot mark a feature done by skipping its fence).

## Gate 6 — Tech Audit
- **Check:** stack conventions honored —
  - EF Core calls are `async` on the hot path; no obvious N+1 (eager-load or projected where the design implies it).
  - Dependencies are injected, not `new`-ed; scoped/lifetime correct in `Program.cs`.
  - Nullable reference types handled (no unguarded null deref on a nullable DD field).
  - No secrets/connection strings hard-coded in code (see Gate 7).
  - DDD boundary respected: the repository is per aggregate root; handlers don't reach across aggregates directly.
- **Pass:** no convention violation in the feature's diff.
- **Fail action:** refactor to convention. ENTERPRISE tightens this (the code-critic gate re-checks).

## Gate 7 — Config
- **Check:** connection strings, options, feature flags, and the EF Core migration are registered through
  configuration (`appsettings` / `IOptions` / DI), not hard-coded. The migration for any new/changed entity
  exists and is applied in the test path.
- **Pass:** configuration externalized; migration present + registered.
- **Fail action:** move hard-coded values into config; add the missing migration.

## Gate 8 — Scenario Trace Check (NEW in ScenarioForge)
- **Check:** three assertions tie the code back to the spine —
  1. The feature has a **valid `scenario_ref`** resolving to an existing scenario in `scenarios.json`.
  2. **Every `postcondition`** in that scenario's `business.postconditions[]` is asserted by **>=1 test**
     (the test that proves the business outcome actually happens — e.g. postcondition "invoice = paid"
     must have a test asserting the invoice's state becomes paid).
  3. **Input-completeness for rule/engine features:** when the feature evaluates rules against a built
     context/field-map, enumerate every input the rule set consumes and verify each is either **wired**
     (derivable from the request DTO / persisted state in the context-building code) or **recorded as a
     gap** in `impl-notes.md`. An unwired input doesn't fail a test — it makes its rules evaluate
     null/NOT_APPLICABLE **silently**, so the postcondition tests can stay green while whole rule families
     never fire (field bug: document-age eligibility rules never rejected anything because
     `DocumentAgeDays` was never derived, despite the DTO carrying `DocumentDate`). The proof is a test
     that drives the full evaluate path and asserts the consumed inputs actually reach the rule engine's
     field map.
- **Pass:** ref resolves AND every postcondition maps to >=1 asserting test AND (for rule/engine features)
  every consumed input is wired-or-gapped, none silently null.
- **Fail action:** if a postcondition has no asserting test, write one (or fix the code so it can be
  asserted). If the feature has no valid `scenario_ref`, it should not have been planned — stop and report
  to solution-arch; do not fabricate a ref.
- **Why it exists:** in the old system, code traced up to features/AC but the *business reason* could drift
  silently. Step 8 makes "this code satisfies this business postcondition" a hard, tested gate — the spine
  is provable end to end, not just declared.

---

## Pipeline summary

| Gate | Asserts | Hard block on fail? |
|---|---|---|
| 1 Build | compiles | yes |
| 2 Design Compliance | matches design/ DD + ER | yes (gap -> blocked) |
| 3 CRUD | aggregate operations round-trip | yes |
| 4 API Integration | endpoints match design/api/ | yes (gap -> blocked) |
| 5 Test Coverage | required tests exist + green | yes |
| 6 Tech Audit | stack conventions honored | yes |
| 7 Config | externalized + migration present | yes |
| 8 Scenario Trace Check | scenario_ref valid + postconditions tested + engine inputs wired-or-gapped | yes |

All eight green -> feature `done`. Any red -> stays `in_progress`, loops on the fix.
