// plugins/scenario-discovery/assets/viewer/server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, recomputeRollup, applyAction, atomicWrite, createViewerServer } from './server.mjs';

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
