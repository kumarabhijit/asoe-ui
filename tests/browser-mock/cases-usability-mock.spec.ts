/**
 * /cases workspace usability regressions (MOCK MODE).
 *
 * Partner browser e2e for the source-level locks in
 * `tests/architectural/cases_workspace_render_guard.test.ts` and the
 * jsdom behavioural tests (`useKeyboardListNav`, `RecordListPane`,
 * `usePaneFocusCycle`). Per the test-strategy rule, a state-machine
 * surface gets BOTH a source lock and a multi-step operator-journey
 * browser e2e — this is the latter.
 *
 * Scope note: the precise keyboard FOCUS movements (which element
 * holds `document.activeElement` after a key) are exercised
 * deterministically in jsdom, where there is no real layout/raf race.
 * Here we assert the things only a REAL browser can confirm and jsdom
 * cannot: anchor (vs button) nav semantics, the responsive CSS layout
 * (viewport-locked panes, independent scroll containers), the roving
 * `tabindex` wiring, and the URL outcomes of keyboard selection. These
 * are non-timing-dependent (DOM attributes, computed styles, URL), so
 * they're stable in CI.
 *
 * Mock mode: self-contained (next dev, no backend). Run via
 * `npm run test:browser:mock`.
 */
import { test, expect } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

// A known multi-record case in the mock fixtures (3 attached records),
// so the middle record-list pane renders with several rows.
const MULTI_RECORD_CASE = "case-multi-WMT-Q1RESET";

test.describe("/cases usability (mock mode)", () => {
  test.beforeEach(async ({ page }) => {
    // 1440 is comfortably past the xl breakpoint (1280) so the
    // three-pane layout (incl. the record-list column) is active.
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, USERS.MANAGER);
    await page.goto("/cases");
    await expect(page.getByRole("option").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("primary nav tabs are real links, not buttons", async ({ page }) => {
    // Each nav destination is an <a href> (supports open-in-new-tab /
    // middle-click and announces as a link). Select by href, not label
    // — labels are product copy (e.g. the /dashboard tab reads
    // "Performance").
    const nav = page.locator("nav").first();
    await expect(nav.locator('a[href="/dashboard"]')).toHaveCount(1);

    // The active tab (/cases) carries aria-current=page.
    await expect(nav.locator('a[href="/cases"]')).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Plain click still soft-navigates (Next <Link>).
    await nav.locator('a[href="/dashboard"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("the queue is a single Tab stop (listbox tabbable, rows roved out)", async ({
    page,
  }) => {
    const listbox = page.getByRole("listbox", { name: /^cases$/i });
    await expect(listbox).toHaveAttribute("tabindex", "0");
    // Every option row is removed from the Tab order (roving via
    // aria-activedescendant) — pre-fix each <button role=option> was
    // its own Tab stop.
    const tabbableRows = listbox.locator('[role="option"][tabindex="0"]');
    await expect(tabbableRows).toHaveCount(0);
    const rows = listbox.locator('[role="option"]');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("queue arrow-key selection updates the URL (?case=)", async ({
    page,
  }) => {
    // Focus the listbox (not a text field), press ArrowDown — the
    // document-level handler selects a case and writes ?case=. Asserts
    // the URL outcome, not focus, so it's timing-stable.
    const listbox = page.getByRole("listbox", { name: /^cases$/i });
    await listbox.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForURL(/case=/, { timeout: 15_000 });
  });

  test("the record-list pane is a single Tab stop with arrow-key selection", async ({
    page,
  }) => {
    await page.goto(`/cases?case=${MULTI_RECORD_CASE}`);
    const group = page
      .getByRole("radiogroup", { name: /select a record/i })
      .first();
    await expect(group).toBeVisible({ timeout: 30_000 });

    // Roving tabindex: exactly one radio is in the Tab order.
    await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
    expect(await group.locator('[role="radio"]').count()).toBeGreaterThan(1);

    // Arrow-key selection updates the URL ?record= (URL outcome, not
    // focus — timing-stable).
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
      return doc.scrollHeight - doc.clientHeight > 2; // +2 for rounding
    });
    expect(
      docScrolls,
      "the document must not scroll at lg+ — the workspace is " +
        "viewport-locked and each pane scrolls its own overflow",
    ).toBe(false);

    // The queue's scroll container is a real independent scroller.
    const queueScroller = page
      .locator('[aria-label="Case queue"] div.overflow-y-auto')
      .first();
    const overflowY = await queueScroller.evaluate(
      (el) => getComputedStyle(el).overflowY,
    );
    expect(["auto", "scroll"]).toContain(overflowY);
  });

  test("the record-list (middle) pane is its own independent scroller", async ({
    page,
  }) => {
    // Regression for "the middle pane needs scrolling to the top to
    // reach" — `xl:contents` makes the <aside> the direct grid child so
    // it stretches to the locked row height and scrolls its own list,
    // instead of overflowing and getting clipped by the workspace.
    await page.goto(`/cases?case=${MULTI_RECORD_CASE}`);
    const group = page
      .getByRole("radiogroup", { name: /select a record/i })
      .first();
    await expect(group).toBeVisible({ timeout: 30_000 });
    const overflowY = await group.evaluate(
      (el) => getComputedStyle(el).overflowY,
    );
    expect(["auto", "scroll"]).toContain(overflowY);
    // And the document still does not scroll with the middle pane open.
    const docScrolls = await page.evaluate(
      () =>
        document.documentElement.scrollHeight -
          document.documentElement.clientHeight >
        2,
    );
    expect(docScrolls).toBe(false);
  });
});
