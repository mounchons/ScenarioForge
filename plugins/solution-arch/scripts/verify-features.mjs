#!/usr/bin/env node
/**
 * verify-features.mjs — deterministic Gate-3 checker for features.json (solution-arch / ScenarioForge)
 *
 * Checks (all machine-checkable; no LLM judgment):
 *   1. features.json parses and has features[]
 *   2. every FE id is unique
 *   3. every FE.scenario_ref resolves to a scenario in scenarios.json
 *   4. every FE.depends_on id resolves to a real FE
 *   5. the dependency graph is ACYCLIC (Kahn's algorithm) — prints build depth on success
 *   6. every page in each scenario's traces_down.pages is served by >= 1 FE (via FE.pages/layering refs)
 *   7. scenarios' traces_down.features[] point at real FEs, and every FE appears in its scenario's traces_down.features
 *   8. rollup.by_status (if present) equals the actual count of features[].status values
 *
 * Usage:  node verify-features.mjs [features.json] [scenarios.json]
 *         (defaults: ./features.json ./scenarios.json, resolved from CWD = project root)
 * Exit codes: 0 = all green; 1 = violations found (printed); 2 = file/parse error
 */
import { readFileSync } from "node:fs";

const featuresPath = process.argv[2] ?? "features.json";
const scenariosPath = process.argv[3] ?? "scenarios.json";

function load(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`PARSE-ERROR ${path}: ${e.message}`);
    process.exit(2);
  }
}

const featuresDoc = load(featuresPath);
const scenariosDoc = load(scenariosPath);
const features = featuresDoc.features ?? [];
const scenarios = scenariosDoc.scenarios ?? [];
const errors = [];
const warnings = [];

if (!Array.isArray(features) || features.length === 0) {
  console.error("FAIL: features.json has no features[]");
  process.exit(1);
}

// 2. unique ids
const feIds = new Set();
for (const fe of features) {
  if (!fe.id) errors.push(`FE with no id (title: ${fe.title ?? "?"})`);
  else if (feIds.has(fe.id)) errors.push(`duplicate FE id: ${fe.id}`);
  else feIds.add(fe.id);
}

// 3. scenario_ref resolves
const scIds = new Set(scenarios.map((s) => s.id));
for (const fe of features) {
  if (!fe.scenario_ref) errors.push(`${fe.id}: missing scenario_ref`);
  else if (!scIds.has(fe.scenario_ref)) errors.push(`${fe.id}: scenario_ref ${fe.scenario_ref} does not resolve`);
}

// 4. depends_on resolve
for (const fe of features) {
  for (const dep of fe.depends_on ?? []) {
    if (!feIds.has(dep)) errors.push(`${fe.id}: depends_on ${dep} does not resolve to a real FE`);
  }
}

// 5. acyclic (Kahn)
{
  const indeg = new Map([...feIds].map((id) => [id, 0]));
  const out = new Map([...feIds].map((id) => [id, []]));
  for (const fe of features) {
    for (const dep of fe.depends_on ?? []) {
      if (!feIds.has(dep)) continue; // already reported
      out.get(dep).push(fe.id);
      indeg.set(fe.id, indeg.get(fe.id) + 1);
    }
  }
  let queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  const depth = new Map(queue.map((id) => [id, 1]));
  let seen = 0;
  while (queue.length) {
    const next = [];
    for (const id of queue) {
      seen++;
      for (const succ of out.get(id)) {
        indeg.set(succ, indeg.get(succ) - 1);
        depth.set(succ, Math.max(depth.get(succ) ?? 1, (depth.get(id) ?? 1) + 1));
        if (indeg.get(succ) === 0) next.push(succ);
      }
    }
    queue = next;
  }
  if (seen !== feIds.size) {
    const cyclic = [...indeg].filter(([, d]) => d > 0).map(([id]) => id);
    errors.push(`dependency CYCLE detected among: ${cyclic.join(", ")}`);
  } else {
    warnings.push(`INFO: dependency graph acyclic — ${feIds.size} FEs, build depth ${Math.max(0, ...depth.values())}`);
  }
}

// 6. every traced page served by >= 1 FE
const servedPages = new Set();
for (const fe of features) {
  for (const pg of fe.pages ?? []) servedPages.add(pg);
  for (const pg of fe.layering?.pages ?? []) servedPages.add(pg);
  for (const pg of fe.traces_up?.pages ?? []) servedPages.add(pg);
}
for (const sc of scenarios) {
  for (const pg of sc.traces_down?.pages ?? []) {
    if (!servedPages.has(pg)) errors.push(`${sc.id}: page ${pg} is served by no FE`);
  }
}

// 7. spine backrefs both ways
for (const sc of scenarios) {
  for (const ref of sc.traces_down?.features ?? []) {
    if (!feIds.has(ref)) errors.push(`${sc.id}: traces_down.features ${ref} does not resolve`);
  }
}
for (const fe of features) {
  const sc = scenarios.find((s) => s.id === fe.scenario_ref);
  if (sc && !(sc.traces_down?.features ?? []).includes(fe.id)) {
    errors.push(`${fe.id}: not listed in ${sc.id}.traces_down.features (spine backref missing)`);
  }
}

// 8. rollup consistency
if (featuresDoc.rollup?.by_status) {
  const actual = {};
  for (const fe of features) actual[fe.status ?? "?"] = (actual[fe.status ?? "?"] ?? 0) + 1;
  const claimed = featuresDoc.rollup.by_status;
  const keys = new Set([...Object.keys(actual), ...Object.keys(claimed)]);
  for (const k of keys) {
    if ((actual[k] ?? 0) !== (claimed[k] ?? 0)) {
      errors.push(`rollup.by_status.${k} = ${claimed[k] ?? 0} but actual features[].status count = ${actual[k] ?? 0} (stale rollup)`);
    }
  }
}

for (const w of warnings) console.log(w);
if (errors.length) {
  console.log(`\nFAIL — ${errors.length} violation(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log(`PASS — ${features.length} FEs, ${scenarios.length} scenarios: ids unique, refs resolve, graph acyclic, pages served, backrefs intact, rollup consistent.`);
