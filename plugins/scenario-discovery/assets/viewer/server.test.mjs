// plugins/scenario-discovery/assets/viewer/server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { parseArgs, recomputeRollup, applyAction, atomicWrite, createViewerServer, makeSnapshot } from './server.mjs';

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

test('recomputeRollup: avg_completeness is the raw (unrounded) mean of scores', () => {
  // Two scores 0.72 + 0.55 → 1.27 / 2 = 0.635. The old 2dp rounding would have
  // returned 0.64 (Math.round(63.5) = 64), so asserting exactly 0.635 pins the
  // raw mean.
  const doc = loadFixture();
  doc.scenarios[1].analysis.completeness.score = 0.55;
  assert.equal(recomputeRollup(doc).avg_completeness, 0.635);
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

// Raw HTTP request used where fetch/undici would strip or override the header we
// need to control — notably the forbidden `Host` header. Always connects to the
// loopback address; only the Host header is spoofed.
function rawRequest({ port, path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
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

test('POST /api/action: malformed JSON body → 400 (not 500) and file untouched', async () => {
  const file = tempCopy();
  const before = readFileSync(file, 'utf8');
  await withServer(file, async base => {
    const res = await fetch(`${base}/api/action`, { method: 'POST', body: '{ not json' });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /invalid JSON body/);
  });
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('POST /api/action: body over the size cap → 413 and file untouched', async () => {
  const file = tempCopy();
  const before = readFileSync(file, 'utf8');
  await withServer(file, async base => {
    // >1 MB payload: a single JSON string field padded past the cap.
    const big = JSON.stringify({ type: 'set_human_validated', mtimeMs: 0, payload: { note: 'x'.repeat(1_000_001) } });
    const res = await fetch(`${base}/api/action`, { method: 'POST', body: big });
    assert.equal(res.status, 413);
    assert.match((await res.json()).error, /payload too large/);
  });
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('foreign Host header → 403 and file untouched (loopback Host still 200 via existing GET test)', async () => {
  const file = tempCopy();
  const before = readFileSync(file, 'utf8');
  await withServer(file, async base => {
    const port = Number(new URL(base).port);
    // fetch/undici would drop a spoofed Host, so drive it with node:http.
    const res = await rawRequest({ port, path: '/api/scenarios', headers: { host: 'evil.example.com' } });
    assert.equal(res.status, 403);
    assert.match(JSON.parse(res.text).error, /forbidden host/);
  });
  // The positive path (loopback Host → 200) is covered by
  // 'GET /api/scenarios returns data and mtime token'.
  assert.equal(readFileSync(file, 'utf8'), before);
});

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

test('makeSnapshot: $-sequences in data cannot trigger replace-pattern injection', () => {
  const viewer = readFileSync(join(__dirname, 'viewer.html'), 'utf8');
  const doc = loadFixture();
  doc.scenarios[0].title = 'a$&b$`c</script>';
  const out = makeSnapshot(viewer, doc);
  const m = out.match(/<script id="sf-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'sf-data block present');
  // If a $& expanded the matched placeholder into the data, this JSON would be
  // truncated at the injected </script> and fail to parse.
  const parsed = JSON.parse(m[1]);
  assert.equal(parsed.scenarios[0].title, 'a$&b$`c</script>');
});

test('--snapshot CLI writes scenarios-report.html next to the source file', () => {
  const file = tempCopy();
  execFileSync(process.execPath, [join(__dirname, 'server.mjs'), '--file', file, '--snapshot']);
  const out = readFileSync(join(dirname(file), 'scenarios-report.html'), 'utf8');
  assert.ok(out.includes('SC-demo-001'));
  assert.ok(!out.includes('LIVE-ONLY'));
});
