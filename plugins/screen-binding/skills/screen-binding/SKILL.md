---
name: screen-binding
description: >-
  Build UI mockups and bind them to the scenario spine — the UI half of Phase 2 (Planning) in
  ScenarioForge. THEME-FIRST: before any screen, it establishes the web theme — a Bootstrap 5 master
  page (_Layout-style shell), theme.css, navbar, and menu nav built from domain-design's sitemap —
  rendered as real, viewable HTML. Then each has_ui scenario gets a page that extends that shell, at the
  chosen fidelity: a low-fi wireframe OR a high-fidelity HTML mockup (using the frontend-design skill).
  It also talks to Claude Design both ways: import a handoff bundle, or generate a per-screen prompt that
  tells Claude Design what each screen must contain (derived from the Data Dictionary + scenario). Every
  page is bound back via traces_down.pages so each screen traces to a business goal.
  Use when: building a web theme / master page / navbar / layout shell; mocking up screens as HTML or
  wireframes; importing a Claude Design bundle; writing a Claude Design prompt for a screen; mapping a
  Data Dictionary onto pages. Runs only for scenarios with business.has_ui == true.
  Also triggered by "master page", "layout shell", "navbar", "menu nav", "theme the site", "html mockup",
  "wireframe", "bind screens", "import Claude Design", "Claude Design prompt", "design handoff".
  Trigger keywords: screen-binding, ui-mockup, master page, layout, navbar, menu, theme, css, Bootstrap,
  wireframe, html mockup, Claude Design, design handoff, design prompt, sitemap pages, Phase 2 UI.
  Do NOT use for: creating scenarios / business intent (scenario-discovery, Phase 1); modeling entities /
  Data Dictionary / API / sitemap (domain-design — this worker CONSUMES those); composing features
  (solution-arch, Phase 3); writing production code or tests (Phase 4 workers).
allowed-tools: Read, Write, Edit, Glob, Grep
---

# screen-binding (Tier 1 — Workflow Worker)

Phase 2 (Planning), UI side. domain-design produced the *navigation* (sitemap) and the *data* (entities +
Data Dictionary). This worker produces the **visible UI** — first the **theme/shell**, then the
**screens** — and binds each page back to its scenario via `traces_down.pages`. Output is viewable HTML
plus page-binding artifacts, so one scenario id traces business goal → entities → **screen** → code.

> Master-page / theme / navbar / menu shell (Bootstrap 5), built first: `references/master-shell.md`
> High-fidelity HTML mockups via the frontend-design skill (per-project brand): `references/html-mockup.md`
> Low-fi wireframe rules (DD → controls) when speed matters: `references/wireframe-rules.md`
> Claude Design bridge — import a bundle AND generate per-screen prompts: `references/claude-design-bridge.md`
> Page-binding artifact shapes + how PG-* trace back: `references/page-artifacts.md`

## THEME FIRST — the shell is the primary deliverable

Before mocking up any individual screen, establish the web's look and structure. This is the highest
priority of this worker and is built as **real, viewable HTML**:

1. **Master page** — a Bootstrap 5 layout shell that mirrors an ASP.NET Core `_Layout.cshtml`: html head
   with Bootstrap 5 + the project theme.css, a top **navbar**, a side/top **menu nav** generated from the
   sitemap, and a content region every page fills.
2. **theme.css** — the per-project brand: color palette, typography, spacing, component look. Brand is
   decided **per project** (not a fixed house style) — use the frontend-design skill to make deliberate,
   non-templated choices grounded in this project's subject (`references/html-mockup.md`).
3. **navbar + menu nav** — driven by domain-design's sitemap so navigation already reflects the real page
   hierarchy and the roles that may see each node.

Tech is **Bootstrap 5 only** (matches the real stack: ASP.NET Core MVC + Bootstrap 5 + jQuery), so the
shell maps 1:1 onto `_Layout.cshtml` / `_NavMenu` at implement time — no framework translation. Render the
shell to `mockups/shell/` and confirm it opens and looks right **before** producing screens.

## Two output fidelities per screen (user chooses)

After the shell exists, each `has_ui` screen is produced at one of two fidelities — both extend the shell:
- **Wireframe (low-fi)** — fast structural placeholder from the Data Dictionary (`references/wireframe-rules.md`).
- **HTML mockup (high-fi)** — a real Bootstrap 5 page styled by the theme, built with the **frontend-design
  skill** for deliberate visual design (`references/html-mockup.md`).
Either way the binding artifact (`PG-*`) is identical; only `fidelity` differs.

## Claude Design — both directions (talks to it, not just imports)

`references/claude-design-bridge.md` covers two flows:
- **Import** a handoff bundle / HTML export from claude.ai/design → bind its pages to the spine (pointers,
  not promoted to code).
- **Prompt-out** — generate a precise per-screen brief telling Claude Design what a screen must contain:
  purpose, the fields (from the DD with types/required), actions (from the use case), roles, states, and
  the theme tokens to honour. The user pastes it into claude.ai/design; the resulting bundle can be
  imported back. This closes the loop: spine → prompt → Claude Design → bundle → bound screen.

## What this worker reads / writes

Reads: `scenarios.json` (per scenario: `business.has_ui`, `business.actor`, `traces_down.entities`),
domain-design's `design/sitemap.md`, `design/data-dictionary.md`, `design/registry.json`; optionally a
Claude Design bundle path.

Writes: the shell under `mockups/shell/`, page mockups under `mockups/pages/` (+ `mockups/wireframes/` or a
referenced `mockups/design-bundle/`), Claude Design prompts under `mockups/prompts/`; updates the design
registry with `kind:"page"` / `kind:"shell"` rows; and `traces_down.pages[]` per `has_ui` scenario.

## What this worker does NOT do (boundaries)

- Only acts on scenarios where `business.has_ui == true`. Skip batch/API-only scenarios entirely.
- Never write `entities/use_cases/apis` (domain-design) or `features` (solution-arch/implement).
- Never invent fields not in the Data Dictionary. A field with no DD row is a **gap** reported back to
  domain-design — never silently added.
- Never edit `business{}` / `analysis{}`, never create scenarios, never touch a `locked` scenario's pages.
- Mockups are mockups: Bootstrap 5 + minimal JS for look/flow only. Do not write production code, real data
  access, or server logic — implement (Phase 4) reads these pages and builds the real app in the stack.

## The contract it must honour: Data Dictionary ↔ screen fields

Every input/displayed value that carries entity data maps to a DD field (name/type/nullability). A form
field with no DD row is a gap, not a feature. This is the same bridge domain-design guards from the data
side, enforced here from the UI side — for wireframes, HTML mockups, and Claude Design prompts alike.

## Scale-adaptive output (do only what the scenario needs)

Read `meta.effort_scale` from scenarios.json.

| Scale | Produce | Notes |
|---|---|---|
| QUICK | (normally skipped with the rest of Phase 2) | Only run if explicitly asked. |
| STANDARD | Shell (master page + theme + nav) + one page per sitemap node | Fidelity per user (wireframe default). |
| ENTERPRISE | + HTML fidelity, design-token map, per-page intent, state (empty/loading/error), role-visibility | Full theme + handoff-ready. |

The shell is built once per project (then reused/updated); fidelity of individual screens scales.

## Steps (working backward from the goal)

End goal = a themed, viewable mockup set where the shell defines the look, every `has_ui` scenario has a
page that extends it, every page is bound (`traces_down.pages`) and every field maps to the DD. Backward:

### Step 0 — Preconditions + detect inputs
- Glob/Read `scenarios.json` and `design/sitemap.md`. If either is missing → stop; tell the user to run
  scenario-discovery / domain-design first (this worker consumes their output).
- Detect: did the user provide a Claude Design bundle (→ import) or ask for prompts (→ prompt-out)?
- Detect CREATE (no `mockups/` yet) vs UPDATE (adding/changing for new scenarios). In UPDATE never clobber
  the shell or a `locked` scenario's pages; touch only what changed.

### Step 1 — Build the THEME/SHELL first (primary)
- From `design/sitemap.md`, derive the navbar + menu nav (hierarchy + roles).
- Decide the per-project brand with the **frontend-design skill** (palette, type, signature) — see
  `references/html-mockup.md`. Write `mockups/shell/theme.css` + the Bootstrap 5 master page
  (`references/master-shell.md`). Render and verify it is viewable before moving on.
- Record a `kind:"shell"` registry row.

### Step 2 — Select the has_ui set + read scale/fidelity
- Read `meta.effort_scale`. Select scenarios with `has_ui == true` and a sitemap node.
- For each, load `business.actor` + `traces_down.entities`, pull those entities' DD fields.
- Determine fidelity per screen (user's choice; wireframe default at STANDARD, HTML at ENTERPRISE/on ask).

### Step 3 — Produce each screen (extends the shell)
- WIREFRAME → `references/wireframe-rules.md` (DD field → control, layout heuristics).
- HTML → `references/html-mockup.md` (Bootstrap 5 page using theme.css, frontend-design for quality).
- CLAUDE DESIGN PROMPT → `references/claude-design-bridge.md` (write `mockups/prompts/PG-*.md`).
- CLAUDE DESIGN IMPORT → match bundle page → sitemap node, point at the real file.
- In all cases: list the DD fields the screen shows/captures; any field with no DD row → report as a gap.

### Step 4 — Bind + write back traces_down.pages + self-check
- Write a `PG-<module>-<name>` artifact (shape in `references/page-artifacts.md`) with `scenario_ref`,
  `sitemap_path`, `fidelity`, `source`, `design_ref` (the html/wireframe/bundle/prompt file), `fields[]`,
  `roles`, and (ENTERPRISE) tokens/intent/states.
- Record each page id into the scenario's `traces_down.pages[]`. Preserve every other field of every
  scenario byte-for-byte (`business{}`, `analysis{}`, other workers' traces_down fields, locked scenarios).
- Update the registry. Run the Self-Check; fix any failure before reporting.

## Commands

### `/theme` — build (or restyle) the master-page shell only
Generates the Bootstrap 5 master page + theme.css + navbar + menu nav from the sitemap, using
frontend-design for the per-project brand. Renders viewable HTML under `mockups/shell/`. Use first, or to
restyle later without touching bound pages.

### `/import-design <bundle-path>` — bind a Claude Design handoff bundle to the spine
Maps bundle pages → sitemap nodes → scenario_ref, extracts design-system tokens, writes `PG-*` +
`traces_down.pages`. Records pointers; does not convert design to production code. Unmatched bundle pages
are reported as unbound, never bound silently.

### `/design-prompt [scenario-id]` — write Claude Design briefs for has_ui screens
Generates per-screen prompts (`mockups/prompts/PG-*.md`) telling Claude Design exactly what each screen
must contain — fields (from DD), actions (from use case), roles, states, theme tokens — for the user to
paste into claude.ai/design.

## Self-Check (mandatory before returning work)

- [ ] The shell (master page + theme.css + navbar + menu nav) exists under `mockups/shell/`, renders, and
      its nav reflects the sitemap + roles
- [ ] Every `has_ui == true` scenario in the set has non-empty `traces_down.pages`; no `has_ui == false` one does
- [ ] Every page extends the shell (consistent layout/theme), and is wireframe or HTML as chosen
- [ ] Every PG-* binds to exactly one sitemap node, carries a valid `scenario_ref`, `fidelity`, `source`, `design_ref`
- [ ] Every page with tabs/sections/modals carries a `structure` block matching its mockup file (same tab
      ids/count) — downstream phases read layout facts from here, never restate them from memory
- [ ] Every screen/prompt field maps to an existing Data Dictionary row (no invented fields; gaps reported)
- [ ] No `entities/use_cases/apis/features` written; only `pages`
- [ ] `business{}` / `analysis{}` unchanged; no `locked` scenario's pages or the shell clobbered in UPDATE
- [ ] scenarios.json still parses; registry updated; every `design_ref` points at a file that exists

## Handoff

Return a light pointer to the orchestrator (artifact pattern — do not dump files):
```
phase: 2-planning (UI)
artifact: ./mockups/shell/ (theme + master page), ./mockups/pages/, scenarios.json#traces_down.pages
produced: shell (Bootstrap 5, themed) + <N> pages for <N> has_ui scenarios (fidelity: <wireframe|html|mixed>)
claude_design: <prompts written / bundle imported, if any>
gaps: <fields missing from DD / unbound bundle pages, if any>
next: solution-arch composes features from entities+apis+pages; implement turns the shell into _Layout.cshtml + the pages into Views
```

## Analogy (.NET / DDD)

The shell is your **`_Layout.cshtml` + site.css + `_NavMenu` partial** — built first because every View
hangs off it, and here it is literally Bootstrap 5 so implement reuses it directly. Each `PG-*` is a Razor
**View bound to a ViewModel**: its inputs are model-bound to Data Dictionary fields, so binding a field
with no DD row is binding to a property that does not exist (a compile error, surfaced here as a gap). A
wireframe is a scaffolded placeholder View; an HTML mockup is the finished View styled by the theme; a
Claude Design prompt is the spec you hand a designer; importing a bundle is the designer handing finished
`.cshtml` + CSS back. Swapping a wireframe for an HTML mockup or an imported bundle never changes the
scenario binding — same route, same model, different View.
