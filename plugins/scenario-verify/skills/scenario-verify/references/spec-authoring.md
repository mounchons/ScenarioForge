# Spec Authoring Rules — Writing Playwright That Passes Against the REAL App (scenario-verify)

Field-proven contract (first learned on a 639-test, 9-page, server-rendered ASP.NET MVC module where every
generated skeleton spec had to be rewritten). These rules govern **how a TS scenario's Playwright body is
written**. The derivation rules (`control-spec-scenarios.md`) decide *what* to test; this file decides *how
to assert it so a red result means the app is wrong — not that the spec guessed the DOM wrong*.

**A generated spec that asserts blindly is not a test, it is a debt.** Every rule below exists because its
violation produced false failures against a correct app.

## Rule 0 — PROBE THE REAL DOM FIRST (mandatory, before writing any spec body)

Never write assertions from the manifest alone. The manifest pins **identity** (the `data-testid` exists and
what it means); it does not pin **presentation** (visible vs hidden, tag kind, tab placement, conditional
rendering). Before authoring a page's spec:

1. Run the **bundled probe** — `node <plugin>/scripts/probe-page.mjs <url> [--login-url ... --user ... 
   --pass ...]` from the E2E suite directory. It dumps, per `data-testid`: tag, type, visibility,
   `disabled`/`required`, option/radio/checkbox/row counts, the owning form (incl. `form=`-attribute
   linking), tab/modal inventory + which controls start hidden behind an inactive container, and the
   **rendering model** (client XHR during load, or none).
2. Probe each cascade/dependent endpoint's **real** URL and response shape (client fetches often hit MVC
   routes like `/Module/Action`, **not** `/api/...`) — the probe's `client_xhr_during_load` list is the
   starting point.
3. A `data-testid` MISSING from the probe is **usually a conditional server slot** (`@if`-wrapped Razor,
   `v-if`, etc.), not a bug — check the view source before gapping it.

Probe output is scratch input for authoring — never committed into the project. This 2-minute step is what
makes the spec pass on first run.

## Rule 1 — Detect the rendering model before choosing LOAD/ERR/api-binding mechanics

Ask once per page: **does the browser fetch data client-side, or is the page server-rendered?**
(Probe: watch network during load; or check the view/controller — an MVC controller that calls the API
server-to-server and lets Razor emit `<option>`s/`<tbody>` rows means **NO client XHR exists**.)

| Rendering model | api-binding assertion | LOAD assertion | ERR assertion |
|---|---|---|---|
| **Client-fetch** (SPA or JS-enhanced page) | intercept the real endpoint (its **real** route — probe it; often not `/api/`), assert request fires + options/rows populate | delay-route the endpoint → assert the loading placeholder | fulfill 500 → assert the inline fallback renders and the page stays alive |
| **Server-rendered** (no client XHR) | assert the **rendered result**: real `<select>` → `option[value]:not([value=''])` count > 0; grid → row count > 0 or explicit empty-state | assert the fully-rendered page after nav (there is no spinner) | block `**/api/**` + reload → assert the page **stays alive** (true precisely because there is no client dependency) |

`page.route('**/api/**')` on a server-rendered page is a **silent no-op** — the classic false-green/false-red
generator. Never emit it without confirming the page actually fetches `/api/` client-side.

## Rule 2 — Assert by control KIND, not by one-size `toBeVisible` + `option.count()`

| Control kind (from the probe) | Correct assertion |
|---|---|
| visible input / select / button | `toBeVisible()` + value/binding |
| `<input type=hidden>`, `display:none` carriers (payload, rowversion, idempotency keys) | `toBeAttached()` + value/`name`/`type` — **never** `toBeVisible()` |
| radio group / checkbox group (a `<div>` of `<input>`s — **zero** `<option>`) | count child `input[type=radio]` / `input[type=checkbox]` — never `option` |
| real `<select>` | `option[value]:not([value=''])` count > 0 (excludes the placeholder) |
| grid / `<table>` | `tbody tr` or `[data-testid^='<row-prefix>-']` **row count**, or the explicit empty-state marker |
| control behind a tab / modal | **activate the tab / open the modal first** (Rule 3), then assert |
| conditional server slot (renders only inside `@if(...)`) | assert `toHaveCount(0)` **with the documented reason** when the condition is false on seed — do not fabricate the condition |
| `<option>` element itself, empty result containers | `toBeAttached()` |
| enhanced widget (DevExtreme/Kendo etc. — no native `<option>`; popup lists) | assert the wrapper (e.g. `.dx-selectbox` input), then open the dropdown and count popup items (e.g. `.dx-list-item`) — native `selectOption`/`toHaveValue` do NOT work; probe first to detect the widget class |

Use one shared helper that branches on tag kind rather than repeating the logic per test — the plugin ships
ready-made ones under `assets/e2e-helpers/` (`assert-kind.ts`: `locOf`, `assertSelectPopulated`,
`assertGroupPopulated`, `assertGridRows`, `assertServerForm`, `assertUnauthRedirect`; `activate-tab.ts`;
`login.ts`). **Copy them into the suite's `helpers/` at generation time and adjust the marked constants**
(testid prefix, login selectors) — do not re-derive them per project.

## Rule 3 — Tabs, modals, and strict mode

- **Tab-activation**: before asserting any control on a non-default tab, click its trigger and wait for the
  pane to become active. Ship this as a shared helper (in `helpers/`, next to `login` — never duplicated
  inline per spec):

  ```ts
  export async function activateTab(page: Page, tab: string): Promise<void> {
    await page.locator(`[data-testid='mp-tab-${tab}']`).click();   // adapt prefix per module
    const pane = page.locator(`[data-testid='mp-pane-${tab}'], #tab-${tab}`);
    await expect(pane).toBeVisible();
    await expect(pane).toHaveClass(/active/);
  }
  ```

  Probe first: pane naming differs per page (`data-testid` pane vs bare element id) and the default-active
  tab needs **no** activation. Do not trust the plan's tab count — the mockup/DOM is the truth (plans have
  said "5 tabs" where the real page had 8). Manifests at `schema_version >= 1.1.0` carry `pages[].structure`
  (tabs/modals) and per-control `container` — read the hosting tab from there first, then confirm against
  the probe; on older manifests the probe is the only source.
- **Strict mode**: a prefix locator (`[data-testid^='row-']`) on a grid matches MANY elements — Playwright
  throws a strict-mode violation. **Every prefix assertion needs `.first()`** (or an exact-id locator).
- Row-scoped controls only exist when rows exist: with an empty seeded grid, assert grid + empty-state marker
  visible + control `toHaveCount(0)` — never fabricate rows to make a control appear.

## Rule 4 — Validation: assert the enforcement that actually exists

Probe the form first: is it `novalidate`? Which rules are JS-enforced vs server-only?

- **JS-enforced rules** (error class appears, submit gated): do the real invalid→valid cycle — fill invalid,
  submit, assert the error state **and that no POST fired**, then fill valid and assert the POST fires.
- **Declared-but-client-unenforced rules** (`required` in the manifest, `novalidate` form, no JS gate): assert
  the **contract** — the attribute is present (`toHaveAttribute('maxlength','50')`, `required`, `min`/`max`)
  or a defaulted non-empty value — plus a real transition where a placeholder option exists. **Do not assert
  an error state the app never renders.**
- **`server_side` rules on server-rendered forms**: assert the field's owning `<form>` posts to the
  server-validated action (`method=post` + the right `action`). Inline-edit grids often link controls to
  their form via the HTML `form="..."` **attribute** (the control is NOT a DOM descendant of the form) —
  locate the form by its `action`, not by `ancestor::form`.
- Stub the submit endpoint (`page.route` → fulfill 200) and assert `waitForRequest` fired when you need
  "validation passed + payload bound" without exercising the full mutation flow.

## Rule 5 — Cascades: classify before asserting

A `depends_on` covers several distinct mechanics — probe which one it is:

- **Real option reload** (parent select → child refetch): drive the parent, assert child `toBeEnabled` +
  option/row count grows. Poll; never sleep.
- **Resolve/compute cascade via endpoint**: assert the **mechanism** (endpoint fires, 200, dependent
  present) rather than specific populated values when seed data can't guarantee them — capture the response
  via `page.on('response')`.
- **Pure-JS compute/gating** (net→gross formula, checkbox→button-enable, flag→field-required): assert the
  exact computed output / the enabled-required flip. No network involved.
- **Form-GET "cascade"** (filter checkbox → submit → reloaded grid): check parent, submit, `waitForURL`
  with the query param, assert the dependent state.

## Rule 6 — Permission scenarios: test the fallback the app REALLY implements

The manifest's `fallback_when_unauthorized` must be validated against reality (probe once per page):

- Auth-gated pages (`[Authorize]` and equivalents): an unauthenticated `goto(URL)` **302s to the login
  route**. The negative test = **no-login** goto → assert `toHaveURL(/login/i)` + control `toHaveCount(0)`.
  The generated anti-pattern — logging in first and asserting `toBeHidden()` — tests nothing.
- Element-level hide/disable is only assertable when the app actually implements per-role element gating
  AND a differently-privileged credential exists. No such credential provisioned → the redirect pattern
  above is the honest, runnable fallback; note the substitution in `qa-notes.md`.
- Permission-**positive** on a control that legitimately cannot render (row-scoped, empty grid; draft-only
  button with no draft seeded): the proof is **page access** — not redirected + page landmark visible +
  control count 0. Do not fabricate the row/state.

## Rule 7 — Waits and stability

`expect.poll` / `waitFor` / `toBeEnabled({timeout})` everywhere; **no arbitrary `waitForTimeout` sleeps** in
assertions. Keep shared helpers (`login`, `activateTab`, kind-branching assert helpers) in `helpers/` — a
helper duplicated inline across specs will drift.

## Rule 8 — Fixtures: real data or an honest empty-state — never `TODO`

A spec body is **never** emitted with a `// TODO(fixture)` placeholder — that ships a fake green/red. For
each test decide at authoring time:

1. Seed data satisfies the precondition → use it (read-only; never mutate seed a later spec depends on —
   prefer read/structure assertions, route-stubbed submits, and non-persisting flows).
2. Seed data cannot satisfy it (no rows, no draft, no second role) → assert the **documented empty-state /
   fallback** (Rules 2, 3, 6) with the reason recorded in the spec body comment + `qa-notes.md`.
3. The precondition genuinely requires data only an owner can provide → that is a **gap** (`qa-notes.md`,
   routed upstream), and the TS stays `pending` — not a placeholder `passed`.

## Test-data contract (agree BEFORE the run half)

Rule 8 decides per test; this section is the up-front agreement that shrinks how often the empty-state
fallback is needed. At generation time, derive from the manifests what the run will need and surface it as
a short **test-data request** in `qa-notes.md` for the user/owner to fulfill (or explicitly decline):

1. **A low-privilege credential** (`E2E_USER_LOW`/`E2E_PASS_LOW`) whenever any control has element-level
   role gating — without it, every permission-negative degrades to the unauthenticated-redirect pattern
   (valid, but it proves the page gate, not the element gate).
2. **One representative runtime row** for each detail/row-scoped page family (e.g. one persisted record
   reachable by id) — without it, entire detail pages assert only their not-found fallback (field case: 56
   quote-detail tests all asserted the redirect because zero quotes existed).
3. **Which flows may mutate data** — mutating round-trips (create/close-clone/import) are opt-in; the
   default is read/structure assertions + route-stubbed submits so the seed stays re-runnable.

Declined or unavailable items are recorded in `qa-notes.md` with the substituted assertion pattern — an
honest downgrade, never a silent one.

## Title contract (recalibration-safe)

The `TS-...` id lives in the spec title and is what the ledger traces by: `test('TS-... :: <description>')`.
When a spec body must be rewritten (recalibration, APPEND), **preserve every test title verbatim** — only
bodies change. Parsing results back keys on that id (allow lowercase segments — role/rule ids like
`required` / `guest` are lowercase).

## Analogy (.NET / DDD)

The manifest is the interface; the rendered DOM is the runtime type. Asserting `toBeVisible()` everywhere is
casting every object to the same concrete class and being surprised by `InvalidCastException`. The probe is
a `GetType()` check before the cast; the kind-table is pattern matching on the actual type. And the
no-`TODO(fixture)` rule is the same discipline as never committing a test with `Assert.True(true)` — an
un-asserting test is worse than no test, because it reports confidence that nobody earned.
