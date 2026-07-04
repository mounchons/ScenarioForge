# ScenarioForge Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Implementer model (user decision):** every implementation subagent MUST run with `model: "opus"`.
>
> **Planned deviation (user decision):** implementation code is authored by the Opus
> implementer, not copied from this plan. The **tests, fixture, command doc, and interface
> signatures in this plan are complete and binding**; implementation steps give exact
> signatures and behavioral requirements instead of full source. Where a requirement is
> subtle (whitelist, atomic write, snapshot stripping), a short reference snippet is
> included and is also binding.

**Goal:** Human-readable viewer for `scenarios.json` with expandable sub-nodes — live interactive mode for the author, self-contained read-only snapshot for clients — shipped inside the `scenario-discovery` plugin.

**Architecture:** A single-file vanilla-JS `viewer.html` served by a zero-dependency Node server (`server.mjs`). The server exposes a whitelisted mutation API (suggestion decisions, `human_validated`) with rollup recompute, atomic writes, and mtime-based optimistic concurrency. Snapshot mode embeds the JSON into the HTML and structurally strips all live-only code.

**Tech Stack:** Node >= 18 (`node:` builtins only — `http`, `fs`, `path`, `url`, `child_process`, `os`), `node:test` for tests, hand-written HTML/CSS/JS. No npm packages, no build step.

**Spec:** `docs/superpowers/specs/2026-07-04-scenarioforge-viewer-design.md` (binding).
**Schema:** `plugins/scenario-discovery/skills/scenario-discovery/references/schema.md` (binding).

## Global Constraints

- Zero runtime dependencies: `node:` builtins only; never run `npm install`.
- No build step; `viewer.html` is one hand-authored file.
- `viewer.html` must reference **no external URLs** (no CDN, fonts, images) — must work offline and from `file://`. Use a system font stack.
- The server binds `127.0.0.1` only; default port `0` (OS-assigned).
- Write-back whitelist is exactly two actions: `suggestion_decision` and `set_human_validated`. Anything else → 400. Every successful write recomputes `rollup` and is atomic (temp file + rename). Stale `mtimeMs` → 409.
- Snapshot output must contain no `LIVE-ONLY` marker content and no `/api/` string.
- UI labels are Thai (table in Task 4); file contents/comments are English.
- All dynamic strings rendered into HTML go through an `esc()` HTML-escape helper.
- Run tests with: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
- Windows is the primary dev platform — never hardcode `/` path joins in Node code; use `node:path`.

---

### Task 1: Fixture + directory scaffolding

**Files:**
- Create: `plugins/scenario-discovery/assets/viewer/fixtures/scenarios.sample.json`

**Interfaces:**
- Consumes: schema.md shapes.
- Produces: the fixture every later test loads. Field values below are load-bearing — tests assert exact ids (`SC-demo-001`, `SUG-demo-001`), counts (2 scenarios, 1 high gap, 1 pending suggestion), and `avg_completeness` 0.72. Do not "improve" values.

- [ ] **Step 1: Write the fixture exactly as below**

```json
{
  "$schema": "https://scenarioforge/schemas/scenarios.v1.json",
  "meta": {
    "module": "demo",
    "schema_version": "1.1.0",
    "generated_by": "scenario-discovery",
    "generated_at": "2026-07-04T04:00:00Z",
    "effort_scale": "STANDARD",
    "status": "analyzing"
  },
  "scenarios": [
    {
      "id": "SC-demo-001",
      "title": "Customer pays monthly subscription by credit card",
      "phase_origin": 1,
      "status": "needs_review",
      "business": {
        "actor": "Customer (subscriber)",
        "goal": "Pay successfully and receive a receipt",
        "trigger": "Billing cycle due",
        "preconditions": ["has active subscription", "has a card on file"],
        "postconditions": ["invoice=paid", "receipt sent"],
        "business_value": "Protect recurring revenue",
        "priority": "high",
        "has_ui": true,
        "domain_concepts": ["Subscription", "Invoice", "Payment", "Receipt"]
      },
      "traces_down": {
        "user_stories": [], "use_cases": [], "acceptance_criteria": [],
        "entities": ["Subscription", "Invoice"], "pages": [], "apis": [],
        "features": [], "test_scenarios": []
      },
      "analysis": {
        "completeness": {
          "score": 0.72,
          "scored_by": "scenario-critic",
          "scored_at": "2026-07-04T04:05:00Z",
          "gaps": [
            { "type": "missing_edge_case", "severity": "high", "detail": "Does not cover a declined card", "raised_by": "scenario-critic" },
            { "type": "ambiguous", "severity": "medium", "detail": "Receipt channel (email vs in-app) unspecified", "raised_by": "scenario-critic" }
          ]
        },
        "suggestions": [
          {
            "id": "SUG-demo-001",
            "kind": "new_edge_case",
            "proposed": { "title": "Handle declined card with retry window", "rationale": "Most common payment failure" },
            "raised_by": "scenario-critic",
            "raised_at": "2026-07-04T04:05:00Z",
            "status": "pending",
            "resolution": null
          },
          {
            "id": "SUG-demo-002",
            "kind": "open_question",
            "proposed": { "title": "Should proration apply on mid-cycle upgrades?", "rationale": "Affects invoice amount" },
            "raised_by": "domain-expert@openrouter/google/gemini-2.5-flash",
            "raised_at": "2026-07-04T04:06:00Z",
            "status": "accepted",
            "resolution": { "by": "human-viewer", "at": "2026-07-04T05:00:00Z", "note": "Yes, prorate daily" }
          }
        ],
        "contributors": [
          { "agent": "scenario-discovery", "role": "discovery", "provider_model": null, "ran_at": "2026-07-04T04:00:00Z", "verdict": "drafted" },
          { "agent": "scenario-critic", "role": "completeness_review", "provider_model": null, "ran_at": "2026-07-04T04:05:00Z", "verdict": "needs_more_edge_cases" }
        ]
      },
      "provenance": { "source": "interview-2026-07-04", "confidence": 0.9, "human_validated": false }
    },
    {
      "id": "SC-demo-002",
      "title": "System retries failed payment nightly (batch)",
      "phase_origin": 1,
      "status": "draft",
      "business": {
        "actor": "Billing batch job",
        "goal": "Recover failed payments without user action",
        "trigger": "Nightly schedule 02:00",
        "preconditions": ["invoice in failed state"],
        "postconditions": ["invoice=paid or retry_count+1"],
        "business_value": "Reduce involuntary churn",
        "priority": "medium",
        "has_ui": false,
        "domain_concepts": ["Invoice", "PaymentRetry"]
      },
      "traces_down": {
        "user_stories": [], "use_cases": [], "acceptance_criteria": [],
        "entities": [], "pages": [], "apis": [], "features": [], "test_scenarios": []
      },
      "analysis": {
        "completeness": { "score": null, "scored_by": null, "scored_at": null, "gaps": [] },
        "suggestions": [],
        "contributors": [
          { "agent": "scenario-discovery", "role": "discovery", "provider_model": null, "ran_at": "2026-07-04T04:01:00Z", "verdict": "drafted" }
        ]
      },
      "provenance": { "source": "interview-2026-07-04", "confidence": 0.7, "human_validated": false }
    }
  ],
  "rollup": {
    "total": 2,
    "by_status": { "needs_review": 1, "draft": 1 },
    "avg_completeness": 0.72,
    "open_gaps_high": 1,
    "pending_suggestions": 1,
    "ready_for_next_phase": false
  }
}
```

- [ ] **Step 2: Verify it parses**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('plugins/scenario-discovery/assets/viewer/fixtures/scenarios.sample.json','utf8')); console.log(d.scenarios.length, d.rollup.pending_suggestions)"`
Expected: `2 1`

- [ ] **Step 3: Commit**

```bash
git add plugins/scenario-discovery/assets/viewer/fixtures/scenarios.sample.json
git commit -m "feat(viewer): add scenarios.json sample fixture covering every node type"
```

---

### Task 2: server.mjs pure logic — parseArgs, recomputeRollup, applyAction, atomicWrite

**Files:**
- Create: `plugins/scenario-discovery/assets/viewer/server.mjs`
- Create: `plugins/scenario-discovery/assets/viewer/server.test.mjs`

**Interfaces:**
- Consumes: fixture from Task 1.
- Produces (exact exports later tasks import from `./server.mjs`):
  - `parseArgs(argv: string[]) => { file: string|null, port: number, open: boolean, snapshot: boolean }` — flags `--file <v>`, `--port <n>`, `--open`, `--snapshot`; defaults `{file:null, port:0, open:false, snapshot:false}`.
  - `recomputeRollup(doc) => rollup` — mutates `doc.rollup` per schema.md formula and returns it.
  - `applyAction(doc, action) => { ok:true } | { ok:false, status:number, error:string }` — mutates `doc` for whitelisted actions only, then calls `recomputeRollup`. `action = { type, payload }` (mtime checking is NOT this function's job — that is HTTP-layer, Task 3).
  - `atomicWrite(file, doc) => void` — `JSON.stringify(doc, null, 2) + '\n'` to `` `${file}.tmp-${process.pid}` `` then `renameSync` over `file`.
  - The module must have a main-guard (`resolve(process.argv[1]) === fileURLToPath(import.meta.url)`) so importing it never starts a server.

- [ ] **Step 1: Write the failing tests (this exact code)**

```js
// plugins/scenario-discovery/assets/viewer/server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, recomputeRollup, applyAction, atomicWrite } from './server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'fixtures', 'scenarios.sample.json');

function loadFixture() { return JSON.parse(readFileSync(FIXTURE, 'utf8')); }
function tempCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'sf-viewer-'));
  const file = join(dir, 'scenarios.json');
  copyFileSync(FIXTURE, file);
  return file;
}

test('parseArgs: defaults and all flags', () => {
  assert.deepEqual(parseArgs([]), { file: null, port: 0, open: false, snapshot: false });
  assert.deepEqual(
    parseArgs(['--file', 'a.json', '--port', '8123', '--open', '--snapshot']),
    { file: 'a.json', port: 8123, open: true, snapshot: true }
  );
});

test('recomputeRollup: counts statuses, high gaps, pending suggestions from fixture', () => {
  const doc = loadFixture();
  const r = recomputeRollup(doc);
  assert.equal(r.total, 2);
  assert.deepEqual(r.by_status, { needs_review: 1, draft: 1 });
  assert.equal(r.avg_completeness, 0.72);
  assert.equal(r.open_gaps_high, 1);
  assert.equal(r.pending_suggestions, 1);
  assert.equal(r.ready_for_next_phase, false);
});

test('recomputeRollup: avg_completeness is null when no critic scores', () => {
  const doc = loadFixture();
  doc.scenarios.forEach(s => { s.analysis.completeness.score = null; });
  assert.equal(recomputeRollup(doc).avg_completeness, null);
});

test('recomputeRollup: empty scenarios → total 0, not ready', () => {
  const r = recomputeRollup({ scenarios: [] });
  assert.equal(r.total, 0);
  assert.equal(r.avg_completeness, null);
  assert.equal(r.ready_for_next_phase, false);
});

test('recomputeRollup: ready only when no high gaps, no pending suggestions, all validated', () => {
  const doc = loadFixture();
  doc.scenarios[0].analysis.completeness.gaps =
    doc.scenarios[0].analysis.completeness.gaps.filter(g => g.severity !== 'high');
  doc.scenarios[0].analysis.suggestions.forEach(s => { if (s.status === 'pending') s.status = 'rejected'; });
  doc.scenarios.forEach(s => { s.provenance.human_validated = true; });
  assert.equal(recomputeRollup(doc).ready_for_next_phase, true);
});

test('applyAction: rejects non-whitelisted type with 400', () => {
  const doc = loadFixture();
  const res = applyAction(doc, { type: 'edit_field', payload: { scenario_id: 'SC-demo-001' } });
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

test('applyAction: unknown scenario id → 404', () => {
  const doc = loadFixture();
  const res = applyAction(doc, { type: 'set_human_validated', payload: { scenario_id: 'SC-nope-999', value: true } });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
});

test('applyAction: suggestion_decision sets status + resolution and updates rollup', () => {
  const doc = loadFixture();
  const res = applyAction(doc, {
    type: 'suggestion_decision',
    payload: { scenario_id: 'SC-demo-001', suggestion_id: 'SUG-demo-001', status: 'accepted', resolution: 'good idea' }
  });
  assert.equal(res.ok, true);
  const sug = doc.scenarios[0].analysis.suggestions.find(s => s.id === 'SUG-demo-001');
  assert.equal(sug.status, 'accepted');
  assert.equal(sug.resolution.by, 'human-viewer');
  assert.equal(sug.resolution.note, 'good idea');
  assert.match(sug.resolution.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(doc.rollup.pending_suggestions, 0);
});

test('applyAction: suggestion_decision rejects status outside accepted|rejected', () => {
  const doc = loadFixture();
  const res = applyAction(doc, {
    type: 'suggestion_decision',
    payload: { scenario_id: 'SC-demo-001', suggestion_id: 'SUG-demo-001', status: 'merged', resolution: '' }
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

test('applyAction: set_human_validated toggles and recomputes rollup', () => {
  const doc = loadFixture();
  const res = applyAction(doc, { type: 'set_human_validated', payload: { scenario_id: 'SC-demo-002', value: true } });
  assert.equal(res.ok, true);
  assert.equal(doc.scenarios[1].provenance.human_validated, true);
  assert.equal(doc.rollup.ready_for_next_phase, false); // SC-demo-001 still has a high gap + pending sug
});

test('atomicWrite: writes pretty JSON and leaves no temp file behind', () => {
  const file = tempCopy();
  const doc = loadFixture();
  doc.meta.status = 'validated';
  atomicWrite(file, doc);
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(onDisk.meta.status, 'validated');
  assert.deepEqual(readdirSync(dirname(file)).filter(f => f.includes('.tmp-')), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: FAIL — `Cannot find module ... server.mjs`

- [ ] **Step 3: Implement server.mjs (Opus authors the code)**

Requirements beyond the Interfaces block:
- `recomputeRollup`: `by_status` counts `scenario.status`; `avg_completeness` = mean of numeric `analysis.completeness.score` values (null when none); `open_gaps_high` counts gaps with `severity === "high"`; `pending_suggestions` counts suggestions with `status === "pending"`; `ready_for_next_phase` = `open_gaps_high === 0 && pending_suggestions === 0 && scenarios.length > 0 && every provenance.human_validated === true`. Use optional chaining — every nested node may be missing.
- `applyAction` whitelist is a closed `if/else if/else` — the `else` branch returns `{ ok:false, status:400, error }`. `suggestion_decision` sets `sug.status` and `sug.resolution = { by: 'human-viewer', at: new Date().toISOString(), note: payload.resolution ?? '' }`. `set_human_validated` requires `typeof payload.value === 'boolean'` (else 400).
- Do not add any other mutation path — this function is the security boundary the spec's whitelist rule lives in.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/scenario-discovery/assets/viewer/server.mjs plugins/scenario-discovery/assets/viewer/server.test.mjs
git commit -m "feat(viewer): server core — args, rollup recompute, whitelisted actions, atomic write"
```

---

### Task 3: HTTP server + main entry (live mode)

**Files:**
- Modify: `plugins/scenario-discovery/assets/viewer/server.mjs`
- Modify: `plugins/scenario-discovery/assets/viewer/server.test.mjs` (append)

**Interfaces:**
- Consumes: Task 2 exports.
- Produces:
  - `createViewerServer(file: string) => http.Server` (not yet listening).
  - HTTP contract (binding, viewer.html in Task 4 depends on it):
    - `GET /` → 200 `text/html` — contents of `viewer.html` (path resolved relative to `server.mjs` via `import.meta.url`).
    - `GET /api/scenarios` → 200 `{ ok:true, mtimeMs:number, data:<file JSON> }`; 404 `{ ok:false, error }` when file missing; 422 `{ ok:false, error:"invalid JSON: ..." }` when unparseable.
    - `POST /api/action` body `{ type, mtimeMs, payload }` → 409 `{ ok:false, error }` when `mtimeMs !== statSync(file).mtimeMs`; otherwise `applyAction` (its `status` on failure passes through); on success `atomicWrite` then 200 `{ ok:true, mtimeMs:<new>, data:<updated doc> }`.
    - Anything else → 404. All JSON responses `content-type: application/json; charset=utf-8`.
  - Main entry (behind the main-guard): missing/nonexistent `--file` → usage message on stderr, exit 1. Live mode: `server.listen(args.port, '127.0.0.1')`, print `ScenarioForge viewer: http://127.0.0.1:<port>/`, and when `--open` launch the browser (`cmd /c start "" <url>` on win32, `open` on darwin, `xdg-open` otherwise, spawned detached + unref).

- [ ] **Step 1: Append the failing tests (this exact code)**

```js
// append to server.test.mjs; extend the server.mjs import line with createViewerServer
import { createViewerServer } from './server.mjs'; // merge into the existing import statement

async function withServer(file, fn) {
  const server = createViewerServer(file);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise(r => server.close(r)); }
}

test('GET /api/scenarios returns data and mtime token', async () => {
  const file = tempCopy();
  await withServer(file, async base => {
    const res = await fetch(`${base}/api/scenarios`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.data.meta.module, 'demo');
    assert.equal(typeof body.mtimeMs, 'number');
  });
});

test('GET /api/scenarios: missing file → 404', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-viewer-'));
  await withServer(join(dir, 'scenarios.json'), async base => {
    assert.equal((await fetch(`${base}/api/scenarios`)).status, 404);
  });
});

test('GET /api/scenarios: broken JSON → 422 with message', async () => {
  const file = tempCopy();
  writeFileSync(file, '{ broken', 'utf8');
  await withServer(file, async base => {
    const res = await fetch(`${base}/api/scenarios`);
    assert.equal(res.status, 422);
    assert.match((await res.json()).error, /invalid JSON/);
  });
});

test('POST /api/action: stale mtimeMs → 409 and file untouched', async () => {
  const file = tempCopy();
  const before = readFileSync(file, 'utf8');
  await withServer(file, async base => {
    const res = await fetch(`${base}/api/action`, {
      method: 'POST',
      body: JSON.stringify({ type: 'set_human_validated', mtimeMs: -1, payload: { scenario_id: 'SC-demo-001', value: true } })
    });
    assert.equal(res.status, 409);
  });
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('POST /api/action: non-whitelisted type → 400 and file untouched', async () => {
  const file = tempCopy();
  const before = readFileSync(file, 'utf8');
  await withServer(file, async base => {
    const { mtimeMs } = await (await fetch(`${base}/api/scenarios`)).json();
    const res = await fetch(`${base}/api/action`, {
      method: 'POST',
      body: JSON.stringify({ type: 'edit_field', mtimeMs, payload: { scenario_id: 'SC-demo-001' } })
    });
    assert.equal(res.status, 400);
  });
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('POST /api/action: valid decision persists to disk with recomputed rollup', async () => {
  const file = tempCopy();
  await withServer(file, async base => {
    const { mtimeMs } = await (await fetch(`${base}/api/scenarios`)).json();
    const res = await fetch(`${base}/api/action`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'suggestion_decision', mtimeMs,
        payload: { scenario_id: 'SC-demo-001', suggestion_id: 'SUG-demo-001', status: 'rejected', resolution: 'out of scope' }
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    const onDisk = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(onDisk.scenarios[0].analysis.suggestions[0].status, 'rejected');
    assert.equal(onDisk.rollup.pending_suggestions, 0);
    assert.equal(body.mtimeMs, (await import('node:fs')).statSync(file).mtimeMs);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: Task 2 tests PASS; new tests FAIL (`createViewerServer` not exported)

- [ ] **Step 3: Implement createViewerServer + main entry (Opus authors the code)**

Implementation cautions (binding):
- The `POST` body arrives via `req.on('data'/'end')` callbacks — the request handler's outer `try/catch` cannot catch errors thrown there. Wrap the `end` callback body in its **own** try/catch (map `ENOENT` → 404, anything else → 500).
- Read the file fresh on every request — never cache the parsed doc (agents edit it concurrently).
- `GET /` reads `viewer.html` at request time (Task 4 creates it; until then the route may 404 via the ENOENT mapping — acceptable).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/scenario-discovery/assets/viewer/server.mjs plugins/scenario-discovery/assets/viewer/server.test.mjs
git commit -m "feat(viewer): HTTP server with whitelisted action API and mtime conflict handling"
```

---

### Task 4: viewer.html — live UI

**Files:**
- Create: `plugins/scenario-discovery/assets/viewer/viewer.html`
- Modify: `plugins/scenario-discovery/assets/viewer/server.test.mjs` (append)

**Interfaces:**
- Consumes: HTTP contract from Task 3 (`GET /api/scenarios`, `POST /api/action` with `{type, mtimeMs, payload}`).
- Produces: DOM/document contract (binding — snapshot Task 5 and tests depend on it):
  - Required element ids: `sf-meta`, `sf-rollup`, `sf-filters`, `sf-search`, `sf-error`, `sf-cards`, and the empty placeholder `<script id="sf-data" type="application/json"></script>`.
  - All code that references `/api/` lives strictly inside one or more blocks delimited by the exact markers `<!--LIVE-ONLY-START-->` and `<!--LIVE-ONLY-END-->`, and defines `window.SF_LIVE = { start, postAction }`.
  - Core (non-live) script boot logic: if `#sf-data` has non-empty text → snapshot mode: parse it, `document.body.classList.add('snapshot')`, `render(doc, { live:false })`; else → `window.SF_LIVE.start()`.

- [ ] **Step 1: Append the failing tests (this exact code)**

```js
// append to server.test.mjs
test('GET / serves viewer.html with required element ids', async () => {
  const file = tempCopy();
  await withServer(file, async base => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    for (const id of ['sf-data', 'sf-meta', 'sf-rollup', 'sf-filters', 'sf-search', 'sf-error', 'sf-cards']) {
      assert.ok(html.includes(`id="${id}"`), `missing id ${id}`);
    }
  });
});

test('viewer.html keeps every /api/ reference inside LIVE-ONLY blocks', () => {
  const viewer = readFileSync(join(__dirname, 'viewer.html'), 'utf8');
  assert.ok(viewer.includes('<!--LIVE-ONLY-START-->') && viewer.includes('<!--LIVE-ONLY-END-->'));
  const stripped = viewer.replace(/<!--LIVE-ONLY-START-->[\s\S]*?<!--LIVE-ONLY-END-->/g, '');
  assert.ok(!stripped.includes('/api/'), 'found /api/ outside LIVE-ONLY blocks');
});

test('viewer.html references no external URLs', () => {
  const viewer = readFileSync(join(__dirname, 'viewer.html'), 'utf8');
  assert.ok(!/\b(src|href)\s*=\s*["']https?:/i.test(viewer), 'external resource reference found');
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: the three new tests FAIL (viewer.html missing)

- [ ] **Step 3: Implement viewer.html (Opus authors the code — UI design is Opus's to shape now and after field testing, within this contract)**

Skeleton order (binding): `header#sf-meta`, `section#sf-rollup`, `section#sf-filters` (containing `#sf-search` plus selects/checkboxes below), `div#sf-error hidden`, `main#sf-cards`, then `script#sf-data`, then the core `<script>`, then the LIVE-ONLY block.

Core rendering requirements:
1. `render(doc, {live})` draws everything from scratch into the three regions; `esc()` every dynamic string.
2. `#sf-meta`: module, `meta.status`, `effort_scale`, `generated_at` (readable Thai date).
3. `#sf-rollup` tiles: total, by_status chips, avg_completeness (as %, `—` when null), open_gaps_high, pending_suggestions, and a green/red pill for `ready_for_next_phase`.
4. Filters (AND-combined, re-render on change): `#sf-search` matches id/title/business.actor/business.goal case-insensitively; `select#sf-filter-status` (ทั้งหมด/draft/needs_review/validated/locked); `select#sf-filter-priority` (ทั้งหมด/high/medium/low); `input#sf-filter-gaps` (has ≥1 gap); `input#sf-filter-sugs` (has ≥1 pending suggestion).
5. Each scenario → `<details class="scenario" data-key="<id>">` with `<summary>`: id, title, badges for priority, status, completeness % (`—` when null), and has_ui (🖥️ UI / ⚙️ batch). Inside, nested `<details data-key="<id>/<section>">` in order: business, traces_down, analysis, contributors, provenance.
   - business: label/value rows for all fields; arrays as bullet lists.
   - traces_down: only non-empty arrays; if all empty show "ยังไม่มีการเชื่อมโยงจากเฟสถัดไป".
   - analysis: gaps sorted high→medium→low with severity badge, type, detail, raised_by; suggestions with kind, status, proposed.title, proposed.rationale, raised_by, resolution note when present. When `live && sug.status === 'pending'`: a note `<input>` plus ยอมรับ/ปฏิเสธ buttons calling `window.SF_LIVE.postAction('suggestion_decision', {scenario_id, suggestion_id, status, resolution: note})`.
   - contributors: small table (agent, role, provider_model, ran_at, verdict).
   - provenance: source, confidence, and a human_validated checkbox — enabled only in live mode, wired to `postAction('set_human_validated', {scenario_id, value})`; render as plain ✓/✗ text in snapshot mode.
6. Expand/collapse state survives re-render: before rendering collect the `data-key` of every open `<details>` into a Set, re-apply after.
7. Print: `@media print` hides `#sf-filters` and all buttons/inputs; `beforeprint` opens all `<details>`, `afterprint` restores the saved state.
7b. Unknown schema version: when `meta.schema_version` does not start with `"1."`, still render everything best-effort but show a warning banner in `#sf-error`: "เอกสารนี้ใช้ schema เวอร์ชัน <version> ซึ่ง viewer ยังไม่รู้จัก — การแสดงผลอาจไม่ครบถ้วน" (banner does not block rendering).
8. Thai labels (binding minimum): โมดูล, ทั้งหมด, คะแนนความครบถ้วนเฉลี่ย, gap ร้ายแรงค้าง, ข้อเสนอค้างตัดสิน, พร้อมเข้าเฟสถัดไป, ยังไม่พร้อม, ค้นหา, สถานะ, ความสำคัญ, มี gap, มีข้อเสนอค้าง, ข้อมูลธุรกิจ, การเชื่อมโยงเฟสถัดไป, ผลวิเคราะห์, ผู้ร่วมวิเคราะห์, ที่มา, ยอมรับ, ปฏิเสธ, ยืนยันโดยมนุษย์ (human validated).

LIVE-ONLY block requirements:
1. `start()`: initial `GET /api/scenarios` → keep `mtimeMs`, `render(data, {live:true})`; then `setInterval` 2000 ms re-fetch — if `mtimeMs` changed, update and re-render. 404/422 → Thai message into `#sf-error` (404: แนะนำให้รัน scenario-discovery ก่อน; 422: แสดง parse error ที่ได้จาก server).
2. `postAction(type, payload)`: POST `{type, mtimeMs, payload}`; on 200 update `mtimeMs` + re-render from response `data`; on 409 show banner in `#sf-error`: "ไฟล์ถูกแก้ไขระหว่างทาง — กดรีเฟรชเพื่อโหลดข้อมูลล่าสุด" with a รีเฟรช button that re-fetches and clears the banner; other errors → show `error` text.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: PASS (20 tests)

- [ ] **Step 5: Manual UI checklist against the fixture**

Run: `node plugins/scenario-discovery/assets/viewer/server.mjs --file plugins/scenario-discovery/assets/viewer/fixtures/scenarios.sample.json --open`
Verify each item (fix before committing):
- Header shows module `demo`; rollup shows 2 / avg 72% / 1 high gap / 1 pending / red "ยังไม่พร้อม".
- Expanding SC-demo-001 shows all five sections; gaps ordered high→medium; SUG-demo-001 has ยอมรับ/ปฏิเสธ + note input; SUG-demo-002 shows its resolution note.
- Search "batch" leaves only SC-demo-002; priority filter high leaves only SC-demo-001.
- Clicking ยอมรับ with a note updates the file on disk (check git-ignored temp copy or revert after) and pending count drops to 0 without collapsing open cards.
- Editing the file externally (change a title, save) refreshes the UI within ~2 s, preserving open cards.
- Print preview: filters/buttons hidden, all sections expanded.
- **Revert fixture changes before committing:** `git checkout -- plugins/scenario-discovery/assets/viewer/fixtures/scenarios.sample.json`

- [ ] **Step 6: Commit**

```bash
git add plugins/scenario-discovery/assets/viewer/viewer.html plugins/scenario-discovery/assets/viewer/server.test.mjs
git commit -m "feat(viewer): single-file live viewer UI with collapsible nodes, filters, write-back"
```

---

### Task 5: Snapshot export

**Files:**
- Modify: `plugins/scenario-discovery/assets/viewer/server.mjs`
- Modify: `plugins/scenario-discovery/assets/viewer/server.test.mjs` (append)

**Interfaces:**
- Consumes: `viewer.html` contract (markers, `#sf-data` placeholder), `parseArgs`.
- Produces: `makeSnapshot(viewerHtml: string, doc: object) => string`, exported from `server.mjs`; CLI branch `--snapshot` writing `scenarios-report.html` beside the source file, then exiting without serving.

- [ ] **Step 1: Append the failing tests (this exact code)**

```js
// append to server.test.mjs; extend the server.mjs import line with makeSnapshot
import { makeSnapshot } from './server.mjs'; // merge into the existing import statement
import { execFileSync } from 'node:child_process';

test('makeSnapshot embeds data and strips all live-only code', () => {
  const viewer = readFileSync(join(__dirname, 'viewer.html'), 'utf8');
  const out = makeSnapshot(viewer, loadFixture());
  assert.ok(!out.includes('LIVE-ONLY'));
  assert.ok(!out.includes('/api/'));
  assert.ok(out.includes('SC-demo-001'));
  assert.ok(out.includes('<script id="sf-data" type="application/json">'));
});

test('makeSnapshot escapes < so data cannot break out of the script tag', () => {
  const viewer = readFileSync(join(__dirname, 'viewer.html'), 'utf8');
  const doc = loadFixture();
  doc.scenarios[0].title = 'x</script><script>alert(1)</script>';
  const out = makeSnapshot(viewer, doc);
  assert.ok(!out.includes('</script><script>alert(1)</script>'));
});

test('--snapshot CLI writes scenarios-report.html next to the source file', () => {
  const file = tempCopy();
  execFileSync(process.execPath, [join(__dirname, 'server.mjs'), '--file', file, '--snapshot']);
  const out = readFileSync(join(dirname(file), 'scenarios-report.html'), 'utf8');
  assert.ok(out.includes('SC-demo-001'));
  assert.ok(!out.includes('LIVE-ONLY'));
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: new tests FAIL (`makeSnapshot` not exported)

- [ ] **Step 3: Implement makeSnapshot + CLI branch (Opus authors the code)**

Reference snippet (binding behavior):

```js
export function makeSnapshot(viewerHtml, doc) {
  const stripped = viewerHtml.replace(/<!--LIVE-ONLY-START-->[\s\S]*?<!--LIVE-ONLY-END-->/g, '');
  const json = JSON.stringify(doc).replace(/</g, '\\u003c');
  return stripped.replace(
    '<script id="sf-data" type="application/json"></script>',
    `<script id="sf-data" type="application/json">${json}</script>`
  );
}
```

CLI branch: when `args.snapshot`, parse the file (a parse failure prints the error and exits 1), write `makeSnapshot(...)` to `scenarios-report.html` in the source file's directory, print the output path, and do not start a server.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: PASS (23 tests)

- [ ] **Step 5: Manual check — open the snapshot from file://**

Run the CLI against the fixture, open the generated `scenarios-report.html` in a browser directly from disk. Verify it renders identically to live mode minus buttons/checkbox (plain ✓/✗), and works with no server running. Delete the generated file afterwards.

- [ ] **Step 6: Commit**

```bash
git add plugins/scenario-discovery/assets/viewer/server.mjs plugins/scenario-discovery/assets/viewer/server.test.mjs
git commit -m "feat(viewer): read-only snapshot export with live code structurally stripped"
```

---

### Task 6: Plugin command + docs + version bump

**Files:**
- Create: `plugins/scenario-discovery/commands/view.md`
- Modify: `plugins/scenario-discovery/USAGE.md` (append section)
- Modify: `plugins/scenario-discovery/.claude-plugin/plugin.json` (minor version bump)

**Interfaces:**
- Consumes: `server.mjs` CLI (`--file`, `--open`, `--snapshot`).
- Produces: user-facing command `/scenario-discovery:view [snapshot]`.

- [ ] **Step 1: Write commands/view.md (this exact content)**

```markdown
---
description: Open a human-readable viewer for scenarios.json (live) or export a read-only client snapshot
argument-hint: "[snapshot]"
---

# /view — scenarios.json viewer

Open the ScenarioForge viewer for this project's `scenarios.json`.

## Steps

1. Locate `scenarios.json`: check the project root first; otherwise Glob `**/scenarios.json`
   (skip `node_modules` and the plugin's own `fixtures/`). If several are found, list them
   and ask the user which one. If none exist, tell the user to run scenario-discovery
   first, and stop.
2. Mode:
   - **No argument → live mode.** Run in the background:
     `node "${CLAUDE_PLUGIN_ROOT}/assets/viewer/server.mjs" --file "<path>" --open`
     Report the printed URL. Leave the server running. Tell the user that actions in the
     viewer (accept/reject suggestions, human_validated) write back to `scenarios.json`
     with the rollup recomputed automatically.
   - **`snapshot` → client export.** Run:
     `node "${CLAUDE_PLUGIN_ROOT}/assets/viewer/server.mjs" --file "<path>" --snapshot`
     Report the generated `scenarios-report.html` path — a self-contained read-only file
     safe to send to clients (no server needed, opens from file://).
3. Do not pre-validate the JSON — the viewer renders parse errors in a friendly way itself.
```

- [ ] **Step 2: Append a "Viewer" section to USAGE.md (this exact content, translated framing kept consistent with the file's existing style)**

```markdown
## ดู scenarios.json แบบ human-readable — `/scenario-discovery:view`

- `/scenario-discovery:view` — เปิด viewer ใน browser (live): ดู node ย่อยทุกชั้น, filter/ค้นหา,
  กดยอมรับ/ปฏิเสธ suggestion และติ๊ก human_validated ได้ — เขียนกลับเข้าไฟล์ให้เอง พร้อมคำนวณ rollup ใหม่
- `/scenario-discovery:view snapshot` — สร้าง `scenarios-report.html` ไฟล์เดียวจบ (read-only)
  ส่งให้ลูกค้าเปิดดูได้เลย ไม่ต้องติดตั้งอะไร
```

- [ ] **Step 3: Bump plugin version**

Read `plugins/scenario-discovery/.claude-plugin/plugin.json`, bump the minor version (e.g. `0.3.0` → `0.4.0`), leave everything else untouched.

- [ ] **Step 4: Full test suite + smoke the command path manually**

Run: `node --test plugins/scenario-discovery/assets/viewer/server.test.mjs`
Expected: PASS (23 tests)
Then run the live-mode command exactly as view.md step 2 states (substituting the real plugin path) to confirm the doc's command line is correct as written.

- [ ] **Step 5: Commit**

```bash
git add plugins/scenario-discovery/commands/view.md plugins/scenario-discovery/USAGE.md plugins/scenario-discovery/.claude-plugin/plugin.json
git commit -m "feat(viewer): /view command, usage docs, plugin version bump"
```
