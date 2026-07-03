# Model Routing — Opus / Sonnet / Haiku per category (scenario-verify)

This worker is a **per-category dispatcher**. Difficulty in QA tracks the *kind* of check, not the
scenario's size — a one-line permission test can hide a tenant-isolation leak, while a hundred render
checks are pure pattern. So routing is by **test category**, decided from fields already in the manifest +
qa-tracker — no separate scoring pass.

## The routing table

| Category | Model | Why |
|---|---|---|
| `permission` | **Opus** | Security-critical. Role x data-scope reasoning; the cost of a wrong *pass* is a data leak. Negative paths (unauthorized -> fallback) need adversarial thinking. |
| `cascade-loading-error` | **Opus** | Cross-control state: dependency order, loading races, error-state fallbacks (401/403/500/network). Easy to write a test that passes for the wrong reason. |
| `api-binding` | **Sonnet** | Endpoint + verb/route + response-shape assertions. Mid-complexity, well-patterned. |
| `validation` | **Sonnet** | Rule x boundary (valid/invalid, server-side re-check). Structured, finite per rule. |
| `render-binding` | **Haiku** | "Does it render and bind the right field?" Highest volume, lowest reasoning — pattern-based. |

## The 4-part delegation contract (every dispatch)

Spawn a **fresh** subagent per category-batch with:
- **objective** — drive *these* `TS` (this category, this batch) to green (generate-then-run, or run-only on
  resume).
- **output_format** — run results + Playwright spec artifacts + qa-tracker ledger update for each scenario.
- **boundaries** — these scenarios only; **fix the test, never the app** (a real app bug -> file a finding,
  leave the scenario failed); anchor on `data-testid` (no fuzzy selectors); do not touch other categories;
  **do not spawn another subagent** (flat hierarchy / circuit breaker).
- **context_refs** — `qa-tracker.json#TS-...` (pointers, not the whole file) + the manifest control(s) +
  resolved URLs from `mockups/` + the scenario's `postconditions`. Pointers only — artifact pattern.

## Escalation

A `render-binding` (Haiku) or `api-binding`/`validation` (Sonnet) scenario that stays **red past half** its
retry cap is **escalated to Opus once** — the failure is subtler than its tier assumed (a render failure
that's really a permission-driven hide, an api failure that's really a cascade race). Record
`escalated_to: "opus"`; do **not** reset the retry counter. Escalation is one-way and one-time; if Opus also
caps out, the scenario stays `failed` with its reason + finding.

## What routing never changes

- **Every** scenario runs through the same result ledger and the same **Gate 4** regardless of tier. A Haiku
  pass and an Opus pass are equal evidence.
- Routing decides *who writes/runs*, not *whether it counts*.
- Flat hierarchy holds: the dispatcher spawns batch subagents (+ one Opus qa-critic on ENTERPRISE); those
  return without spawning.

## Override flags

| Flag | Effect | When |
|---|---|---|
| `--model opus\|sonnet\|haiku` | force a tier for the whole run (overrides per-category routing) | debugging a routing question, or a one-off cost/quality call |
| `--category <name>` | generate/run only one category | targeted re-coverage |
| `--no-escalate` | disable the half-cap Opus escalation | strict cost ceiling (a stuck scenario just fails) |

All overrides are logged to `qa-notes.md` + meta with a reason. Forcing everything to Haiku to save cost and
thereby under-testing `permission` is a **security** smell — call it out.

## Analogy (.NET / DDD)

Routing by category is **assigning reviewers by change risk**. A migration that alters an `[Authorize]`
policy goes to the senior who owns security (**Opus**); a new DTO mapping or a `FluentValidation` rule goes
to a mid-level reviewer (**Sonnet**); a cosmetic view binding goes to whoever's free (**Haiku**). The
**4-part contract** is the PR description that tells the reviewer exactly what to check and what not to
touch. **Escalation** is "this 'trivial' change keeps failing review — pull in the senior." And the rule
that every tier passes the same Gate 4 is the org policy that a junior's approval and a senior's approval
both satisfy the *required* check — the difference is who you trust to catch the subtle miss before it gets
there.
