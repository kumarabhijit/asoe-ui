/**
 * Cockpit (flag-on) operator journey — MOCK MODE, dedicated server.
 *
 * The Phase-4 behavioural half (test-strategy: a state-machine surface
 * gets BOTH a source-level architectural lock AND a browser e2e). The
 * source lock is `tests/architectural/cockpit_wiring.test.ts`; this is
 * the journey.
 *
 * Runs ONLY under `playwright.cockpit.config.ts`, whose dev server sets
 * NEXT_PUBLIC_COCKPIT=1 — so these assertions prove the flag-on
 * composition renders and stays actionable, without flipping the flag
 * for the classic mock specs.
 *
 * Record: exc-002 (DUPLICATE_PO, YELLOW, PENDING_REVIEW) on a
 * single-record case, so the detail panel auto-mounts. Its mock trace
 * carries executed_nodes, so the Agent Activity rail has content.
 */
import { test, expect, type Page } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

const CASE = "case-for-exc-002";
const RECORD = "exc-002";

async function openCockpitRecord(page: Page) {
  // ≥ xl (1280px) so the rail's third column is active.
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");
  const row = page.locator(`#case-row-${CASE}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await page.waitForURL(new RegExp(`record=${RECORD}`), { timeout: 20_000 });
}

test.describe("cockpit (flag on) — /cases", () => {
  test("the recommendation surfaces the confidence RING (cockpit hero)", async ({ page }) => {
    await openCockpitRecord(page);
    // The ring variant is produced ONLY by the cockpit recommendation
    // (enrichment sections use bar/inline) — so its presence is a
    // definitive "flag is on" signal.
    await expect(page.locator('[data-variant="ring"]').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("the Agent Activity rail is mounted beside the cockpit", async ({ page }) => {
    await openCockpitRecord(page);
    await expect(
      page.getByRole("region", { name: /agent activity/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("the recommendation stays actionable (RBAC-gated action present)", async ({ page }) => {
    await openCockpitRecord(page);
    // Parity: the cockpit is a recomposition, not a regression — the
    // gated primary action still renders for a manager on a YELLOW record.
    await expect(
      page.getByRole("button", { name: /choose different action/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
