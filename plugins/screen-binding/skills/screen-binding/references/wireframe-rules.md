# Wireframe Rules — low-fidelity screens (the fast option)

> Child reference of `SKILL.md` (screen-binding). One of two screen fidelities (the other is the
> high-fidelity HTML mockup, `references/html-mockup.md`). A wireframe is a low-fi structural placeholder
> bound correctly to the spine — NOT a polished design — used for fast structural agreement, for a
> sitemap node a Claude Design bundle did not cover, or when the user asks for speed over finish. It still
> **extends the shell** and can be upgraded to an HTML mockup or an imported Claude Design bundle later
> without changing the scenario binding.

## Principle: the wireframe is derived, never imagined
Every control on a wireframe comes from a Data Dictionary field of an entity already bound to the scenario
(`traces_down.entities`). No invented fields, no invented screens. If the page needs something the DD lacks,
that is a **gap** reported back to domain-design — not a license to add UI.

## It still extends the shell
A wireframe is low-fidelity in *styling*, not in *structure*: it fills the shell's `#page-content`
(`references/master-shell.md`) so navbar/menu/theme stay consistent with every other page. Use plain
Bootstrap 5 markup with little/no custom styling — boxes, labels, and tables — rather than a separate
visual language. Set `body[data-active-page]` so the nav highlights.

## Field → control mapping (from DD type)
Pick the control from the Data Dictionary row's type/constraint. Intent-level; the polished Bootstrap
component (and any jQuery wiring) is the HTML-mockup's / implement's job.

| DD type / constraint            | Default control     | Notes |
|---------------------------------|---------------------|-------|
| `varchar(n)` short              | text                | maxlength = n |
| `varchar(n)` long / `text`      | textarea            | n large or free text |
| `int` / `decimal(p,s)`          | number              | step from scale s |
| `bool`                          | checkbox            | |
| `enum(a,b,c)`                   | select (or radio ≤3)| options = enum members |
| `date` / `timestamptz`          | date / datetime     | |
| `uuid` FK (`key: FK`)           | select              | options = referenced entity instances |
| `uuid` PK                       | (hidden / readonly) | identity, not user-entered |
| secret-ish (token/password)     | secure-input        | mask; never prefill |
| nullable = N                    | mark required       | required marker on the control |
| has constraint (≥0, regex, ...) | annotate validation | note the rule; implement enforces |

`io` is decided by the use case: data the actor *enters* = `capture`; data merely *shown* = `display`
(render readonly). Default identity/PK and server-computed fields to `display`.

## Page shape (low-fi)
Generate a placeholder under `mockups/wireframes/PG-<module>-<name>.html` that fills the shell content slot:
- a heading = sitemap node label,
- the controls above in DD order, grouped by entity,
- required markers + validation annotations as plain text,
- primary action(s) inferred from the use case (e.g. "Submit payment") — labelled, non-functional.
Minimal styling. No real logic, no data access, no scripts beyond what the shell provides. A contract
sketch, not an app.

## Layout heuristics by page kind (infer from sitemap + use case)
- **Form / create-edit** → vertical field list (capture controls) + submit/cancel.
- **List / index** → a table whose columns are the entity's key display fields + a row action; optional
  filter row from indexed/searchable fields.
- **Detail / read** → readonly field list (all display) + edit action if the actor's role allows.
- **Dashboard** → labelled placeholders per metric; bind each to the DD field/aggregate it represents.
Only generate what the sitemap node implies; do not add screens the sitemap does not list.

## Then bind it like any other screen
The `PG-*` artifact is identical in shape regardless of fidelity (`references/page-artifacts.md`):
- `fidelity: "wireframe"`, `source: "wireframe"`, `design_ref` = the generated `.html` path,
- `extends_shell` = the shell layout, `fields[]` each with a real `dd_ref`, `control`, `io`,
- `scenario_ref` + `sitemap_path` from the sitemap node,
- omit `design_tokens` (brand comes from the shell `theme.css`).

## Upgrade path (why this stays cheap)
The scenario binding lives on the `PG-*` (scenario_ref + sitemap_path + extends_shell + field dd_refs), not
in the visual file. Upgrading a wireframe is in place:
- → **HTML mockup:** set `fidelity:"html"`, `source:"in-house"`, repoint `design_ref` to the styled page.
- → **Claude Design:** set `fidelity:"html"`, `source:"claude-design"`, repoint `design_ref` to the bundle,
  attach/reconcile `design_tokens`, re-verify field dd_refs.
Either way the scenario's `traces_down.pages` entry does not change. Same view, swapped from scaffold to
finished.
