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
