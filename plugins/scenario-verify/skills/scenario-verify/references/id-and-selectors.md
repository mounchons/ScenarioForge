# TS ID Convention + data-testid Selector Contract (scenario-verify)

## TS id format

```
TS-<MODULE>-<PAGE>-<CATEGORY>-<INDEX>
TS-<MODULE>-<PAGE>-<CATEGORY>-<role-or-rule>-<INDEX>
```

- `MODULE` — the scenario's module (e.g. `billing`), lowercased.
- `PAGE` — the page slug from the control's `page_ref` (e.g. `checkout`), not the full URL.
- `CATEGORY` — one of: `RENDER` | `API` | `PERM` | `VAL` | `CASCADE` | `LOAD` | `ERR` (the last three all
  belong to the `cascade-loading-error` category; split the id so a loading vs error vs cascade case is
  distinguishable).
- `role-or-rule` — present for `PERM` (the role: `admin`, `manager`, `subscriber`, `guest`) and `VAL` (the
  rule: `required`, `range`, `pattern`, ...). Omitted for `RENDER` / `API`.
- `INDEX` — zero-padded `001`, unique within its prefix. Never reused, never renumbered (APPEND continues).

### Examples
```
TS-BILLING-CHECKOUT-RENDER-001
TS-BILLING-CHECKOUT-API-001
TS-BILLING-CHECKOUT-PERM-admin-001
TS-BILLING-CHECKOUT-PERM-guest-001        # negative: unauthorized -> fallback
TS-BILLING-CHECKOUT-VAL-required-001
TS-BILLING-CHECKOUT-CASCADE-001
TS-BILLING-CHECKOUT-LOAD-001
TS-BILLING-CHECKOUT-ERR-403-001
```

Each id is stored lower-or-upper consistently with the module's existing ids; match what is already in
`qa-tracker.json` (APPEND must not introduce a casing variant of an existing prefix).

## data-testid selector contract (non-negotiable)

This worker is **code-based QA**: every step anchors on a stable `data-testid` selector that
feature-builder pinned into the manifest. **No fuzzy matching** — never select by visible text, label
copy, CSS position, nth-child, or XPath-by-text. Those break on copy edits, translation, and reflow, and a
QA suite that breaks on a label change is noise.

Rules:
- Read the selector from the manifest control's `selector` field (`[data-testid='...']`). Use it verbatim.
- A control with **no** `data-testid` in the manifest is a **gap** — record it in `qa-notes.md` and route
  back to feature-builder to add the test id. Do not fall back to a fragile selector to "make it work."
- For a control's sub-elements (an option row, an error message), require a derived test id
  (`[data-testid='billing-card-error']`); if absent, gap it the same way.
- Assertions reference data, not pixels: assert the bound value, the option set, the error message *text
  key* (not the localized string), the disabled/hidden state.

## Why this is first-class

The whole two-layer fence assumes a stable contract between the control and its test. The manifest's
`data-testid` **is** that contract. If QA were allowed to guess selectors, the manifest's value (pinned
intent) would leak away exactly where it matters most — at the assertion. Holding the line keeps every `TS`
deterministic and keeps a red result meaning "behavior is wrong," not "the selector moved."

## Analogy (.NET / DDD)

A `data-testid` is the **stable contract key** — like binding to an interface, not a concrete type. Selecting
by visible text is binding to the implementation detail (the string today); selecting by test id is binding
to the contract the developer published. When the UI copy changes, an interface-bound test still compiles;
a text-bound one shatters. Gapping a missing test id back to the dev is the same as refusing to depend on a
type that hasn't published its interface yet.
