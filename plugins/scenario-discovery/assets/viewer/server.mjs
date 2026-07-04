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

import { writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
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

// Main-guard: only run CLI behaviour when this file is the entry point, never
// on import. Task 3 replaces this block with real HTTP server wiring.
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  parseArgs(process.argv.slice(2));
  process.stderr.write('scenarioforge viewer: HTTP server is wired up in a later task\n');
}
