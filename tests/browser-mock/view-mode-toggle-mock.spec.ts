/**
 * In-UI Legacy / Modern view toggle (MOCK MODE — env flag OFF).
 *
 * This is the behavioural proof for the feature the source lock
 * (`tests/architectural/cockpit_wiring.test.ts` →
 * "in-UI Legacy/Modern view toggle") pins: an operator can switch into
 * the Modern cockpit *from the NavBar*, with NO environment change.
 *
 * It runs under `playwright.mock.config.ts`, whose dev server pins
 * NEXT_PUBLIC_COCKPIT=0 — so the env default is Legacy here even though
 * the production default flipped to Modern (flags.ts, 2026-06-11): this
 * journey specifically proves the in-UI escape from Legacy. The cockpit
 * surfaces (confidence ring, Agent Activity rail) are therefore absent
 * on load and appear ONLY after the toggle is flipped to Modern. That
 * is the whole point: the switch lives in the UI, not in Vercel.
 *
 * Record: exc-002 (DUPLICATE_PO, YELLOW, PENDING_REVIEW) on a
 * single-record case, so the detail panel auto-mounts and its mock
 * trace feeds the Agent Activity rail.
 */
import { test, expect, type Page } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

const CASE = "case-for-exc-002";
const RECORD = "exc-002";

const ring = (page: Page) => page.locator('[data-variant="ring"]').first();
const activityRail = (page: Page) =>
  page.getByRole("region", { name: /agent activity/i });

async function openRecord(page: Page) {
  // ≥ xl (1280px) so the rail's third column is active in Modern.
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");
  const row = page.locator(`#case-row-${CASE}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await page.waitForURL(new RegExp(`record=${RECORD}`), { timeout: 20_000 });
}

async function switchView(page: Page, label: RegExp) {
  await page.getByRole("button", { name: /change view/i }).click();
  await page.getByRole("menuitemradio", { name: label }).click();
}

test.describe("Legacy/Modern view toggle (mock, env flag off)", () => {
  test("Legacy is the default — cockpit surfaces are absent on load", async ({
    page,
  }) => {
    await openRecord(page);
    // The recommendation still renders (the bar variant), the action is
    // present — but the ring + activity rail (Modern-only) are not.
    await expect(
      page.getByRole("button", { name: /choose different action/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(ring(page)).toHaveCount(0);
    await expect(activityRail(page)).toHaveCount(0);
  });

  test("switching to Modern surfaces the ring + Agent Activity rail — no reload", async ({
    page,
  }) => {
    await openRecord(page);
    await switchView(page, /modern view/i);
    // The cockpit recomposes live, in place.
    await expect(ring(page)).toBeVisible({ timeout: 20_000 });
    await expect(activityRail(page)).toBeVisible({ timeout: 20_000 });
    // Parity: the recomposition stays actionable (RBAC-gated action).
    await expect(
      page.getByRole("button", { name: /choose different action/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("switching back to Legacy retires the cockpit surfaces", async ({
    page,
  }) => {
    await openRecord(page);
    await switchView(page, /modern view/i);
    await expect(ring(page)).toBeVisible({ timeout: 20_000 });
    await switchView(page, /legacy view/i);
    await expect(ring(page)).toHaveCount(0);
    await expect(activityRail(page)).toHaveCount(0);
  });

  test("the Modern choice persists across a reload (localStorage)", async ({
    page,
  }) => {
    await openRecord(page);
    await switchView(page, /modern view/i);
    await expect(ring(page)).toBeVisible({ timeout: 20_000 });
    // The preference is stored, not env-driven — it must survive a reload.
    await page.reload();
    await page.waitForURL(new RegExp(`record=${RECORD}`), { timeout: 20_000 });
    await expect(ring(page)).toBeVisible({ timeout: 20_000 });
  });
});
