# ScenarioForge Viewer — Design Spec

**Date:** 2026-07-04
**Status:** approved design, pending implementation plan
**Owner artifact:** `scenarios.json` (Phase 1, scenario-discovery)

## Context

`scenarios.json` is the Phase 1 source of truth (see
`plugins/scenario-discovery/skills/scenario-discovery/references/schema.md`). Raw JSON is hard
for humans to review: deeply nested nodes (`business`, `traces_down`, `analysis.gaps`,
`analysis.suggestions`, `contributors`, `provenance`, `rollup`) and workflow state
(pending suggestions, `human_validated`) are invisible without tooling. We need a
human-readable viewer with expandable sub-nodes, available in **every project** that has the
ScenarioForge plugin suite installed.

## Users and use cases

1. **Author (primary)** — reviews scenarios while running the pipeline. Needs light
   interaction during requirement gathering: accept/reject suggestions, tick
   `human_validated`.
2. **Client / stakeholder** — strictly read-only. Receives a self-contained snapshot file;
   no tooling, no install.

## Decision

Single-file **HTML viewer + tiny local Node server**, shipped inside the existing
`scenario-discovery` plugin (no 8th plugin). A VS Code extension was considered and
rejected: it cannot serve clients, adds a second distribution channel, and carries
long-term extension-API maintenance. A TUI was rejected as not client-presentable.

Implementation notes (user decisions):

- All implementation code is written by **Opus subagents** (`Agent` with `model: "opus"`);
  the main session reviews and integrates.
- After field testing with real usage, **Opus may iterate on the viewer's UI design**
  (layout, styling, information hierarchy) without a new spec round, as long as the
  write-back whitelist and snapshot read-only guarantees are unchanged.

## Components

```
plugins/scenario-discovery/
├── commands/
│   └── view.md                        # /scenario-discovery:view [snapshot]
└── assets/viewer/
    ├── viewer.html                    # single-file app — vanilla JS/CSS, no build, no CDN/network
    ├── server.mjs                     # zero-dependency Node HTTP server (node: builtins only)
    └── fixtures/scenarios.sample.json # fixture covering every node type and edge state
```

`commands/` is new for this plugin (other plugins in the suite already use the same
convention).

### Command: `/scenario-discovery:view [snapshot]`

- **Live mode** (no args): locate `scenarios.json` (project root first, then glob; if
  several found, ask the user which one), then run
  `node <plugin>/assets/viewer/server.mjs --file <path> --open`. The server prints the URL
  and opens the default browser.
- **Snapshot mode** (`snapshot`): run
  `node <plugin>/assets/viewer/server.mjs --file <path> --snapshot`, which writes
  `scenarios-report.html` next to the source file and exits (no server started) — a
  self-contained read-only report to send to clients (opens from `file://`).

### viewer.html (UI)

- **Header:** `meta` summary (module, status, effort_scale, generated_at) + **rollup
  dashboard**: total, by_status, avg_completeness, open_gaps_high, pending_suggestions,
  and a green/red `ready_for_next_phase` indicator.
- **Filters:** status, priority, has open gaps, has pending suggestions; free-text search
  over id/title/actor/goal.
- **Scenario cards** with collapsible sub-nodes in this order: `business`, `traces_down`,
  `analysis` (gaps sorted by severity; suggestions each with Accept / Reject buttons and a
  resolution note field), `contributors`, `provenance`.
- **Badges:** priority, status, completeness score, `has_ui`.
- UI labels in Thai; print-friendly CSS (client can print to PDF).
- Live mode polls the file mtime (~2s, via ETag) and re-renders when an agent edits the
  file.

### server.mjs (live mode only)

- Binds `127.0.0.1` on a random free port.
- `GET /` → viewer.html; `GET /api/scenarios` → file content + mtime token.
- `POST /api/action` → **whitelisted mutations only**:
  1. `suggestion_decision` — `{scenario_id, suggestion_id, status: "accepted"|"rejected",
     resolution}`; stamps `resolution` and decision time.
  2. `set_human_validated` — `{scenario_id, value: boolean}`.
- Every successful mutation **recomputes `rollup`** using the formula in `schema.md`
  (including `ready_for_next_phase`).
- Writes are atomic (temp file + rename). If the file's mtime changed since the client
  loaded it, the server rejects with 409 and the UI prompts a refresh — optimistic
  concurrency against agents writing the same file.
- No other field is writable. Requests touching anything else are rejected.

### Snapshot export

- Embeds the JSON in `<script type="application/json">` inside the HTML.
- Mutation/`fetch` code is **structurally removed** at generation time (not merely
  disabled), so the snapshot is read-only by construction.

## Error handling

- Invalid JSON → friendly parse-error view with the failing position; never a blank page.
- File not found → guidance to run scenario-discovery first.
- Unknown `schema_version` → best-effort render plus a warning banner.

## Testing

- `node:test` suite for server.mjs: whitelist enforcement (non-whitelisted paths rejected),
  rollup recompute correctness, mtime conflict → 409, atomic write behavior.
- Manual UI checklist against `scenarios.sample.json` (every node type, empty states,
  Thai text, print view).
- Field test in a real project before relying on it for client delivery.

## Non-goals

- Editing arbitrary scenario fields from the viewer.
- Client-side write access or any shared/hosted server.
- Multi-file merged dashboard — the viewer opens one `scenarios.json` at a time (picker
  when multiple exist).
- Viewing other ScenarioForge ledgers (features.json, qa-tracker.json, …) — possible later,
  out of scope here.
