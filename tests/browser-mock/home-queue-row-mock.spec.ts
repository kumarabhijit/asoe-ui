/**
 * /home "Top of queue" row responsive layout (MOCK MODE).
 *
 * Regression for the reported bug: at low resolution the queue rows
 * showed a stray single-glyph fragment (a `SO-…` order id truncated to
 * "S") next to the status, and the status label ("Awaiting review")
 * wrapped to two lines — an alignment artefact. Desktop was fine.
 *
 * The row is a flex line: [source badge][SLA badge][order-ref][status]
 * [chevron]. The fix gives the order-ref the flex slack with `min-w-0
 * truncate` (so it ellipsises instead of leaving a one-char fragment)
 * and pins the status `whitespace-nowrap`; below `sm` the order-ref and
 * status are hidden so a cramped phone row is just type + SLA + chevron.
 *
 * Only a real browser exercises responsive CSS (jsdom can't), so this
 * lives in the mock browser suite. Assertions are computed-style / URL
 * / visibility — not timing-dependent.
 */
import { test, expect } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

const QUEUE = 'section[aria-label="Top of queue"]';
const ROW = `${QUEUE} a[href^="/cases/"]`;

test.describe("/home top-of-queue row (mock mode)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.MANAGER);
    await page.goto("/home");
    await expect(page.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
  });

  test("at desktop width the status is one line and the order id is shown", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const firstRow = page.locator(ROW).first();
    await expect(firstRow).toBeVisible();

    // The mono order-ref (e.g. "SO-10100") is visible at desktop.
    const orderRef = firstRow.locator("span.font-mono");
    await expect(orderRef).toBeVisible();
    await expect(orderRef).not.toHaveText(/^$/);

    // The status label sits on a single line — never wraps. This is the
    // "alignment" half of the bug: a wrapped status made row content
    // uneven. We assert the computed white-space, the property that
    // guarantees it.
    const status = firstRow.locator("span", { hasText: /awaiting|resolved|escalat|buyer|erp/i }).last();
    await expect(status).toBeVisible();
    const whiteSpace = await status.evaluate(
      (el) => getComputedStyle(el).whiteSpace,
    );
    expect(whiteSpace).toBe("nowrap");
  });

  test("at phone width no truncated id fragment or wrapped status is shown", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const firstRow = page.locator(ROW).first();
    await expect(firstRow).toBeVisible();

    // Below sm the order-ref is hidden — so there is no single-glyph
    // "S…" fragment (the reported "extraneous character").
    await expect(firstRow.locator("span.font-mono")).toBeHidden();

    // The status label is also hidden below sm (it can't fit on one
    // line next to the SLA badge), so it can't wrap. On the parent
    // commit it was visible and wrapped.
    const status = firstRow.locator("span", { hasText: /awaiting|resolved|escalat|buyer|erp/i });
    await expect(status).toBeHidden();

    // The row must not overflow its card horizontally at this width.
    const overflow = await firstRow.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
