/**
 * Customer Inbox lens — operator journey (MOCK MODE, Pattern B).
 *
 * Pairs with the source lock tests/architectural/customer_inbox_lens.test.ts.
 * The Customer Inbox lens (requirements §3 / §4 Q7) is a filter chip on
 * /cases wired to `origin=CUSTOMER` post Case & Intent Super-Group pivot.
 * This journey proves the chip filters the live queue in a real browser and
 * is reversible — the per-case correctness (every returned case carries
 * origin=CUSTOMER) is locked deterministically in
 * tests/lib/cases_api_supergroup.test.ts.
 *
 * Mock mode: self-contained (next dev, no backend). Run via
 * `npm run test:browser:mock`.
 */
import { test, expect } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

test.describe("Customer Inbox lens (mock mode)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, USERS.MANAGER);
    await page.goto("/cases");
    await expect(page.getByRole("option").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("the Customer Inbox chip filters the queue to EMAIL_ENTRY and back", async ({
    page,
  }) => {
    const inboxChip = page.getByRole("button", { name: "Customer Inbox" });
    const allChip = page.getByRole("button", { name: "All", exact: true });

    await expect(inboxChip).toHaveAttribute("aria-pressed", "false");
    const allCount = await page.getByRole("option").count();
    expect(allCount).toBeGreaterThan(0);

    // Activate the lens — the queue refetches with origin=CUSTOMER.
    await inboxChip.click();
    await expect(inboxChip).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => page.getByRole("option").count())
      .toBeGreaterThan(0);
    const inboxCount = await page.getByRole("option").count();
    expect(inboxCount).toBeLessThanOrEqual(allCount);

    // "All" clears the lens and restores the full queue.
    await allChip.click();
    await expect(inboxChip).toHaveAttribute("aria-pressed", "false");
    await expect(allChip).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => page.getByRole("option").count())
      .toBe(allCount);
  });
});
