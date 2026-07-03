# Master Shell — Bootstrap 5 theme, master page, navbar, menu nav (BUILT FIRST)

> Child reference of `SKILL.md` (screen-binding). This is the worker's PRIMARY deliverable: establish the
> web's theme and structure as real, viewable HTML before any individual screen. Tech is **Bootstrap 5
> only**, so the shell maps 1:1 onto an ASP.NET Core `_Layout.cshtml` + `_NavMenu` partial at implement
> time. Brand/theme is decided **per project** (not a house style) — use the frontend-design skill
> (`references/html-mockup.md`) to make deliberate, non-templated choices grounded in this project.

## Disk layout for the shell
```
mockups/shell/
├── _layout.html          # the master page (maps to _Layout.cshtml)
├── theme.css             # per-project brand: tokens + component styles (maps to site.css)
├── nav.js                # builds navbar + menu nav from the sitemap (maps to _NavMenu partial)
└── index.html            # a sample page that fills the shell, to verify it renders
```
Render and confirm `index.html` opens and looks right BEFORE producing real screens.

## MVC ↔ mockup mapping (why this maps cleanly to implement)
| ASP.NET Core MVC | Mockup shell | 
|---|---|
| `_Layout.cshtml` | `_layout.html` (head + navbar + sidebar + content slot) |
| `@RenderBody()` | `<main id="page-content">` content region |
| `_NavMenu.cshtml` partial | navbar + `#side-menu` populated by `nav.js` |
| `site.css` / bundle | `theme.css` |
| `ViewBag.ActiveMenu` | `data-active-page` attribute on `<body>` |
| `[Authorize(Roles=)]` on a page | `data-roles` on each menu item (visibility only — mockup) |

## theme.css — per-project brand as CSS variables
Override Bootstrap 5 via CSS custom properties + a few component rules. Keep ALL brand decisions here so a
restyle touches one file. Decide the actual palette/type with frontend-design; structure looks like:
```css
:root {
  /* brand tokens — chosen per project via frontend-design, not fixed defaults */
  --bs-primary: #....;            /* maps to Bootstrap primary */
  --app-accent: #....;
  --app-sidebar-bg: #....;
  --app-font-sans: "...", system-ui, sans-serif;
  --app-radius: .5rem;
}
/* Bootstrap uses its own --bs-* vars; map brand onto them where needed */
.btn-primary { --bs-btn-bg: var(--bs-primary); --bs-btn-border-color: var(--bs-primary); }
.app-sidebar { background: var(--app-sidebar-bg); width: 260px; }
.app-main { padding: 1.25rem; }
```
Load order in every page: Bootstrap 5 CSS (CDN) → `theme.css` (so brand wins). Then Bootstrap bundle JS.

## _layout.html — the master page (structure only; brand comes from theme.css)
```html
<!doctype html><html lang="th"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__PAGE_TITLE__ · __APP_NAME__</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="./theme.css" rel="stylesheet">
</head>
<body data-active-page="__ACTIVE__">
  <nav class="navbar navbar-expand-lg app-navbar">
    <div class="container-fluid">
      <span class="navbar-brand">__APP_NAME__</span>
      <button class="navbar-toggler" data-bs-toggle="offcanvas" data-bs-target="#side-menu-off">…</button>
      <div class="ms-auto" id="navbar-user"><!-- actor/role placeholder --></div>
    </div>
  </nav>
  <div class="d-flex">
    <aside class="app-sidebar"><ul id="side-menu" class="nav flex-column"></ul></aside>
    <main id="page-content" class="app-main flex-grow-1"><!-- @RenderBody() --></main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js"></script>
  <script src="./nav.js"></script>
</body></html>
```
Per page, replace the `__TOKENS__` (title, app name, active id) and fill `#page-content`. (At implement
time these become the layout + a Razor View; the tokens become `ViewBag`/section content.)

## nav.js — navbar + menu nav generated FROM the sitemap
The menu is not hand-written — it is derived from domain-design's `design/sitemap.md` so navigation matches
the real page hierarchy and roles. Read the sitemap nodes, emit a tree into `#side-menu`, mark the node
matching `body[data-active-page]` active, and hide items whose `data-roles` exclude the current mock role.
```js
// menu config is generated from sitemap.md nodes: { path, label, roles, children }
const MENU = /* injected from sitemap */;
function render(menu, active){ /* build <li class="nav-item"><a class="nav-link"> tree */ }
document.addEventListener("DOMContentLoaded", () =>
  render(MENU, document.body.dataset.activePage));
```
Keep one menu source so adding a sitemap node later updates every page's nav.

## Building the shell (procedure)
1. Read `design/sitemap.md` → node tree (path, label, roles, children).
2. Pick the per-project brand with frontend-design (palette/type/signature) → write `theme.css`.
3. Write `_layout.html` (structure) + `nav.js` (menu from sitemap) + a sample `index.html`.
4. Render/verify it opens and the nav reflects the sitemap + roles.
5. Add a `kind:"shell"` row to `design/registry.json`:
```jsonc
{ "id": "shell", "kind": "shell", "file": "mockups/shell/_layout.html",
  "theme": "mockups/shell/theme.css", "scenario_ref": ["*"] }
```

## Update / restyle later
- Adding sitemap nodes → re-generate the menu (nav.js source) only; pages keep extending the shell.
- Restyle → edit `theme.css` only (one file); never duplicate brand values into pages.
- In UPDATE mode never clobber a shell that bound pages already rely on without confirming with the user.

## Boundaries (shell-specific)
- Bootstrap 5 + minimal JS for nav/look only. No data access, no real auth, no server logic.
- Role handling is visibility-only mock (`data-roles`) — real authorization is implement's job.
- Do not invent menu items that are not sitemap nodes; the sitemap is the source of navigation truth.
