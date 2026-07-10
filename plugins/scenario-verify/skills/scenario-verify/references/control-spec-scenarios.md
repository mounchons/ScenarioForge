# 5 Mandatory Test Categories (scenario-verify)

This worker turns each control in a UI Control Manifest into concrete E2E scenarios. Every control yields a
fixed set of **mandatory categories**; which conditional categories fire is read straight from the
manifest's fields — never guessed. This is the **Layer 2** derivation: feature-builder emitted the manifest
(Layer 1 owns the build-time unit subset), this worker expands it into the release-time E2E set.

This file decides **what** to test. **How** each scenario's Playwright body is written — probe-first, control
kinds, tabs/modals, rendering model, fixtures — is governed by `spec-authoring.md`, which is mandatory
reading before authoring any spec.

## The categories

| Category | Trigger condition (from the manifest) | Always? | What the scenario asserts |
|---|---|---|---|
| `render-binding` | every control | YES | The control is present on its page and binds the correct field. **Presence is asserted by control kind** (visible vs attached vs count-0 empty-state — `spec-authoring.md` Rule 2), and a control behind a tab/modal is activated first (Rule 3). |
| `api-binding` | `binding.source == "api"` | conditional | The control's data genuinely arrives: on a **client-fetch** page the request fires (its **real** route — probe it) and options/rows populate; on a **server-rendered** page assert the rendered result (non-placeholder options / populated rows / explicit empty-state). Mechanics per rendering model: `spec-authoring.md` Rule 1. |
| `permission` | `permission != null` | conditional (grouped **per page x role** — see "Page-level grouping" below) | Each role in `visible_to_roles` can reach the control; an unauthorized access hits the fallback the app **really implements** (auth-gated page → login redirect; element hide/disable only where actually built — `spec-authoring.md` Rule 6); `data_scope` is enforced (no cross-tenant rows). |
| `validation` | `validation` has a rule (`required`, `server_side`, pattern, range, ...) | conditional (one **per rule**, valid + invalid path) | The enforcement that actually exists is proven: JS-enforced → real invalid→valid cycle; declared-but-unenforced → attribute/contract assertion; `server_side` → the owning form posts to the server-validated action (`spec-authoring.md` Rule 4). |
| `cascade-loading-error` | `depends_on != null` OR loading/error states apply | conditional (`CASCADE` per control; `LOAD`/`ERR` grouped **per page** — see below) | Changing the parent updates the dependent (classify the cascade kind first — `spec-authoring.md` Rule 5); the page's loading state shows while fetching (client-fetch pages); an error state renders the fallback / the page stays alive, not a crash (Rule 1). |

## Derivation rules (deterministic — same manifest in, same TS out)

1. Read the control's fields. Emit `render-binding` unconditionally (one per control).
2. `binding.source == "api"` -> emit `api-binding` (one per control).
3. `permission != null` -> emit `permission` scenarios **page-grouped** (below): one positive per distinct
   role on the page + one **negative** asserting the fallback the app really implements, each carrying
   `control_refs` listing every control it covers.
4. `validation` present -> emit one scenario **per rule per control**, each with a valid and an invalid
   path. A `server_side: true` rule additionally asserts the value flows through the server-validated path.
5. `depends_on != null` -> emit a per-control `CASCADE` scenario covering the parent->child dependency.
   Emit `LOAD` + `ERR` **page-grouped** (below) for every page that has api-bound controls.

### Page-level grouping (mandatory — prevents the redundancy explosion)

Two behaviors are **page-scoped**, not control-scoped; deriving them per control re-asserts the same gate
once per control and bloats the suite with redundant scenarios (field-observed: literal per-control
derivation yielded ~1166 TS of which 410 permission tests re-proved the same page auth gate — grouping cut
the suite to 639 with **zero** coverage loss):

- **`permission`** — the auth gate lives on the page/route, not on each control. Emit one positive `TS`
  per distinct role per page + one negative per page, with `control_refs` enumerating **every** covered
  control (coverage math still counts each control as covered). Exception: a control whose
  `visible_to_roles` differs from its page's role set gets its own per-control scenario — grouping is only
  valid when the page is role-homogeneous (verify this from the manifests; do not assume).
- **`LOAD` / `ERR`** (the loading/error halves of `cascade-loading-error`) — loading and error fallbacks
  are page-level behaviors. Emit one `LOAD` + one `ERR` per page that has api-bound controls, with
  `control_refs` listing them. Per-control `CASCADE` stays per control (`depends_on` is genuinely
  control-scoped).

Gate 4 math is unchanged: a grouped scenario covers every control in its `control_refs` for that category.

Estimated yield after grouping: **2-5 scenarios per control** on control-heavy pages; a typical 5-control
form -> ~12-25 `TS`.

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
