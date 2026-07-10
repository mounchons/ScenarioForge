#!/usr/bin/env node
/**
 * verify-spine.mjs — cross-phase spine integrity checker (orchestrator / ScenarioForge)
 *
 * Deterministic, read-only. Verifies that the artifacts the phases produced actually LINK —
 * every traces_down ref resolves, every registry file exists, every ledger's rollup matches its
 * rows, and a green QA rollup is backed by run evidence. Sections SKIP cleanly when a phase's
 * artifact does not exist yet (mid-pipeline is a valid state).
 *
 * Usage:   node verify-spine.mjs [projectRoot] [--strict]
 *          (default projectRoot = CWD; --strict turns warnings into failures)
 * Exit:    0 = PASS (warnings allowed unless --strict) · 1 = violations · 2 = parse/read error
 *
 * Sections:
 *   S1 scenarios.json        — parses, unique ids, traces_down present
 *   S2 design/registry.json  — files on disk, scenario_refs resolve
 *   S3 traces_down links     — entities/use_cases/pages/apis/features/test_scenarios resolve
 *   S4 features ledgers      — features.json rollup vs statuses vs .scenarioforge/impl-progress.json (+deferred[])
 *   S5 ui-control manifests  — parse, feature_id resolves, every control has a data-testid selector
 *   S6 qa-tracker            — rollup vs statuses, gate_4 math, release_ready honesty, run evidence,
 *                              meta.run_status agreement
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const root = args.find((a) => !a.startsWith("--")) ?? ".";

const errors = [];
const warnings = [];
const infos = [];
const err = (s, m) => errors.push(`[${s}] ${m}`);
const warn = (s, m) => warnings.push(`[${s}] ${m}`);
const info = (s, m) => infos.push(`[${s}] ${m}`);

function loadJson(rel, required = false) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    if (required) { console.error(`READ-ERROR: required file missing: ${rel}`); process.exit(2); }
    return null;
  }
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { console.error(`PARSE-ERROR ${rel}: ${e.message}`); process.exit(2); }
}

// ---------- S1 scenarios.json ----------
const scenariosDoc = loadJson("scenarios.json", true);
const scenarios = scenariosDoc.scenarios ?? [];
{
  const ids = new Set();
  for (const sc of scenarios) {
    if (!sc.id) err("S1", "scenario with no id");
    else if (ids.has(sc.id)) err("S1", `duplicate scenario id ${sc.id}`);
    else ids.add(sc.id);
    if (!sc.traces_down || typeof sc.traces_down !== "object") err("S1", `${sc.id}: missing traces_down`);
  }
  info("S1", `scenarios.json OK — ${scenarios.length} scenarios`);
}
const scIds = new Set(scenarios.map((s) => s.id));

// ---------- S2 registry ----------
const registry = loadJson("design/registry.json");
const regByKind = new Map();
if (registry) {
  for (const a of registry.artifacts ?? []) {
    if (!regByKind.has(a.kind)) regByKind.set(a.kind, new Set());
    regByKind.get(a.kind).add(a.id);
    for (const f of [a.file, a.design_ref].filter(Boolean)) {
      if (!existsSync(join(root, f))) err("S2", `registry ${a.kind} ${a.id}: file not on disk: ${f}`);
    }
    const refs = Array.isArray(a.scenario_ref) ? a.scenario_ref : [a.scenario_ref].filter(Boolean);
    for (const ref of refs) {
      if (ref === "*") continue; // module-scoped artifact (DD, notes, shell) — wildcard is legitimate
      if (!scIds.has(ref)) err("S2", `registry ${a.kind} ${a.id}: scenario_ref ${ref} does not resolve`);
    }
  }
  info("S2", `registry OK — ${(registry.artifacts ?? []).length} artifacts (${[...regByKind].map(([k, v]) => `${k}:${v.size}`).join(", ")})`);
} else info("S2", "SKIP — design/registry.json absent (Phase 2 not run)");

// ---------- helpers for later sections ----------
const featuresDoc = loadJson("features.json");
const feIds = new Set((featuresDoc?.features ?? []).map((f) => f.id));
const qaTracker = loadJson(".scenarioforge/qa-tracker.json");
const tsIds = new Set((qaTracker?.scenarios ?? []).map((t) => t.id));

// ---------- S3 traces_down link integrity ----------
{
  const checkKind = (sc, refs, kind, targetSet, targetName) => {
    for (const ref of refs ?? []) {
      if (!targetSet.has(ref)) err("S3", `${sc.id}: traces_down.${kind} "${ref}" not found in ${targetName}`);
    }
  };
  let apiMiss = 0, apiHit = 0;
  for (const sc of scenarios) {
    const td = sc.traces_down ?? {};
    if (registry) {
      checkKind(sc, td.entities, "entities", regByKind.get("entity") ?? new Set(), "registry entities");
      checkKind(sc, td.use_cases, "use_cases", regByKind.get("use_case") ?? new Set(), "registry use_cases");
      checkKind(sc, td.pages, "pages", regByKind.get("page") ?? new Set(), "registry pages");
      const apiSet = regByKind.get("api") ?? new Set();
      for (const ref of td.apis ?? []) (apiSet.has(ref) ? apiHit++ : apiMiss++);
    }
    if (featuresDoc) checkKind(sc, td.features, "features", feIds, "features.json");
    if (qaTracker) checkKind(sc, td.test_scenarios, "test_scenarios", tsIds, "qa-tracker");
  }
  if (registry && apiMiss > 0) {
    // api ids may use a different convention than the traces strings — one warning, not N errors,
    // unless SOME match (then the misses are real broken links)
    if (apiHit > 0) err("S3", `${apiMiss} traces_down.apis refs do not resolve in the registry (while ${apiHit} do — broken links, not a convention gap)`);
    else warn("S3", `traces_down.apis strings match no registry api ids (${apiMiss} refs) — id-convention mismatch between phases; align domain-design registry api ids with the trace strings`);
  }
  info("S3", "traces_down link check done");
}

// ---------- S4 features ledgers agree ----------
if (featuresDoc) {
  const feats = featuresDoc.features ?? [];
  const actual = {};
  for (const fe of feats) actual[fe.status ?? "?"] = (actual[fe.status ?? "?"] ?? 0) + 1;
  for (const k of new Set([...Object.keys(actual), ...Object.keys(featuresDoc.rollup?.by_status ?? {})])) {
    const a = actual[k] ?? 0, c = featuresDoc.rollup?.by_status?.[k] ?? 0;
    if (a !== c) err("S4", `features.json rollup.by_status.${k}=${c} but actual count=${a} (stale rollup)`);
  }
  const impl = loadJson(".scenarioforge/impl-progress.json");
  if (impl) {
    const implFeats = impl.features ?? {};
    const deferredText = JSON.stringify(impl.deferred ?? []);
    for (const [id, rec] of Object.entries(implFeats)) {
      if (!feIds.has(id)) err("S4", `impl-progress tracks ${id} which is not in features.json`);
      const implStatus = rec.status ?? rec;
      const feStatus = feats.find((f) => f.id === id)?.status;
      if (implStatus === "done" && feStatus !== "done")
        err("S4", `${id}: impl-progress says done but features.json status="${feStatus}" (ledgers disagree)`);
    }
    for (const fe of feats) {
      if (!(fe.id in implFeats) && !deferredText.includes(fe.id))
        warn("S4", `${fe.id} is in features.json but absent from impl-progress (and not listed in impl-progress.deferred[]) — silent drop or unstarted?`);
    }
    info("S4", `ledgers checked — features.json ${feats.length} FEs vs impl-progress ${Object.keys(implFeats).length}`);
  } else info("S4", "impl-progress absent (Phase 4 not run) — only rollup checked");
} else info("S4", "SKIP — features.json absent (Phase 3 not run)");

// ---------- S5 ui-control manifests ----------
{
  const dir = join(root, ".scenarioforge/ui-controls");
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    let controls = 0;
    for (const f of files) {
      const m = loadJson(join(".scenarioforge/ui-controls", f));
      if (!m) continue;
      if (m.feature_id && featuresDoc && !feIds.has(m.feature_id))
        err("S5", `${f}: feature_id ${m.feature_id} not in features.json`);
      for (const pg of m.pages ?? []) {
        for (const c of pg.controls ?? []) {
          controls++;
          if (!c.selector || !c.selector.includes("data-testid"))
            err("S5", `${f}: control ${c.id} has no data-testid selector`);
        }
      }
    }
    info("S5", `${files.length} manifests, ${controls} controls checked`);
  } else info("S5", "SKIP — .scenarioforge/ui-controls absent");
}

// ---------- S6 qa-tracker honesty + evidence ----------
if (qaTracker) {
  const ts = qaTracker.scenarios ?? [];
  const actual = {};
  for (const t of ts) actual[t.status ?? "?"] = (actual[t.status ?? "?"] ?? 0) + 1;
  for (const k of new Set([...Object.keys(actual), ...Object.keys(qaTracker.rollup?.by_status ?? {})])) {
    const a = actual[k] ?? 0, c = qaTracker.rollup?.by_status?.[k] ?? 0;
    if (a !== c) err("S6", `qa-tracker rollup.by_status.${k}=${c} but actual count=${a} (stale rollup)`);
  }
  const cov = qaTracker.coverage ?? {};
  const gapN = (cov.gap_control_ids ?? []).length, failN = (cov.fail_control_ids ?? []).length;
  if (cov.gate_4 === "PASS" && (gapN || failN))
    err("S6", `coverage.gate_4=PASS but gap_control_ids=${gapN} fail_control_ids=${failN}`);
  const pendingN = (actual.pending ?? 0) + (actual.failed ?? 0) + (actual.running ?? 0);
  if (qaTracker.rollup?.release_ready === true && (cov.gate_4 !== "PASS" || pendingN > 0))
    err("S6", `release_ready=true but gate_4=${cov.gate_4} and ${pendingN} not-passed scenarios`);
  // run_status honesty (field bug: stale "partial" note under an all-green rollup)
  const runStatus = qaTracker.meta?.run_status ?? "";
  if ((actual.passed ?? 0) === ts.length && ts.length > 0 && /partial|not yet|pending/i.test(runStatus))
    err("S6", `meta.run_status ("${runStatus.slice(0, 80)}...") contradicts an all-passed rollup — stale audit trail`);
  // per-spec run evidence
  const evidenceDir = join(root, ".scenarioforge/test-results");
  const specsWithPassed = new Set(ts.filter((t) => t.status === "passed" && t.spec_path).map((t) => t.spec_path.split(/[\\/]/).pop()));
  if (specsWithPassed.size) {
    const evid = existsSync(evidenceDir) ? readdirSync(evidenceDir) : [];
    for (const spec of specsWithPassed) {
      const base = spec.replace(/\.spec\.(ts|js)$/, "");
      if (!evid.some((e) => e.includes(base)))
        warn("S6", `no per-spec run evidence under .scenarioforge/test-results/ for ${spec} — its passed results are UNPROVEN (re-run to regenerate, or accept for pre-0.2.0 runs)`);
    }
  }
  info("S6", `qa-tracker checked — ${ts.length} TS, findings=${(qaTracker.findings ?? []).length} (open=${(qaTracker.findings ?? []).filter((f) => f.status === "open").length})`);
} else info("S6", "SKIP — .scenarioforge/qa-tracker.json absent (Phase 4q not run)");

// ---------- report ----------
for (const i of infos) console.log(`INFO ${i}`);
for (const w of warnings) console.log(`WARN ${w}`);
if (errors.length) {
  console.log(`\nFAIL — ${errors.length} violation(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
if (strict && warnings.length) {
  console.log(`\nFAIL (--strict) — ${warnings.length} warning(s) treated as violations.`);
  process.exit(1);
}
console.log(`\nPASS — spine links verified${warnings.length ? ` (${warnings.length} warning(s) above)` : ""}.`);
