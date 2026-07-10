#!/usr/bin/env node
/**
 * probe-page.mjs — Rule-0 DOM probe (scenario-verify / ScenarioForge)
 *
 * Dumps, for one page, everything spec-authoring.md Rule 0 requires BEFORE a spec body is written:
 *   - per data-testid: tag, type, visibility (visible / attached-hidden), disabled, required,
 *     option/radio/checkbox child counts, table row count, owning form (form= attr or ancestor action)
 *   - tab/modal inventory (Bootstrap: [data-bs-toggle=tab] triggers, .tab-pane panes, .modal) and which
 *     controls start hidden behind an inactive container
 *   - rendering model: whether the page issued client XHR/fetch during load, and to which routes
 *     (an empty list = server-rendered → page.route('**/api/**') would be a NO-OP in LOAD/ERR tests)
 *
 * Run FROM THE E2E SUITE DIRECTORY (where playwright is installed), e.g.:
 *   cd tests/e2e && node <plugin>/scripts/probe-page.mjs https://localhost:7157/Module/Page \
 *     --login-url https://localhost:7157/Auth/Login --user ADMIN --pass secret \
 *     [--user-sel "[name=Username]"] [--pass-sel "[name=Password]"] [--submit-sel "button[type=submit]"] \
 *     [--testid-attr data-testid] [--out probe.json]
 *
 * Output: JSON to stdout (or --out). Never commit probe output into the project — it is scratch input
 * for authoring, not an artifact.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith("--"));
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
if (!url) {
  console.error("usage: node probe-page.mjs <url> [--login-url U --user X --pass Y] [--out f.json]");
  process.exit(2);
}

// resolve playwright from the CWD (the project's E2E suite), not from the plugin directory
let chromium;
const req = createRequire(join(process.cwd(), "package.json"));
for (const pkg of ["playwright", "@playwright/test", "playwright-core"]) {
  try { ({ chromium } = req(pkg)); if (chromium) break; } catch { /* try next */ }
}
if (!chromium) {
  console.error("playwright not resolvable from CWD — run this from the E2E suite directory (e.g. tests/e2e).");
  process.exit(2);
}

const testidAttr = opt("testid-attr", "data-testid");
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

// login (optional)
const loginUrl = opt("login-url");
if (loginUrl) {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await page.fill(opt("user-sel", "[name=Username]"), opt("user", ""));
  await page.fill(opt("pass-sel", "[name=Password]"), opt("pass", ""));
  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    page.click(opt("submit-sel", "button[type=submit]")),
  ]);
}

// rendering-model detection: record client xhr/fetch during the target page load
const xhr = [];
page.on("request", (r) => {
  if (["xhr", "fetch"].includes(r.resourceType())) xhr.push(`${r.method()} ${new URL(r.url()).pathname}`);
});
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});

const result = await page.evaluate((attr) => {
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && el.getClientRects().length > 0;
  };
  const containerOf = (el) => {
    const pane = el.closest(".tab-pane");
    if (pane) return { kind: "tab-pane", id: pane.id || pane.getAttribute(attr), active: pane.classList.contains("active") };
    const modal = el.closest(".modal");
    if (modal) return { kind: "modal", id: modal.id || modal.getAttribute(attr), open: modal.classList.contains("show") };
    return null;
  };
  const controls = [...document.querySelectorAll(`[${attr}]`)].map((el) => {
    const formAttr = el.getAttribute("form");
    const form = formAttr ? document.getElementById(formAttr) : el.closest("form");
    return {
      testid: el.getAttribute(attr),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") ?? null,
      visible: vis(el),
      display: getComputedStyle(el).display,
      disabled: el.disabled ?? false,
      required: el.required ?? false,
      options_nonplaceholder: el.tagName === "SELECT" ? el.querySelectorAll("option[value]:not([value=''])").length : null,
      child_radios: el.querySelectorAll("input[type=radio]").length,
      child_checkboxes: el.querySelectorAll("input[type=checkbox]").length,
      table_rows: el.tagName === "TABLE" ? el.querySelectorAll("tbody tr").length : null,
      form: form ? { id: form.id || null, action: form.getAttribute("action"), method: form.getAttribute("method"), via_form_attr: !!formAttr, novalidate: form.hasAttribute("novalidate") } : null,
      container: containerOf(el),
    };
  });
  const tabs = [...document.querySelectorAll("[data-bs-toggle=tab]")].map((t) => ({
    trigger_testid: t.getAttribute(attr), target: t.getAttribute("data-bs-target") || t.getAttribute("href"),
  }));
  const panes = [...document.querySelectorAll(".tab-pane")].map((p) => ({
    id: p.id || null, testid: p.getAttribute(attr), active: p.classList.contains("active"),
  }));
  const modals = [...document.querySelectorAll(".modal")].map((m) => ({ id: m.id || null, testid: m.getAttribute(attr) }));
  return { controls, tabs, panes, modals, title: document.title };
}, testidAttr);

await browser.close();

const hiddenBehindContainer = result.controls.filter((c) => !c.visible && c.container && ((c.container.kind === "tab-pane" && !c.container.active) || (c.container.kind === "modal" && !c.container.open)));
const out = {
  url,
  title: result.title,
  rendering_model: xhr.length ? "client-fetch (partial or full)" : "server-rendered (NO client xhr during load — route('**/api/**') is a NO-OP for LOAD/ERR)",
  client_xhr_during_load: [...new Set(xhr)],
  tabs: result.tabs, panes: result.panes, modals: result.modals,
  controls_total: result.controls.length,
  controls_hidden_behind_inactive_container: hiddenBehindContainer.map((c) => c.testid),
  controls: result.controls,
};
const outPath = opt("out");
const json = JSON.stringify(out, null, 2);
if (outPath) { writeFileSync(outPath, json); console.log(`written ${outPath} (${out.controls_total} controls)`); }
else console.log(json);
