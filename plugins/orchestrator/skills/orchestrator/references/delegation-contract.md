# Delegation Contract + Worker Registry

The orchestrator delegates each phase with a **4-part contract**. Anthropic's guidance is blunt: a vague
task description makes a subagent redo work, leave gaps, or wander off the job. The contract is the cure —
it tells the worker exactly what to produce, where to put it, what not to touch, and what to read. The
orchestrator fills the four parts from the worker registry below + the in-scope scenario ids.

## The 4 parts

```
delegate(worker, contract) where contract = {
  objective:     What this phase must produce, in one or two concrete sentences, scoped to the
                 in-scope ids. NOT "do Phase 2" — rather "model the domain for SC-billing-001..003:
                 entities, Data Dictionary, API contracts, sitemap."
  output_format: The artifact of record + the exact spine field to fill. From the registry's
                 "writes" column. e.g. "write design/ (+ registry) and each in-scope scenario's
                 traces_down.entities / use_cases / apis."
  boundaries:    The worker's own non-negotiables, restated so the subagent can't drift. Always
                 includes the universal three (do not invent missing upstream artifacts — gap them;
                 do not touch a locked scenario's meaning; do not spawn another worker) PLUS the
                 worker-specific "does NOT" from the registry.
  context_refs:  POINTERS, never file contents. The spine path, the in-scope ids, and the upstream
                 artifacts this worker reads (from the registry's "reads" column). Plus the scale.
                 e.g. "scenarios.json#SC-billing-001..003 ; design/registry.json ; scale=STANDARD."
}
```

**Why pointers, not contents:** the orchestrator passes references and lets the worker pull what it needs.
Dumping full artifacts into the contract wastes context and risks the 200k limit on a long run. The spine
+ registries are the shared filesystem; the worker reads its own inputs.

**Dispatch mechanism:** the orchestrator uses the **Task tool** to spawn a fresh subagent running the
target worker's skill (or its `/` command where one exists — feature-builder and scenario-verify have
them). One subagent per phase. The subagent does the phase and returns its **handoff block**; it does not
spawn anything (flat hierarchy).

## Worker registry (who owns each phase, reads / writes what, key boundaries)

The orchestrator routes from this table. "Reads" → context_refs; "Writes" → output_format; "Does NOT" →
boundaries. Every worker also shares the universal boundaries (gap don't invent; don't touch locked
meaning; don't spawn a worker) and reads `meta.effort_scale`.

### Phase 0 — domain-design, reverse mode (Tier 1) — brownfield bootstrap only

Only planned when `scenarios.json` is absent **and** the target is an existing codebase (see
`references/phase-sequence.md` → "Phase 0 — Bootstrap"). Same worker as Phase 2, different mode and a
narrower contract — there is no spine yet, so nothing can be attached to it.

- **objective seed:** reverse-engineer the codebase at `<path>` into design artifacts — entities, Data
  Dictionary, API contracts, sitemap — per `codebase-analysis.md`. No `scenarios.json` exists yet; do not
  attempt to write `traces_down` (there is nothing to attach to). Record every extracted artifact that has
  no matching scenario in `reverse-notes.md` as a candidate for Phase 1 to confirm.
- **reads:** the codebase at the given path (models/entities, controllers, services, routes, config —
  see codebase-analysis.md's layer→artifact map).
- **writes:** `design/` (+ registry) — same shape as a forward design — plus `reverse-notes.md` (candidate
  scenario title/actor/goal inferred from code structure, each marked `needs_user_confirmation`).
- **does NOT:** create `scenarios.json` or write any `business{}` (still scenario-discovery's job, even
  here — a route existing is not confirmed business intent); fabricate a scenario_ref where none exists;
  skip validating DD types against migrations/schema; spawn a worker.
- **command:** none (implicit skill invoke — "reverse-engineer the codebase at `<path>`...", same trigger
  phrasing as a direct call, just delegated).
- **on gate PASS:** Phase 1 runs next, seeded from `reverse-notes.md` instead of raw user requirements.

### Phase 1 — scenario-discovery (Tier 1)
- **objective seed:** turn the user's requirements into / append to the scenario spine. **After a Phase 0
  bootstrap:** seed from `reverse-notes.md`'s candidates instead — still *ask the user* to confirm/correct
  each candidate's actor, goal, business value, and postconditions; a code-inferred title is a starting
  point for the question, never an accepted answer (scenario-discovery's "business intent from the user
  only" principle holds even when the candidate came from reverse-engineered code).
- **reads:** user requirements (speech or a document path) — or, after Phase 0, `reverse-notes.md`;
  existing `scenarios.json` if APPEND.
- **writes:** `scenarios.json` — `business{}` + identity + empty `analysis{}` shell + `rollup`.
- **does NOT:** write any `traces_down` design/code/test field; accept/reject an analysis suggestion;
  design or implement anything; treat a Phase 0 candidate's inferred title/actor/goal as already confirmed.
- **command:** none (implicit skill invoke, or explicit `/scenario-discovery:scenario-discovery`).
- **panel beat (1.5):** after discovery, a persona-panel runner appends generative suggestions +
  open questions from registry personas (`.scenarioforge/personas.json`; external AI providers
  allowed via `scripts/persona-call.sh` — HTTP tool calls, not workers). Suggest-only; single
  writer; one delegation; skipped on QUICK. (See scenario-discovery
  `references/multi-agent-analysis.md` + `references/persona-registry.md`.)
- **critic beat (2):** then a scenario-critic agent fills `analysis{}`; loop until
  `rollup.ready_for_next_phase == true`. (See verify-gates Gate 1.)

### Phase 2 — domain-design (Tier 1)
- **objective seed:** model the domain for the in-scope scenarios (entities, DD, use cases, APIs, sitemap).
  **After a Phase 0 bootstrap:** `design/` already exists — this is an UPDATE pass; attach
  `traces_down.entities/use_cases/apis` for the newly-confirmed scenarios to the artifacts Phase 0 already
  extracted. Do not re-read the codebase a second time.
- **reads:** `scenarios.json` (`business{}` + `domain_concepts[]`); after Phase 0, also the `design/`
  it already produced. (A **direct**, non-bootstrapped call to domain-design can also take an existing
  codebase to reverse-engineer in one shot when `scenarios.json` already exists — that path bypasses
  Phase 0 entirely since there's already a spine to attach to; Phase 0 exists specifically for the case
  where there is no spine yet.)
- **writes:** `design/` (+ registry) and each scenario's `traces_down.entities / use_cases / apis`.
- **does NOT:** write `business{}` or `traces_down.pages` (screen-binding) or `traces_down.features`
  (solution-arch); decide suggestion acceptance; write code/tests.
- **command:** `/domain-design:deliver-docs` (ENTERPRISE / on-demand full 10-section SDD) — otherwise
  implicit skill invoke.

### Phase 2u — screen-binding (Tier 1) — only if any in-scope scenario has has_ui == true
- **objective seed:** build the themed shell, then a page per in-scope `has_ui` scenario; bind each back.
- **reads:** `scenarios.json` (`business.has_ui`, `actor`, `traces_down.entities`); `design/sitemap.md`,
  `design/data-dictionary.md`, `design/registry.json`; optionally a Claude Design bundle path.
- **writes:** `mockups/shell/` + `mockups/pages/` (+ prompts/wireframes) and `traces_down.pages[]`.
- **does NOT:** write entities/apis/features; invent a field with no DD row (gap it); design for a
  non-has_ui scenario; write production code.
- **commands:** `/screen-binding:theme` (shell only), `/screen-binding:import-design <bundle>`,
  `/screen-binding:design-prompt [scenario-id]`.

### Phase 3 — solution-arch (Tier 1)
- **objective seed:** compose the modeled scenarios into FE units with layering + dependencies.
- **reads:** `scenarios.json` (`traces_down.entities / apis / pages`); the `design/` artifacts +
  `mockups/` registry they point at.
- **writes:** `features.json` (+ rollup) and each scenario's `traces_down.features[]`.
- **does NOT:** create/edit entities/DD/APIs (gap → domain-design); design/alter screens; write code or
  tests; re-plan a locked scenario silently.
- **command:** none (implicit skill invoke).

### Phase 4 — feature-builder (Tier 2, agentic) — has `/` commands
- **objective seed:** build the ready features into working code, looping build→fix until green + verified.
- **reads:** `features.json` (+ layering); per-FE `traces_up` (entities/DD from `design/`, APIs from
  `design/api/`, pages + shell from `mockups/`); `scenarios.json` (scenario_ref + postconditions);
  `.scenarioforge/impl-progress.json` (resume).
- **writes:** source code; `.scenarioforge/impl-progress.json` (ledger + routing); UI control manifests
  `.scenarioforge/ui-controls/FE-*.json`; `traces_down.features[]`.
- **does NOT:** invent entity/API/page (gap → upstream); re-plan/renumber FE; design screens; author/run
  the E2E QA suite; alter locked meaning; a subagent spawns a subagent.
- **commands:** `/feature-builder:implement [module|FE-id] [--quick|--standard|--enterprise] [--model]
  [--no-replicate]`, `/route`, `/continue`, `/status`, `/verify`, `/retry`, `/gaps`, `/help`.
- **dispatcher note:** feature-builder is itself a per-feature dispatcher (Opus direct / Opus
  exemplar + Sonnet replicas). That is internal to the worker — still ONE level below the orchestrator;
  the orchestrator does not manage model routing, it just delegates the phase.

### Phase 4q — scenario-verify (Tier 1 generate + Tier 2 run) — has `/` commands
- **objective seed:** derive E2E TS-xxx from acceptance criteria + control manifests, run them green,
  enforce Gate 4.
- **reads:** `scenarios.json` (AC refs + postconditions + priority + `traces_down.pages`); UI control
  manifests `.scenarioforge/ui-controls/FE-*.json`; `mockups/` (URLs); `features.json` (control→FE→scenario);
  `qa-tracker.json` (resume).
- **writes:** `qa-tracker.json` (TS + results + coverage + rollup); Playwright specs; `traces_down.test_scenarios[]`.
- **does NOT:** edit app source (a real bug → a finding back to feature-builder, not a code patch);
  invent a control/AC/permission rule (gap it); alter AC or locked meaning; a subagent spawns a subagent.
- **commands:** `/scenario-verify:generate`, `/run`, `/route`, `/continue`, `/retest`, `/status`,
  `/coverage`, `/edit`, `/gaps`, `/help`.

## Example filled contract (Phase 2, STANDARD)

```
worker: domain-design
objective:     Model the domain for SC-billing-001..003 — entities, Data Dictionary, use cases,
               API contracts, and the sitemap for the has_ui scenarios among them.
output_format: Write design/ (+ design/registry.json) and fill each of those scenarios'
               traces_down.entities / use_cases / apis in scenarios.json. Leave business{} and
               analysis{} byte-for-byte unchanged.
boundaries:    Plan only from business{} + domain_concepts — do not invent business intent. Do not
               write traces_down.pages or .features. A field/concept the scenario never named is a
               gap (record it), not an entity to invent. Do not touch a locked scenario. Do not
               spawn a worker.
context_refs:  scenarios.json#SC-billing-001..003 ; (no design/ yet — CREATE mode) ; scale=STANDARD
```

The orchestrator then waits for domain-design's handoff and runs Gate 2 (verify-gates) before delegating
solution-arch.

## Example filled contract (Phase 0, brownfield bootstrap)

```
worker: domain-design (reverse mode)
objective:     Reverse-engineer D:\GitHub\LegacyApp into design artifacts — entities, Data Dictionary,
               API contracts, sitemap — per codebase-analysis.md. No scenarios.json exists yet: do
               not write any traces_down. Record every extracted entity/route/API with no matching
               scenario in reverse-notes.md as a needs_user_confirmation candidate (inferred title,
               actor, goal from the code structure — not asserted as confirmed business intent).
output_format: Write design/ (+ design/registry.json) and reverse-notes.md (candidate list for
               Phase 1). Do not create scenarios.json — that file does not exist until Phase 1 writes it.
boundaries:    Do not fabricate business{} or a scenario_ref for anything. Validate DD types against
               real migrations/schema, not guesses. Flag code with no discoverable purpose as a gap,
               don't invent one. Do not spawn a worker.
context_refs:  codebase_path=D:\GitHub\LegacyApp ; no scenarios.json yet (bootstrap) ; scale=STANDARD
```

Gate 0-reverse (verify-gates) checks `design/` + `reverse-notes.md` exist and that no `scenarios.json` was
created. On PASS, Phase 1 runs next — seeded from `reverse-notes.md`'s candidates instead of raw user
requirements, but still asking the user to confirm each one (see the Phase 1 entry above).
