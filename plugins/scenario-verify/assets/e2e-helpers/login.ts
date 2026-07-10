// login.ts — shared login helper template (scenario-verify / ScenarioForge)
// Copy into the generated suite's helpers/ directory and set the selectors/URL for the target app.
// Credentials come from env (E2E_USER / E2E_PASS / E2E_BASE_URL) — never hard-code secrets in specs.
import { expect, type Page } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL ?? "https://localhost:5001"; // ADJUST default
const LOGIN_PATH = "/Auth/Login";              // ADJUST per app
const USER_SEL = "[name=Username]";            // ADJUST per app (probe the login form once)
const PASS_SEL = "[name=Password]";            // ADJUST per app
const SUBMIT_SEL = "button[type=submit]";      // ADJUST per app

export async function login(page: Page, user?: string, pass?: string): Promise<void> {
  const u = user ?? process.env.E2E_USER;
  const p = pass ?? process.env.E2E_PASS;
  if (!u || !p) throw new Error("E2E_USER / E2E_PASS not set (and no explicit credentials passed)");
  await page.goto(`${BASE_URL}${LOGIN_PATH}`, { waitUntil: "domcontentloaded" });
  await page.fill(USER_SEL, u);
  await page.fill(PASS_SEL, p);
  await Promise.all([page.waitForLoadState("networkidle"), page.click(SUBMIT_SEL)]);
  await expect(page).not.toHaveURL(new RegExp(LOGIN_PATH, "i")); // login actually succeeded
}

/**
 * Low-privilege login for element-level permission tests. Provision E2E_USER_LOW / E2E_PASS_LOW as part
 * of the test-data contract (spec-authoring.md); when no such credential exists, permission-negative
 * falls back to the unauthenticated-redirect pattern (assert-kind.ts#assertUnauthRedirect) — documented,
 * not skipped.
 */
export async function loginLowPrivilege(page: Page): Promise<boolean> {
  const u = process.env.E2E_USER_LOW, p = process.env.E2E_PASS_LOW;
  if (!u || !p) return false; // caller falls back to the redirect pattern
  await login(page, u, p);
  return true;
}
