/**
 * /cases workspace usability regressions (MOCK MODE).
 *
 * Partner browser e2e for the source-level locks in
 * `tests/architectural/cases_workspace_render_guard.test.ts`
 * ("locks the workspace to the viewport…" + "makes the queue a single
 * Tab stop…") and the hook unit tests in
 * `tests/hooks/useKeyboardListNav.test.tsx`. Per the test-strategy
 * rule, a state-machine surface gets BOTH a source lock and a
 * multi-step operator-journey browser e2e — this is the latter.
 *
 * The three usability defects this guards (all reachable from the
 * /cases page, the primary CSR work surface):
 *
 *   1. Navigation — primary nav tabs were <button>s, not links: no
 *      Cmd/Ctrl/middle-click into a new tab, AT announced "button".
 *      Fixed by rendering Next <Link>s (NavBar.tsx).
 *
 *   2. Focus loss — the queue listbox moved DOM focus onto each <option>
 *      row. That made every row a Tab stop and dropped focus to <body>
 *      when a filter change unmounted the focused row. Fixed by
 *      anchoring focus on the listbox container + roving via
 *      aria-activedescendant (useKeyboardListNav.ts + page.tsx
 *      tabIndex={-1} options).
 *
 *   3. Scrolling — the workspace had no viewport height bound, so the
 *      panes' overflow-y-auto never engaged and the whole document
 *      scrolled (dragging the action ribbon out of view). Fixed by
 *      pinning <main> to calc(100vh - nav) and clipping its overflow
 *      at lg+ (page.tsx).
 *
 * Mock mode: self-contained (next dev, no backend). Run via
 * `npm run test:browser:mock`.
 */
import { test, expect } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

test.describe("/cases usability (mock mode)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, USERS.MANAGER);
    await page.goto("/cases");
    // Queue populated (mock fixtures always seed open work).
    await expect(page.getByRole("option").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("primary nav tabs are real links, not buttons", async ({ page }) => {
    // Each visible tab must be an <a> with an href so it supports
    // open-in-new-tab / middle-click and announces as a link.
    const dashboardTab = page.getByRole("link", { name: /^dashboard$/i });
    await expect(dashboardTab).toBeVisible();
    await expect(dashboardTab).toHaveAttribute("href", "/dashboard");

    // The active tab carries aria-current=page.
    const casesTab = page.getByRole("link", { name: /^cases$/i });
    await expect(casesTab).toHaveAttribute("aria-current", "page");

    // Plain click still soft-navigates.
    await dashboardTab.click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("arrow-key nav anchors focus on the listbox, never <body>", async ({
    page,
  }) => {
    const listbox = page.getByRole("listbox", { name: /^cases$/i });
    await listbox.focus();
    await page.keyboard.press("ArrowDown");

    // Focus must rest on the listbox container — not an <option> row,
    // and crucially not <body> (which is where the old row-focus model
    // landed once a row unmounted).
    const activeRole = await page.evaluate(
      () => document.activeElement?.getAttribute("role") ?? null,
    );
    expect(activeRole).toBe("listbox");

    const onBody = await page.evaluate(
      () => document.activeElement === document.body,
    );
    expect(onBody).toBe(false);
  });

  test("the queue is a single Tab stop (rows are not individually tabbable)", async ({
    page,
  }) => {
    const listbox = page.getByRole("listbox", { name: /^cases$/i });
    await listbox.focus();
    await page.keyboard.press("Tab");

    // One Tab must move focus OUT of the listbox entirely. Pre-fix the
    // option <button>s were each a Tab stop, so Tab landed on the next
    // row instead of leaving the pane.
    const stillInsideListbox = await page.evaluate(() => {
      const lb = document.querySelector('[role="listbox"]');
      return lb ? lb.contains(document.activeElement) : false;
    });
    expect(stillInsideListbox).toBe(false);
  });

  test("the workspace is viewport-locked: panes scroll, the document does not", async ({
    page,
  }) => {
    // At lg+ the <main> is pinned to calc(100vh - nav) and clips its
    // overflow, so the document itself must not grow a vertical
    // scrollbar — each pane scrolls on its own.
    const docScrolls = await page.evaluate(() => {
      const doc = document.documentElement;
      // +2 absorbs sub-pixel rounding.
      return doc.scrollHeight - doc.clientHeight > 2;
    });
    expect(
      docScrolls,
      "the document must not scroll at lg+ — the workspace is " +
        "viewport-locked and each pane scrolls its own overflow",
    ).toBe(false);

    // The queue's scroll container must be a real independent scroller
    // (overflow-y: auto), so a long queue scrolls without moving the
    // detail pane.
    const queueScroller = page
      .locator('[aria-label="Case queue"] div.overflow-y-auto')
      .first();
    const overflowY = await queueScroller.evaluate(
      (el) => getComputedStyle(el).overflowY,
    );
    expect(["auto", "scroll"]).toContain(overflowY);
  });
});
