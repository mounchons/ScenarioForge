# 5 Mandatory Test Categories (scenario-verify)

This worker turns each control in a UI Control Manifest into concrete E2E scenarios. Every control yields a
fixed set of **mandatory categories**; which conditional categories fire is read straight from the
manifest's fields — never guessed. This is the **Layer 2** derivation: feature-builder emitted the manifest
(Layer 1 owns the build-time unit subset), this worker expands it into the release-time E2E set.

## The categories

| Category | Trigger condition (from the manifest) | Always? | What the scenario asserts |
|---|---|---|---|
| `render-binding` | every control | YES | The control renders on its page and binds the correct field (its `data-testid` exists, shows the bound value / the right options). |
| `api-binding` | `binding.source == "api"` | conditional | The control loads from its `options_endpoint`; `value_field` / `display_field` map correctly; the request fires with the right verb/route. |
| `permission` | `permission != null` | conditional (one scenario **per role**) | Each role in `visible_to_roles` sees it; a role outside the list hits `fallback_when_unauthorized` (hide/disable); `data_scope` is enforced (no cross-tenant rows). |
| `validation` | `validation` has a rule (`required`, `server_side`, pattern, range, ...) | conditional (one **per rule**, valid + invalid path) | A valid value passes; an invalid value is rejected with the rule's message; `server_side` rules are re-checked server-side, not just client. |
| `cascade-loading-error` | `depends_on != null` OR loading/error states apply | conditional | Changing the parent control reloads the dependent correctly (cascade order); the loading state shows while fetching; an error state (401/403/500/network) renders the fallback, not a crash. |

## Derivation rules (deterministic — same manifest in, same TS out)

1. Read the control's fields. Emit `render-binding` unconditionally.
2. `binding.source == "api"` -> emit `api-binding`.
3. `permission != null` -> emit one `permission` scenario **per role** in `visible_to_roles`, plus one
   **negative** scenario for an unauthorized role asserting the `fallback_when_unauthorized` behavior.
4. `validation` present -> emit one scenario **per rule**, each with a valid and an invalid path. A
   `server_side: true` rule additionally asserts the server rejects a client-bypassed value.
5. `depends_on != null` -> emit a `cascade-loading-error` scenario covering the parent->child reload in
   dependency order. Always emit at least the loading + one error-state assertion when the binding is `api`.

Estimated yield: **3-7 scenarios per control** (avg 4-5); a typical 5-control form -> ~15-35 `TS`.

## Routing per category (who generates/runs it)

Difficulty tracks the category, so routing is per-category (see `model-routing.md`):
`permission` + `cascade-loading-error` -> **Opus** · `api-binding` + `validation` -> **Sonnet** ·
`render-binding` -> **Haiku**.

## What "mandatory" means for Gate 4

A category is **mandatory for a control** if its trigger fires. Gate 4 (`coverage-gate.md`) requires every
mandatory category of every control to have a `passed` scenario before release. `render-binding` is
mandatory for *every* control; the rest are mandatory only when triggered. A control whose manifest triggers
`permission` but has no passing `permission` scenario is a **coverage gap** — release blocked.

## Boundary

This worker derives categories **only** from manifest fields that feature-builder pinned at implementation
time. If a control's intent is missing or contradictory in the manifest (e.g. `permission` is null but the
mockup implied role-gating), that is a **gap** -> record in `qa-notes.md`, route back to feature-builder /
screen-binding — do not invent the rule to test it.

## Analogy (.NET / DDD)

The manifest is the **method signature + attributes** the developer wrote (`[Required]`, `[Authorize(Roles=...)]`,
the binding source). This file is the rule for **what test cases that signature obligates**: a `[Required]`
attribute obligates a "rejects empty" test, an `[Authorize]` obligates a per-role access test, an
api-bound dropdown obligates a "loads from the endpoint" test. You are not deciding the contract — you are
enumerating the tests the already-declared contract demands, the way a coverage tool maps each branch to a
case that must exist.
