// activate-tab.ts — shared tab/modal activation helper (scenario-verify / ScenarioForge)
// Copy into the generated suite's helpers/ directory; NEVER duplicate inline per spec.
// Field-proven on Bootstrap 5: click the [data-bs-toggle=tab] trigger, wait for the pane to gain
// .active + become visible (Playwright waits out the fade — no waitForTimeout needed).
//
// Pane addressing differs per page (probe first!): some pages give panes a data-testid
// (`<prefix>pane-<tab>`), others only a bare element id (`#tab-<tab>`). The locator below accepts both.
import { expect, type Page, type Locator } from "@playwright/test";

/** Module-specific testid prefix for tab triggers/panes, e.g. "mp-" → mp-tab-pricing / mp-pane-pricing. */
export const TAB_PREFIX = "mp-"; // ADJUST per module (matches the manifest's structure/tab ids)

export async function activateTab(page: Page, tab: string, prefix: string = TAB_PREFIX): Promise<void> {
  await page.locator(`[data-testid='${prefix}tab-${tab}']`).click();
  const pane = page.locator(`[data-testid='${prefix}pane-${tab}'], #tab-${tab}`);
  await expect(pane).toBeVisible();
  await expect(pane).toHaveClass(/active/);
}

/** Open a Bootstrap modal via its trigger and wait until it is interactable. */
export async function openModal(page: Page, triggerTestid: string, modalSelector: string): Promise<Locator> {
  await page.locator(`[data-testid='${triggerTestid}']`).click();
  const modal = page.locator(modalSelector);
  await expect(modal).toBeVisible();
  await expect(modal).toHaveClass(/show/);
  return modal;
}
