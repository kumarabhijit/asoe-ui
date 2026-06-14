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
    // A wide desktop viewport so the two-pane layout (queue + detail
    // with the record-list picker stacked on top) is active.
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

  // DEFERRED (parity flip, Step 3): these exercise the multi-record
  // RecordListPane via MULTI_RECORD_CASE. The served queue is now the
  // catalog-generated CATALOG_EXCEPTIONS, which projects one case per
  // scenario (every catalog scenario has a unique order_id, and the
  // backend bootstrap groups by order_id) — so no multi-record case
  // exists and the "select a record" radiogroup never renders. Re-enable
  // when the catalog expresses a multi-record case (scenarios sharing an
  // order_id) + gen-mock-data groups parent_case_id by order_id.
  test.skip("the record-list pane is a single Tab stop with arrow-key selection", async ({
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

  // (see deferral note above)
  test.skip("the record-list picker is stacked inside the detail pane", async ({
    page,
  }) => {
    // Two-pane layout: there is no dedicated record-list column — the
    // picker is stacked at the top of the detail pane (full width, no
    // truncated labels) and scrolls together with the detail content.
    await page.goto(`/cases?case=${MULTI_RECORD_CASE}`);
    const group = page
      .getByRole("radiogroup", { name: /select a record/i })
      .first();
    await expect(group).toBeVisible({ timeout: 30_000 });
    // The picker lives INSIDE the Case workspace pane.
    const insideDetail = await group.evaluate(
      (el) => !!el.closest('section[aria-label="Case workspace"]'),
    );
    expect(insideDetail).toBe(true);
    // And the document still does not scroll (panes are viewport-locked).
    const docScrolls = await page.evaluate(
      () =>
        document.documentElement.scrollHeight -
          document.documentElement.clientHeight >
        2,
    );
    expect(docScrolls).toBe(false);
  });

  // (see deferral note above)
  test.skip("F6 cycles into the detail pane and the pane shows a focus ring", async ({
    page,
  }) => {
    // F6 jumps focus queue → detail (two-pane workspace). The detail
    // <section> must paint a focus-visible ring so the operator can
    // tell focus landed — without it the hop reads as broken.
    await page.goto(`/cases?case=${MULTI_RECORD_CASE}`);
    const detail = page.locator('section[aria-label="Case workspace"]');
    await expect(detail).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("radiogroup", { name: /select a record/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Baseline box-shadow with the pane NOT focused (the section always
    // carries `shadow-xs`, so we compare against this rather than
    // "none").
    const shadowUnfocused = await detail.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );

    // Start in the queue, then F6 → detail.
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[role="listbox"]')?.focus(),
    );
    await page.keyboard.press("F6");

    // Focus reached the detail region.
    const activeLabel = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? null,
    );
    expect(activeLabel).toBe("Case workspace");

    // …and the region now paints a visible focus ring (Tailwind `ring-*`
    // renders as an extra box-shadow layer on top of `shadow-xs`). On
    // the parent commit the section had only `focus:outline-none`, so
    // the focused box-shadow was identical to the unfocused one.
    const shadowFocused = await detail.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(shadowFocused).not.toBe(shadowUnfocused);
  });

  // (see deferral note above)
  test.skip("arrow keys scroll the focused detail pane (queue does not hijack them)", async ({
    page,
  }) => {
    // Bug report: keyboard scrolling in a pane "sometimes works and
    // sometimes does not". Root cause: the queue's document-level
    // useKeyboardListNav swallowed Arrow/Home/End/j/k even when focus
    // was in the detail pane — blocking the pane's native scroll,
    // jumping the queue to another case, and stealing focus back. With
    // the focused detail pane scrollable, ArrowDown must scroll IT and
    // leave the queue selection + focus alone.
    await page.goto(`/cases?case=${MULTI_RECORD_CASE}`);
    const detail = page.locator('section[aria-label="Case workspace"]');
    await expect(detail).toBeVisible({ timeout: 30_000 });
    // S1 finding #9 (2026-05-28) — multi-record cases no longer
    // auto-mount the first record's panel. The picker is the first
    // beat; the operator must commit a selection before the inline
    // ExceptionDetailPanel (and its Agent Recommendation card) renders.
    // Pick the first row so the rest of this test continues to
    // exercise a real detail-pane scroll.
    const recordPicker = page
      .getByRole("radiogroup", { name: /select a record/i })
      .first();
    await expect(recordPicker).toBeVisible({ timeout: 30_000 });
    await recordPicker.locator('[role="radio"]').first().click();
    await page.waitForURL(/record=/, { timeout: 20_000 });
    // Let the detail content render so the pane actually overflows.
    await expect(
      detail.getByText(/Agent Recommendation/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const d = document.querySelector(
          'section[aria-label="Case workspace"]',
        );
        return !!d && d.scrollHeight > d.clientHeight + 20;
      },
      { timeout: 30_000 },
    );

    // F6 → detail.
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[role="listbox"]')?.focus(),
    );
    await page.keyboard.press("F6");
    expect(
      await page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") ?? null,
      ),
    ).toBe("Case workspace");

    const urlBefore = new URL(page.url()).search;
    const topBefore = await detail.evaluate((el) => el.scrollTop);

    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    const topAfter = await detail.evaluate((el) => el.scrollTop);
    const urlAfter = new URL(page.url()).search;
    const activeAfter = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? null,
    );

    expect(topAfter).toBeGreaterThan(topBefore); // the pane scrolled
    expect(urlAfter).toBe(urlBefore); // queue did NOT jump
    expect(activeAfter).toBe("Case workspace"); // focus stayed put
  });
});
