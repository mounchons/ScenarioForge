---
name: scenario-verify
description: >-
  Prove the spine end to end — Phase 4 (QA) of ScenarioForge, the worker that closes the loop a
  business scenario opened (renamed from qa-ui-test). Reads each scenario's acceptance criteria
  (from domain-design) plus the UI Control Manifests feature-builder emitted, and derives
  traceable E2E test scenarios (TS-xxx) into qa-tracker.json — Layer 2 of the two-layer fence.
  For every form control it generates the 5 mandatory test categories (render-binding,
  api-binding, permission, validation, cascade-loading-error), each carrying a scenario_ref so a
  test always traces back to the business scenario it proves. Generation is a deterministic Tier 1
  pass; running the suite is a Tier 2 agentic loop — run -> read failure -> debug -> retry through
  Playwright until each scenario goes green or a circuit breaker bounds it. Acts as a per-category
  dispatcher: permission / cascade scenarios go to an Opus subagent, api-binding / validation to
  Sonnet, render-binding to Haiku. Enforces Gate 4 (control coverage): every control x mandatory
  category must have a passing scenario before release.
  Use when: features are built (feature-builder done, UI Control Manifests present) and need their
  E2E proof, when generating / running / continuing / retesting a module's QA suite, when checking
  release coverage (does every control have its mandatory categories green?), OR when resuming an
  interrupted test run.
  Also triggered by "generate tests", "run the QA suite", "E2E test", "test the scenario", "verify
  the build", "coverage check", "retest", "scenario-verify", "qa-ui-test", "Gate 4", "Phase 4 QA".
  Trigger keywords: scenario-verify, qa-ui-test, qa, e2e, generate tests, run tests, coverage,
  control coverage, gate 4, two-layer fence, playwright, retest, verify, Phase 4 QA.
  Do NOT use for: capturing business intent / scenarios (scenario-discovery, Phase 1); modeling
  entities, Data Dictionary, acceptance criteria, or API contracts (domain-design, Phase 2);
  designing screens (screen-binding, Phase 2 UI); planning feature units or layering (solution-arch,
  Phase 3); writing the application source code or its build-time unit fence (feature-builder,
  Phase 4 implementation).
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# scenario-verify (Tier 1 generate + Tier 2 run)

Phase 4 (QA). A business scenario opened a question back in Phase 1 — *"does the system actually do this
for the user?"* Every later phase narrowed it: domain-design wrote the acceptance criteria, feature-builder
poured the code and pinned each control's intent into a UI Control Manifest. This worker **closes the
loop**: it turns those acceptance criteria + manifests into concrete E2E test scenarios (`TS-<module>-<...>`),
runs them against the running app, and reports — per scenario — green or red, each result tracing straight
back to the `SC-...` it proves.

It works in **two distinct modes** that map to two tiers:

- **Generate (Tier 1, deterministic):** read AC + manifests -> derive `TS-xxx` into `qa-tracker.json`. One
  predictable pass, no loop. This is the **Layer 2** half of the two-layer fence — feature-builder owns
  Layer 1 (build-time unit tests), this worker owns the release-time E2E set.
- **Run (Tier 2, agentic):** execute each scenario through Playwright and **loop** run -> read the failure
  -> debug (selector / timing / data setup) -> retry until the scenario goes green or the circuit breaker
  caps it. Because it loops an open number of times, the run is **resumable** (the qa-tracker ledger
  survives sessions) and **bounded** (a cap reports a stuck scenario instead of spinning).

> qa-tracker.json shape + scenario status lifecycle + resume rules: `references/qa-tracker.md`
> The 5 mandatory test categories + how each is derived from a control: `references/control-spec-scenarios.md`
> How each spec body is written — probe-first, control kinds, tabs/modals, rendering model, fixtures,
> permission patterns (field-proven; mandatory before authoring): `references/spec-authoring.md`
> TS id convention + the data-testid selector contract: `references/id-and-selectors.md`
> Gate 4 (control coverage) — the release fence and its gap math: `references/coverage-gate.md`
> Per-category model routing (Opus / Sonnet / Haiku) + the 4-part contract: `references/model-routing.md`
> Scale-adaptive behavior + circuit-breaker caps + override flags: `references/scale-adaptive.md`

## The line that defines this worker

feature-builder answers **"the code runs and its own unit fence is green"** (Layer 1). scenario-verify
answers **"the user-facing behavior the scenario promised is provably true in a browser"** (Layer 2). It
generates and runs tests; it writes **no application code** and **no acceptance criteria**. A control with
no manifest, or a scenario with no AC to prove, is a **gap** — record it and stop for that item; sending it
back upstream is correct, inventing the missing intent is not. This worker proves the spine; it never
extends it.

## What this worker reads / writes

Reads `scenarios.json` (each scenario's `acceptance_criteria` refs + `postconditions` + `business.priority`
+ `traces_down.pages`), the **UI Control Manifests** `feature-builder` emitted
(`.scenarioforge/ui-controls/FE-<id>.json` — the binding / validation / permission / cascade intent per
control, and the `data-testid` selectors), the page rows in `mockups/` (to resolve URLs), and `features.json`
(to map a control's FE back to its scenario). Reads its own `.scenarioforge/qa-tracker.json` ledger to resume.

Writes **`.scenarioforge/qa-tracker.json`** — always this path, never the repo root (the derived `TS-xxx`
scenarios, their category + control_refs + model tier, and run results — pending / running / passed /
failed / deprecated), the test artifacts the run produces (Playwright specs under the project's test path,
keyed by `data-testid`, shared helpers under `helpers/`), per-spec run results under
`.scenarioforge/test-results/`, and writes each derived test id into the owning scenario's
`traces_down.test_scenarios[]` (idempotent). **A different `qa-tracker.json` already sitting at the repo
root (e.g. from the legacy qa-ui-test plugin) is somebody else's ledger — never read it as state, never
overwrite it; note its existence in `qa-notes.md` and move on.** Never edits `business{}`, `analysis{}`,
acceptance criteria, or any application source.

## What this worker does NOT do (boundaries)

- Never create or change scenarios, `business{}`, `analysis{}`, or acceptance criteria (Phases 1-2).
- Never invent a control, a binding, a permission rule, or a validation rule. The manifest is the contract;
  a missing/contradictory manifest -> record a gap in `qa-notes.md` and stop for that item, do not guess.
- Never write or fix application source — a failing test that reveals a real code bug becomes a **finding**
  sent back to feature-builder, not a code edit made here. (This worker fixes *the test* — selector, wait,
  fixture — not the app.)
- Never design or alter screens, entities, APIs, or features (Phases 2-3).
- Never touch a `locked` scenario's meaning. **Flat hierarchy:** the dispatcher spawns one subagent per
  category-batch (and, on ENTERPRISE, one qa-critic) — each generates/runs and returns; a subagent never
  spawns another subagent (circuit breaker).

## Scale-adaptive behavior (do only what the work needs)

Read `meta.effort_scale` from scenarios.json. Numbers + caps in `references/scale-adaptive.md`.

| Scale | Behavior |
|---|---|
| QUICK | One scenario or one control's coverage, called directly. Generate + run just that set; the always-on `render-binding` category plus whichever conditional categories the manifest triggers. Still traced, still resumable. |
| STANDARD | Default. Generate the full 5-category set for every control in the module's manifests, run all, enforce Gate 4 before reporting release-ready. |
| ENTERPRISE | STANDARD + the qa-critic gate (a fresh subagent reviews generated scenarios for missing edge cases / weak assertions before they run) + stricter coverage (every permission role tested explicitly; negative paths for each validation rule). |

## Model routing (who generates/runs each category)

Full rules + the 4-part contract: `references/model-routing.md`. Route by **test category**, since
difficulty tracks the reasoning each category needs — not the scenario's size:

- **Opus** — `permission` (security-critical: role x data-scope reasoning, the cost of a wrong pass is a
  leak) and `cascade-loading-error` (cross-control state: dependency order, loading/error races).
- **Sonnet** — `api-binding` (endpoint + response-shape assertions) and `validation` (rule x boundary
  cases). Mid-complexity, well-patterned.
- **Haiku** — `render-binding` (every control: does it render and bind the right field?). Pattern-based,
  highest volume.
- Routing decides *who writes/runs*, never *whether it counts* — every category runs through the same
  result ledger and the same Gate 4. A Haiku/Sonnet scenario that stays red past half its retry cap is
  **escalated to Opus** once (the failure may be subtler than its tier assumed).

## Steps (working backward from the goal)

End goal = every scenario's promise is **proven or precisely reported**: each control has its mandatory
categories generated as `TS-xxx`, each `TS` runs green in a browser (or is red with a captured reason and a
finding routed upstream), Gate 4 confirms no control x mandatory-category gap remains, every `TS` traces
back to its `SC-...`, and `traces_down.test_scenarios` reflects what actually exists — with a qa-tracker
ledger that lets a fresh session resume mid-run without redoing passed scenarios. Working backward:

### Step 0 — Resume or start (read the ledger first)
- Glob/Read `features.json` + the UI Control Manifests under `.scenarioforge/ui-controls/`. No manifests
  and no AC to prove -> stop; tell the user to run feature-builder (this worker proves a build, it does not
  create one).
- **Environment preflight (before any run half):** hit the app's base URL once (e.g. `curl -sk -o /dev/null
  -w '%{http_code}'`). Unreachable -> generation may still proceed, but the run half **stops and reports
  the precondition** (what must be booted: app, DB, seed, secrets) instead of marking anything run. An
  un-run suite is never a green suite; a dead server is an environment finding for the orchestrator/user,
  not a reason to loop.
- Read `.scenarioforge/qa-tracker.json` if it exists. **Resume:** scenarios already `passed` are skipped, a
  `running`/`failed` one resumes its run loop at its last state (the ledger records category, control_refs,
  model tier, retry count). Never re-run passed work. Absent -> fresh run, create the ledger (CREATE mode).
- Detect **CREATE vs APPEND** (see `references/qa-tracker.md`): a manifest changed since last generation ->
  APPEND mode (delta only) — never overwrite, never renumber existing `TS` ids, never touch a `passed`
  scenario whose control is unchanged.
- Read `meta.effort_scale` + the circuit-breaker caps from `references/scale-adaptive.md`.

### Step 1 — Derive the scenario set (Tier 1, generate)
- For each control in each manifest, derive its mandatory categories per
  `references/control-spec-scenarios.md`: `render-binding` always; `api-binding` if `binding.source == api`;
  `validation` if it has a rule; per-control `CASCADE` if `depends_on != null` — and the **page-grouped**
  scenarios: `permission` per page x role and `LOAD`/`ERR` per page with api-bound controls, each carrying
  `control_refs` for every control covered (see "Page-level grouping" — do not fan permission out per
  control on a role-homogeneous page).
- Mint each `TS-<module>-<page>-<category>[-<role|rule>]-<nnn>` per `references/id-and-selectors.md`, anchor
  every step on the control's `data-testid` selector (no fuzzy text matching), and carry the `scenario_ref`
  from the manifest. Write them `pending` into `.scenarioforge/qa-tracker.json` with their `control_refs`,
  `category`, and routed `model_tier`. In APPEND mode, only mint the delta.

### Step 1.5 — Probe, then author the spec bodies (`references/spec-authoring.md` — mandatory)
- **Probe each page's real DOM first** (Rule 0) with the bundled `scripts/probe-page.mjs`: control kinds,
  hidden inputs, tab/modal inventory, the page's rendering model (client-fetch vs server-rendered), real
  cascade endpoints. Probe output is scratch input, never committed into the project.
- **Copy the shipped helpers** from `assets/e2e-helpers/` (`login.ts`, `activate-tab.ts`, `assert-kind.ts`)
  into the suite's `helpers/` and adjust the marked constants — never duplicate helpers inline per spec,
  never re-derive them from scratch.
- Author each spec body by the rules: assert by control kind (visible / attached / count), activate tabs
  and modals before asserting, `.first()` on prefix locators, validation per the enforcement that exists,
  permission per the fallback the app really implements, LOAD/ERR per the rendering model.
- **Surface the test-data request early** (spec-authoring "Test-data contract"): low-privilege credential,
  representative runtime rows, mutation opt-ins — recorded in `qa-notes.md` for the owner to fulfill or
  decline before the run half.
- **No `TODO(fixture)` bodies, ever** (Rule 8): real seed data, an honest documented empty-state, or a gap
  in `qa-notes.md` — a placeholder body that fakes an assertion is a contract violation, not a shortcut.

### Step 2 — Dispatch + run one category-batch (Tier 2, the inner loop)
Group `pending` scenarios by routed tier, then **dispatch a fresh subagent per batch** with the 4-part
contract from `model-routing.md` (objective = drive these `TS` to green; output = run results + artifacts +
ledger update; boundaries = these scenarios only, fix the *test* not the app, surface app bugs as findings,
no spawning; context = qa-tracker#TS + the manifest controls + resolved URLs from mockups). For each scenario
the subagent:
- **runs** it through Playwright — **blocking, in-turn** (`npx playwright test <spec> --reporter=json`,
  wait for exit). Never launch the suite backgrounded and sit in a monitor-wait poll loop: a blocking run
  converges and returns a parseable result; a backgrounded one has field-observably failed to converge.
- **Preserve evidence per spec:** write each spec's JSON reporter output to
  `.scenarioforge/test-results/<spec-name>.json` — one file per spec, never a shared path that each run
  overwrites. These files are what lets the orchestrator's release gate audit "N passed" independently
  later; a rollup nobody can re-derive is a claim, not a proof.
- Green -> mark `passed`. Red -> read the failure and classify: a *test* defect (selector drift, missing
  wait, bad fixture, un-probed DOM assumption — check `spec-authoring.md` first) is fixed and retried — the
  agentic loop; a *real app defect* (the behavior is genuinely wrong) is recorded as a **finding** against
  the owning FE and the scenario is left `failed` with the captured reason. Do not fix app code to make a
  test pass. When rewriting a body, preserve the test title verbatim (the `TS-` id is the trace key).
- Each retry increments the scenario's counter; at the cap (circuit breaker) -> leave it `failed`, write the
  reason to the ledger + `qa-notes.md`, move on — never spin past the cap. A Haiku/Sonnet scenario stuck at
  **half** its cap is **escalated to Opus** once.
- Update the ledger after each spec batch so a crash mid-run is resumable — statuses, `result.last_run_at`,
  recomputed `rollup.by_status`, **and `meta.run_status`** (which specs have actually run vs pending). A
  ledger whose rollup says green while `meta.run_status` still says partial is a broken audit trail.

### Step 3 — Enforce Gate 4 (control coverage — the Layer 2 fence)
Per `references/coverage-gate.md`: for every control, every **mandatory** category it triggers must have a
`passed` scenario. Compute `gap_control_ids` (a triggered category with no scenario) and `fail_control_ids`
(a scenario exists but is red). Either non-empty -> **release is blocked**; report exactly which control x
category is missing or red. A `--force-control-coverage` override is logged, never silent.

### Step 4 — ENTERPRISE only: qa-critic gate
When `scale == ENTERPRISE`, before the run, delegate a **fresh** Opus subagent to critique the generated
set (4-part contract: objective = find missing edge cases / weak assertions / untested roles; output = a
findings list; boundaries = critique only, do not run, do not edit, do not spawn; context = the generated
`TS` + the manifests). Materialize accepted findings as additional `pending` scenarios, then run. Flat
hierarchy: the critic spawns nothing.

### Step 5 — Write back + checkpoint
- Write each derived `TS` id into the owning scenario's `traces_down.test_scenarios[]` (idempotent).
  Preserve every other scenario field byte-for-byte (especially `business{}`, `analysis{}`, locked scenarios).
- Update `qa-tracker.rollup` (by_status, by_category, coverage gaps) so the orchestrator can check the gate
  without reading every scenario. Checkpoint the ledger so the next batch / session resumes cleanly.

## Self-Check (mandatory before returning work)

- [ ] Every control's mandatory categories were derived (`render-binding` always; conditionals per manifest triggers; permission + LOAD/ERR page-grouped with full `control_refs`)
- [ ] Every `TS` anchors on a `data-testid` selector (no fuzzy text matching) and carries a valid `scenario_ref`
- [ ] Every page was DOM-probed before its spec was authored; assertions follow `spec-authoring.md` (kind-aware, tab/modal-activated, `.first()` on prefixes); **zero `TODO(fixture)` bodies**
- [ ] Runs were blocking in-turn; per-spec JSON results exist under `.scenarioforge/test-results/`; `meta.run_status` matches what actually ran
- [ ] Each scenario is `passed`, or `failed` with a captured reason + a finding routed to the owning FE — no scenario marked `passed` without an executed run behind it
- [ ] No app source was edited to make a test pass; test-only fixes (selector/wait/fixture) are the loop
- [ ] permission / cascade went to Opus; api-binding / validation to Sonnet; render-binding to Haiku (overrides logged)
- [ ] No retry cap exceeded silently; a stuck Haiku/Sonnet scenario escalated to Opus once
- [ ] Gate 4 computed: `gap_control_ids` + `fail_control_ids` reported; release blocked if either non-empty
- [ ] No control / AC / permission rule was invented; every gap is in `qa-notes.md`, not guessed
- [ ] APPEND mode preserved existing `TS` ids + passed scenarios byte-for-byte; nothing renumbered
- [ ] `business{}` / `analysis{}` of every scenario unchanged; no `locked` scenario altered
- [ ] No subagent spawned another subagent (flat hierarchy held)
- [ ] qa-tracker ledger consistent + resumable; `traces_down.test_scenarios` matches what was generated
- [ ] scenarios.json + qa-tracker.json still parse

## Handoff

Return a light pointer to the orchestrator (artifact pattern — do not dump files):
```
phase: 4-qa
artifact: qa-tracker.json updated, Playwright specs written, scenarios.json#traces_down.test_scenarios confirmed
generated: <N> TS across <N> controls (<render/api/permission/validation/cascade> mix)
results: <N> passed | <N> failed (findings in qa-notes.md, routed to FE) | <N> deprecated
routing: <N> Opus, <N> Sonnet, <N> Haiku (<N> escalated to Opus)
gate-4: PASS | BLOCKED — gap_control_ids=[...] fail_control_ids=[...]
gaps: <N> missing-manifest / missing-AC recorded in qa-notes.md (need feature-builder/domain-design) | none
next: report to orchestrator — spine proven green, or loop findings back to feature-builder
```

## Analogy (.NET / DDD)

feature-builder handed you a running app whose **unit tests are green** — each slice compiles and its own
`xUnit` fence passes. But a green unit test only proves the part in isolation; the business scenario asked
whether the *whole user-facing path* works. This worker is the **QA lead who writes the integration/E2E
suite and runs it against a real browser**: the security-touching checks — can a `manager` see another
tenant's cards? — go to the senior engineer (**Opus**); the endpoint + validation assertions to a mid-level
dev (**Sonnet**); the "does it render and bind?" smoke checks to a junior (**Haiku**). The **UI Control
Manifest** is the spec sheet the dev pinned to each control so QA isn't guessing intent. **Gate 4** is the
release checklist — *no control ships without its mandatory checks green* — the same way a PR can't merge
with a red required check. When a test goes red, the QA lead first asks "is my test wrong?" (fix the
selector/wait — the loop) before filing a **finding** against the dev's code (never patching the app to
hide the failure). The **circuit breaker** is the `Polly` policy again: retry, then stop and report rather
than hammer a flaky run forever. And every `TS` carrying its `scenario_ref` is the **traceability matrix** —
you can point at `SC-billing-001` and say, with green checks, "this promise is kept."
