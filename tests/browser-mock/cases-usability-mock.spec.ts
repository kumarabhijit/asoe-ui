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
    // Each nav destination must be an <a href> (supports open-in-new-tab
    // / middle-click and announces as a link). Select by href, not
    // label — labels are product copy (e.g. the /dashboard tab reads
    // "Performance", not "Dashboard").
    const nav = page.locator("nav").first();
    const dashboardLink = nav.locator('a[href="/dashboard"]');
    await expect(dashboardLink).toHaveCount(1);

    // The active tab (/cases) carries aria-current=page.
    const casesLink = nav.locator('a[href="/cases"]');
    await expect(casesLink).toHaveAttribute("aria-current", "page");

    // Plain click still soft-navigates (Next <Link>).
    await dashboardLink.click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("arrow-key nav anchors focus on the listbox, never <body>", async ({
    page,
  }) => {
    const listbox = page.getByRole("listbox", { name: /^cases$/i });
    await listbox.focus();
    await page.keyboard.press("ArrowDown");
    // Let the selection land (arrow nav writes ?case= via router.replace).
    await page.waitForURL(/case=/, { timeout: 15_000 });

    // Focus must rest on the listbox container — not an <option> row,
    // and crucially not <body> (which is where the old row-focus model
    // landed once a row unmounted).
    const active = await page.evaluate(() => ({
      role: document.activeElement?.getAttribute("role") ?? null,
      isBody: document.activeElement === document.body,
    }));
    expect(active.isBody).toBe(false);
    expect(active.role).toBe("listbox");
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

  test("F6 moves focus out of the queue into another pane", async ({
    page,
  }) => {
    // Open a case so the detail pane (and, at xl, the record-list pane)
    // exist as F6 targets.
    await page.getByRole("option").first().click();
    await page.waitForURL(/case=/, { timeout: 15_000 });

    const listbox = page.getByRole("listbox", { name: /^cases$/i });
    await listbox.focus();
    await page.keyboard.press("F6");

    const stillInQueue = await page.evaluate(() => {
      const lb = document.querySelector(
        '[role="listbox"][aria-label="Cases"]',
      );
      if (!lb) return false;
      return lb === document.activeElement || lb.contains(document.activeElement);
    });
    expect(
      stillInQueue,
      "F6 must move focus out of the queue to the next pane",
    ).toBe(false);
  });

  test("the record list is a single Tab stop with arrow-key selection", async ({
    page,
  }) => {
    // Deep-link to a known multi-record case (3 attached records).
    await page.goto("/cases?case=case-multi-WMT-Q1RESET");
    const group = page
      .getByRole("radiogroup", { name: /select a record/i })
      .first();
    await expect(group).toBeVisible({ timeout: 30_000 });

    // Exactly one radio is in the Tab order (roving tabindex).
    await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);

    // Arrow-key selection updates the URL ?record=.
    await group.locator('[role="radio"][tabindex="0"]').focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForURL(/record=/, { timeout: 15_000 });
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
