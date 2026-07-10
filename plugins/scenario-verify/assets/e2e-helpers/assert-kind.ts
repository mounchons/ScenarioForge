// assert-kind.ts — control-kind-aware assertion helpers (scenario-verify / ScenarioForge)
// Copy into the generated suite's helpers/ directory. Implements spec-authoring.md Rule 2/3:
// assert by what the control IS (probe first), never a one-size toBeVisible + option.count().
import { expect, type Page, type Locator } from "@playwright/test";

/** Locator for a testid; a trailing '-' means row-scoped prefix → ^= match with .first() (strict-mode safe). */
export function locOf(page: Page, testid: string): Locator {
  return testid.endsWith("-")
    ? page.locator(`[data-testid^='${testid}']`).first()
    : page.locator(`[data-testid='${testid}']`);
}

/** Hidden carriers (payload/rowversion/idempotency inputs): attached, never visible-asserted. */
export async function assertAttachedHidden(page: Page, testid: string): Promise<void> {
  const loc = locOf(page, testid);
  await expect(loc).toBeAttached();
}

/** Real <select>: has at least one non-placeholder option. */
export async function assertSelectPopulated(page: Page, testid: string): Promise<void> {
  const loc = locOf(page, testid);
  await expect(loc).toBeVisible();
  expect(await loc.locator("option[value]:not([value=''])").count()).toBeGreaterThan(0);
}

/** Radio/checkbox group container (<div> of inputs — zero <option>): count child inputs. */
export async function assertGroupPopulated(page: Page, testid: string): Promise<void> {
  const loc = locOf(page, testid);
  await expect(loc).toBeVisible();
  expect(await loc.locator("input[type=radio], input[type=checkbox]").count()).toBeGreaterThan(0);
}

/**
 * Grid rows by row-testid prefix. With rows seeded → count > 0. With a legitimately empty seed →
 * pass the empty-state marker testid and this asserts the HONEST empty state instead (Rule 8:
 * never fabricate rows).
 */
export async function assertGridRows(page: Page, rowPrefix: string, emptyMarkerTestid?: string): Promise<void> {
  const rows = page.locator(`[data-testid^='${rowPrefix}']`);
  const n = await rows.count();
  if (n > 0) { await expect(rows.first()).toBeVisible(); return; }
  if (emptyMarkerTestid) {
    await expect(locOf(page, emptyMarkerTestid)).toBeVisible();
    return;
  }
  expect(n, `no rows matched [data-testid^='${rowPrefix}'] and no empty-state marker was provided`).toBeGreaterThan(0);
}

/** Row-scoped control on a page whose grid may be empty: control count 0 + empty marker = valid state. */
export async function assertRowControlOrEmpty(page: Page, controlPrefix: string, emptyMarkerTestid: string): Promise<void> {
  const controls = page.locator(`[data-testid^='${controlPrefix}']`);
  if ((await controls.count()) > 0) { await expect(controls.first()).toBeVisible(); return; }
  await expect(locOf(page, emptyMarkerTestid)).toBeVisible();
}

/**
 * server_side validation contract on server-rendered forms: the control's owning form posts to the
 * server-validated action. Handles inline-edit grids where the control links via the HTML form= attribute
 * (NOT a DOM descendant) — locate the form by action, never by ancestor.
 */
export async function assertServerForm(page: Page, actionSuffix: string): Promise<void> {
  const form = page.locator(`form[action$='${actionSuffix}']`).first();
  await expect(form).toBeAttached();
  await expect(form).toHaveAttribute("method", /post/i);
}

/** Permission-negative on an [Authorize]-gated page: unauthenticated goto → login redirect + control absent. */
export async function assertUnauthRedirect(page: Page, url: string, controlTestid: string, loginPattern: RegExp = /login/i): Promise<void> {
  await page.goto(url);
  await expect(page).toHaveURL(loginPattern);
  await expect(page.locator(`[data-testid='${controlTestid}']`)).toHaveCount(0);
}
