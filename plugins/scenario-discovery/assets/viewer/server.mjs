// plugins/scenario-discovery/assets/viewer/server.mjs
//
// ScenarioForge Viewer — core pure logic.
//
// This module holds the framework-free, dependency-free primitives the viewer
// is built on: CLI argument parsing, the rollup read-model recompute, the
// whitelisted mutation applier (the security boundary), and an atomic file
// write. Later tasks add the HTTP layer (createViewerServer) and snapshot
// export to this same file and import the exports below — so importing this
// module must never start a server. A main-guard at the bottom enforces that.
//
// Zero dependencies: node: builtins only. ES module. Node >= 18.

import { writeFileSync, renameSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Parse the viewer CLI flags.
 *
 * Flags: --file <v>, --port <n>, --open, --snapshot.
 * Defaults: { file: null, port: 0, open: false, snapshot: false }.
 *
 * @param {string[]} argv
 * @returns {{ file: string|null, port: number, open: boolean, snapshot: boolean }}
 */
export function parseArgs(argv) {
  const opts = { file: null, port: 0, open: false, snapshot: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') {
      opts.file = argv[++i] ?? null;
    } else if (arg === '--port') {
      opts.port = Number(argv[++i]);
    } else if (arg === '--open') {
      opts.open = true;
    } else if (arg === '--snapshot') {
      opts.snapshot = true;
    }
    // unknown tokens are ignored
  }
  return opts;
}

/**
 * Recompute the rollup read-model from the scenarios array.
 *
 * Mutates doc.rollup in place (so callers holding a reference to doc see the
 * fresh value) and returns it. Every nested node may be missing, so all access
 * is defensive via optional chaining.
 *
 * @param {object} doc
 * @returns {object} the new rollup
 */
export function recomputeRollup(doc) {
  const scenarios = doc?.scenarios ?? [];

  const by_status = {};
  let openGapsHigh = 0;
  let pendingSuggestions = 0;
  const scores = [];
  let allValidated = true;

  for (const s of scenarios) {
    const status = s?.status;
    if (status != null) by_status[status] = (by_status[status] ?? 0) + 1;

    const score = s?.analysis?.completeness?.score;
    if (typeof score === 'number') scores.push(score);

    for (const gap of s?.analysis?.completeness?.gaps ?? []) {
      if (gap?.severity === 'high') openGapsHigh++;
    }

    for (const sug of s?.analysis?.suggestions ?? []) {
      if (sug?.status === 'pending') pendingSuggestions++;
    }

    if (s?.provenance?.human_validated !== true) allValidated = false;
  }

  const avg_completeness = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : null;

  const rollup = {
    total: scenarios.length,
    by_status,
    avg_completeness,
    open_gaps_high: openGapsHigh,
    pending_suggestions: pendingSuggestions,
    ready_for_next_phase:
      openGapsHigh === 0 &&
      pendingSuggestions === 0 &&
      scenarios.length > 0 &&
      allValidated,
  };

  doc.rollup = rollup;
  return rollup;
}

/**
 * Apply a whitelisted mutation to doc, then recompute the rollup.
 *
 * This is the security boundary. It accepts exactly two action types; anything
 * else falls through to the else branch and is rejected with 400. Do not add
 * any other mutation path here. mtime / conflict checking is the HTTP layer's
 * job (Task 3), not this function's.
 *
 * @param {object} doc
 * @param {{ type: string, payload: object }} action
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function applyAction(doc, action) {
  const { type, payload = {} } = action ?? {};

  if (type === 'suggestion_decision') {
    if (payload.status !== 'accepted' && payload.status !== 'rejected') {
      return { ok: false, status: 400, error: 'status must be accepted or rejected' };
    }
    const scenario = (doc?.scenarios ?? []).find(s => s?.id === payload.scenario_id);
    if (!scenario) {
      return { ok: false, status: 404, error: `scenario not found: ${payload.scenario_id}` };
    }
    const sug = (scenario.analysis?.suggestions ?? []).find(s => s?.id === payload.suggestion_id);
    if (!sug) {
      return { ok: false, status: 404, error: `suggestion not found: ${payload.suggestion_id}` };
    }
    sug.status = payload.status;
    sug.resolution = {
      by: 'human-viewer',
      at: new Date().toISOString(),
      note: payload.resolution ?? '',
    };
  } else if (type === 'set_human_validated') {
    if (typeof payload.value !== 'boolean') {
      return { ok: false, status: 400, error: 'value must be a boolean' };
    }
    const scenario = (doc?.scenarios ?? []).find(s => s?.id === payload.scenario_id);
    if (!scenario) {
      return { ok: false, status: 404, error: `scenario not found: ${payload.scenario_id}` };
    }
    scenario.provenance = scenario.provenance ?? {};
    scenario.provenance.human_validated = payload.value;
  } else {
    return { ok: false, status: 400, error: `unknown action type: ${type}` };
  }

  recomputeRollup(doc);
  return { ok: true };
}

/**
 * Atomically write doc as pretty JSON to file.
 *
 * Writes to a per-process temp sibling then renames over the target, so a
 * reader never observes a partially written file.
 *
 * @param {string} file
 * @param {object} doc
 * @returns {void}
 */
export function atomicWrite(file, doc) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  renameSync(tmp, file);
}

// The viewer HTML is served from disk next to this module. It is read fresh on
// every GET / (Task 4 authors it); until then that route 404s via ENOENT.
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML_FILE = join(HERE, 'viewer.html');

/**
 * Send an object as a JSON response with the canonical content-type.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} body
 * @returns {void}
 */
function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/**
 * Build the viewer's HTTP server (not yet listening).
 *
 * Routes:
 *   GET  /                → 200 text/html (contents of viewer.html)
 *   GET  /api/scenarios   → 200 { ok, mtimeMs, data } | 404 missing | 422 bad JSON
 *   POST /api/action      → 409 stale mtime | applyAction status on failure |
 *                           200 { ok, mtimeMs, data } on success (atomic write)
 *   anything else         → 404
 *
 * The file backing `/api/scenarios` and `/api/action` is read fresh on every
 * request — never cached — because agents may edit it concurrently.
 *
 * @param {string} file  path to the scenarios JSON document
 * @returns {import('node:http').Server}
 */
export function createViewerServer(file) {
  return createServer((req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://127.0.0.1');

      if (req.method === 'GET' && pathname === '/') {
        // Read viewer.html at request time. Missing → 404 (Task 4 adds it).
        try {
          const html = readFileSync(HTML_FILE);
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('viewer.html not found');
          } else {
            sendJson(res, 500, { ok: false, error: err.message });
          }
        }
        return;
      }

      if (req.method === 'GET' && pathname === '/api/scenarios') {
        // Read the file fresh; ENOENT → 404. Keep this try/catch separate from
        // JSON parsing so a parse error can never reach the ENOENT branch.
        let mtimeMs, raw;
        try {
          mtimeMs = statSync(file).mtimeMs;
          raw = readFileSync(file, 'utf8');
        } catch (err) {
          if (err.code === 'ENOENT') {
            sendJson(res, 404, { ok: false, error: `file not found: ${file}` });
          } else {
            sendJson(res, 500, { ok: false, error: err.message });
          }
          return;
        }
        let data;
        try {
          data = JSON.parse(raw);
        } catch (err) {
          sendJson(res, 422, { ok: false, error: `invalid JSON: ${err.message}` });
          return;
        }
        sendJson(res, 200, { ok: true, mtimeMs, data });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/action') {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          // The outer try/catch cannot see errors thrown in this async
          // callback, so it needs its own. Map ENOENT → 404, anything else
          // (bad body JSON, write failures, …) → 500.
          try {
            const action = JSON.parse(Buffer.concat(chunks).toString('utf8'));

            // Optimistic-concurrency gate: reject before any mutation if the
            // caller's token no longer matches the file on disk.
            const current = statSync(file).mtimeMs;
            if (action.mtimeMs !== current) {
              sendJson(res, 409, { ok: false, error: 'file changed on disk; reload before retrying' });
              return;
            }

            const doc = JSON.parse(readFileSync(file, 'utf8'));
            const result = applyAction(doc, { type: action.type, payload: action.payload });
            if (!result.ok) {
              sendJson(res, result.status, { ok: false, error: result.error });
              return;
            }

            atomicWrite(file, doc);
            sendJson(res, 200, { ok: true, mtimeMs: statSync(file).mtimeMs, data: doc });
          } catch (err) {
            if (err.code === 'ENOENT') {
              sendJson(res, 404, { ok: false, error: `file not found: ${file}` });
            } else {
              sendJson(res, 500, { ok: false, error: err.message });
            }
          }
        });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
  });
}

/**
 * Open a URL in the platform's default browser, detached from this process.
 *
 * @param {string} url
 * @returns {void}
 */
function openBrowser(url) {
  let cmd, cmdArgs;
  if (process.platform === 'win32') {
    cmd = 'cmd';
    cmdArgs = ['/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    cmdArgs = [url];
  } else {
    cmd = 'xdg-open';
    cmdArgs = [url];
  }
  const child = spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore' });
  child.unref();
}

// Main-guard: only run CLI behaviour when this file is the entry point, never
// on import (importing this module must never start a server).
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file || !existsSync(args.file)) {
    process.stderr.write(
      'usage: node server.mjs --file <scenarios.json> [--port <n>] [--open]\n'
    );
    process.exit(1);
  }

  const server = createViewerServer(args.file);
  server.listen(args.port, '127.0.0.1', () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/`;
    process.stdout.write(`ScenarioForge viewer: ${url}\n`);
    if (args.open) openBrowser(url);
  });
}
