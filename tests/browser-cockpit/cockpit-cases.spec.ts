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
import AxeBuilder from "@axe-core/playwright";

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

  test("the Diagnostics & Audit drawer surfaces the Provenance card + Audit-only group", async ({ page }) => {
    await openCockpitRecord(page);
    // The drawer is collapsed by default (engine internals, never L1).
    const drawer = page.getByRole("button", { name: /diagnostics & audit/i }).first();
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await drawer.click();
    // Provenance projects the backend presentation.audit bundle.
    await expect(
      page.getByRole("region", { name: /provenance/i }),
    ).toBeVisible({ timeout: 20_000 });
    // The rawest internals are demoted to a collapsed "Audit only" sub-group.
    await expect(page.getByText("Audit only").first()).toBeVisible({ timeout: 20_000 });
  });

  test("the cockpit-new surfaces (ring + activity rail) are axe-clean", async ({ page }) => {
    await openCockpitRecord(page);
    await expect(page.locator('[data-variant="ring"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("region", { name: /agent activity/i })).toBeVisible({ timeout: 20_000 });
    // Scope axe to the NEW cockpit surfaces so the check is about what this
    // PR introduces. `color-contrast` is disabled to match the project's
    // established a11y policy: the route-level sweep
    // (tests/browser/a11y-route-sweep.spec.ts) defers the same pervasive
    // small-text contrast debt per-route. This check therefore validates the
    // STRUCTURAL a11y (roles, names, ARIA) of the ring + activity rail —
    // holding the new surfaces to the project standard, not stricter — while
    // the shared EventsTimeline's contrast debt stays tracked where it lives.
    const results = await new AxeBuilder({ page })
      .include('[data-variant="ring"]')
      .include('[aria-label="Agent activity"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    const gating = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(gating, JSON.stringify(gating, null, 2)).toEqual([]);
  });

  test("the Situation sub-line carries SLA + state; the ribbon badge relocates (option C)", async ({ page }) => {
    await openCockpitRecord(page);
    // exc-002 is PENDING_REVIEW with a mock parent-case SLA seeded at
    // created_at + 24h (long past) → the live label reads "SLA breached
    // … ago". The state renders through the governed humanizer.
    const subline = page.getByText(/^SLA breached .* ago$/);
    await expect(subline).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Pending Review", { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    // Relocation, not duplication: the embedded HeaderRibbon drops its
    // "Current State" badge (and with it the now-empty chrome row).
    await expect(page.getByText("Current State:")).toHaveCount(0);
  });
});
