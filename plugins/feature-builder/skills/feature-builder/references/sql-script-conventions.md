# Owner-Run SQL Script Conventions (DDL + seed) — feature-builder

When a project's database is owner-managed (D1-style rule: the real DB is touched only by reviewed scripts
the owner runs — no EF migrations, no direct writes), feature-builder ships **idempotent SQL files** under
the project's designated scripts path (e.g. `sql/<module>/`). Every rule below is a field-proven failure —
each one silently produced 0 rows or a runtime crash on a first real deployment. These are SQL Server
first (adapt the mechanics for PostgreSQL; the principles hold).

## 1. Idempotency is the contract
- Every DDL guarded (`IF NOT EXISTS` on tables/indexes/columns; additive `ALTER` with existence checks).
- Every seed row guarded (`NOT EXISTS` / `MERGE`). The whole set must be **re-runnable: running it 3× must
  yield identical row counts** — state that expectation in the script README and verify it once locally.
- Resolve FKs **by business key, not by hard-coded surrogate id** (`WHERE Code = '...'`), so the script
  works against the owner's real masters. A lookup that finds nothing must surface (see §3), not silently
  insert NULL or skip.

## 2. GO-batch semantics (the silent 0-rows trap)
- On SQL Server, a runtime error **aborts the remainder of its GO batch** — every statement after it in
  the batch silently never runs. Keep one logical unit per batch and put verification `PRINT`/`SELECT`
  summaries in their **own** batch.
- **Never call a subquery inside `PRINT`/`RAISERROR` argument expressions** — `PRINT
  CONCAT('inserted: ', (SELECT COUNT(*) ...))` is a runtime error on SQL Server and kills the whole batch
  (field bug: the seed "ran" and inserted 0 rows). Hop through a scalar variable first:
  `DECLARE @n INT = (SELECT COUNT(*) ...); PRINT CONCAT('inserted: ', @n);`
- Scripts with filtered indexes / computed columns need `QUOTED_IDENTIFIER ON` — run via `sqlcmd -I` and
  note that requirement in the script header/README (field bug: filtered index creation failed without it).

## 3. Verify inside the script
End each seed file with a count summary (own batch) comparing expected vs actual rows, so a partial run is
visible in the output instead of discovered weeks later. An expected-key lookup that resolves nothing
should `RAISERROR`/`THROW` (or at minimum PRINT a loud `MISSING:` line) — silence is the failure mode.

## 4. Collation (mixed-collation databases)
String comparisons/joins between a new table, `tempdb` temp tables, and legacy columns can throw
`Cannot resolve the collation conflict` when the DB default differs from column collations (field bug:
Thai_CI_AS vs SQL_Latin1 via tempdb). In seed scripts that join across those boundaries, apply
`COLLATE DATABASE_DEFAULT` on the comparison, and prefer table variables over `#temp` where practical.

## 5. Column widths are sized from the DATA, not from habit
Before declaring `VARCHAR(n)`, measure the longest real seed value **including composite/CSV values**
(field bug: `VARCHAR(20)` truncated a 23-char composite code, breaking lookups downstream). When the DD's
width proves too small during transcription, that is a **DD gap** — widen it in the DD (route to
domain-design) and the DDL together, never just locally in one script.

## 6. Types must match the code's contract
- **Enum-backed columns match the enum's UNDERLYING type**: C# `enum : short` → `SMALLINT`; `: byte` →
  `TINYINT`; default `int` → `INT`. An `INT` column against a `: short` enum compiles fine and then throws
  `InvalidCastException Int32→Int16` at **runtime on every read** (field bug across 19 tables). Check the
  enum declaration — and the project's existing convention columns (`RecStatus` etc.) — before writing any
  column type. Apply consistently across ALL tables in the module; audit with one query at the end.
- Date/time, decimal precision, and nullability come from the DD verbatim (Gate 2 applies to raw DDL too,
  not only EF-mapped entities).

## 7. File layout + handoff
- Numbered, ordered files (`00-…` masters first, FK-dependent rows later), one concern per file, plus a
  `README.md` stating: run order, `sqlcmd` flags required (`-I` etc.), idempotency expectation, and which
  masters the FK-by-name predicates assume.
- These scripts are **owner-run artifacts**: feature-builder verifies them on a local/dev database only
  (never the real one), and the handoff lists them explicitly so the orchestrator/user knows a human step
  remains before deployment.

## Analogy (.NET / DDD)
An idempotent, self-verifying seed script is a **database migration with an audit log** — the same reason
EF migrations exist. The GO-batch/PRINT trap is the SQL equivalent of an exception swallowed by a broad
`catch`: the script "succeeded" while doing nothing, and the only defense is making success loudly
measurable (counts in their own batch) rather than assumed from a clean exit.
