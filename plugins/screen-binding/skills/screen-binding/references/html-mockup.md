# HTML Mockup — high-fidelity screens via the frontend-design skill

> Child reference of `SKILL.md` (screen-binding). The high-fidelity option for a screen: a real Bootstrap 5
> page that extends the shell (`references/master-shell.md`) and is styled by the project `theme.css`. Use
> the **frontend-design skill** for the visual quality pass so the result is a deliberate, branded design —
> not a templated default. The low-fi alternative is `references/wireframe-rules.md`.

## When to choose HTML over wireframe
- ENTERPRISE scale, a stakeholder demo, or any screen the user explicitly wants to *see* finished.
- When a Claude Design bundle is not available but the user still wants hi-fi (this is the in-house path).
Wireframe stays the fast default for early structural agreement.

## Use the frontend-design skill (required for HTML fidelity)
Invoke the `frontend-design` skill before styling. It drives the per-project brand decisions:
- a compact token system (color 4–6 hex, type 2+ roles, layout concept, one signature element),
- grounded in THIS project's subject (use scenario `business{}` + module as the brief),
- reviewed against generic defaults before building.
Write the resulting tokens into the shell's `theme.css` (brand lives in one place) — individual pages
should consume tokens, not redefine brand. If a shell theme already exists, the page must honour it; only
extend with page-specific component styles, never fork the palette.

## Page structure — extend the shell, do not restate it
An HTML mockup is the shell's `_layout.html` with `#page-content` filled. Keep head/navbar/sidebar from the
shell; only author the content region. Conceptually (the worker may inline the shell markup per page since
mockups are static files, but the content is what it authors):
```html
<!-- inherits mockups/shell/_layout.html: navbar + #side-menu + theme.css -->
<main id="page-content" class="app-main">
  <h1 class="h4 mb-3">__PAGE_LABEL__</h1>
  <!-- content built from the bound entities' Data Dictionary fields -->
</main>
```
Set `body[data-active-page]` to this page's menu id so the nav highlights correctly.

## Build content from the Data Dictionary (same field contract as wireframes)
Every field shown/captured maps to a DD row of an entity in the scenario's `traces_down.entities`. Render
with real Bootstrap 5 components; choose the component from the DD type:

| DD type / constraint        | Bootstrap 5 component |
|-----------------------------|------------------------|
| `varchar(n)` short          | `<input class="form-control">` (maxlength n) |
| `text` / long               | `<textarea class="form-control">` |
| `int` / `decimal(p,s)`      | `<input type="number" class="form-control">` (step from s) |
| `bool`                      | `.form-check` switch/checkbox |
| `enum(...)`                 | `<select class="form-select">` (or `.btn-group` radios ≤3) |
| `date` / `timestamptz`      | `<input type="date|datetime-local">` |
| `uuid` FK                   | `<select class="form-select">` (options = referenced entity) |
| `uuid` PK / computed        | hidden or `.form-control-plaintext` (readonly) |
| secret (token/password)     | `<input type="password">` (never prefill) |
| list/index of an entity     | `<table class="table">` with key display columns + row action |
| nullable = N                | `required` + visible required marker |
| constraint (≥0, regex, …)   | annotate with `.form-text`; implement enforces |

`io` rule: actor-entered = editable (`capture`); shown-only = readonly (`display`). PK/computed default to
display.

## Quality floor (from frontend-design)
- Responsive down to mobile (Bootstrap grid), visible keyboard focus, `prefers-reduced-motion` respected.
- Spend boldness on ONE signature element; keep the rest quiet. Remove one decoration before finishing.
- Copy is design material: button says exactly what happens ("Save changes" not "Submit"); empty/error
  states give direction, not mood. Sentence case, plain verbs.
- Use realistic placeholder content drawn from the scenario, not lorem ipsum, so the screen reads true.

## Mockup, not implementation (boundary)
- Bootstrap 5 markup + theme.css + minimal JS for look/flow only (e.g. toggle a modal). No real data
  access, no fetch to real APIs, no server logic, no auth. implement (Phase 4) builds the real View.
- Do not invent fields absent from the DD — that is a gap reported to domain-design.
- Do not fork the brand: tokens come from the shell `theme.css`.

## Output + binding
- Write the page to `mockups/pages/PG-<module>-<name>.html`.
- Create the `PG-*` artifact with `fidelity:"html"`, `source:"in-house"`, `design_ref` = that html path,
  and `fields[]` each mapped to a DD row (`references/page-artifacts.md`). Append to `traces_down.pages`.
- An HTML page can later be replaced by an imported Claude Design bundle with no change to the binding —
  same scenario_ref, same sitemap_path, swap `source`/`design_ref`/`fidelity`.
