/**
 * inbox-navigation-chrome — operator-visible navigation regressions
 * surfaced in product review.
 *
 * Two scenarios this spec validates end-to-end against the live app:
 *
 *   N1. Issue #133, PO #9 — `/inbox` is now a server redirect into
 *       `/cases?source=manual_order`. Operators hitting the legacy
 *       URL (from notification emails, browser history, runbooks)
 *       land on the case-list view filtered to manual orders.
 *       Clicking a row navigates directly to `/cases/{case_id}` —
 *       the canonical case detail surface.
 *
 *       (The previous V5.1 anatomy hosted a master-detail surface
 *        on /inbox where row clicks selected locally and a separate
 *        "Open case" jump button navigated off-surface. The PO
 *        review retired the parallel surface — see issue #133 and
 *        the redirect-only contract test at
 *        tests/contract/test_navigation_chrome.test.ts.)
 *
 *   N2. /cases/[id] keeps the canonical NavBar with the Sign out
 *       menu item visible. Operators must always have the exit
 *       point — historically the detail pages dropped onSignOut
 *       and the menu item disappeared. (R1 in
 *       tests/contract/test_navigation_chrome.test.ts is the
 *       structural lock; this Playwright leg validates the
 *       rendered behaviour end-to-end.)
 */
import { expect, test } from "@playwright/test";

import { loginAs, USERS } from "./_helpers";

test.describe.configure({ mode: "serial" });


test("N1 — /inbox redirects to /cases?source=manual_order; row click navigates to /cases/{id}", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);

  // ── /inbox is a server redirect; the operator lands on /cases ──
  // The URL after `goto` is the redirect destination, including the
  // source-filter query string the CaseListPane reads.
  await page.goto("/inbox");
  await page.waitForURL(/\/cases(\?|$)/, { timeout: 10_000 });
  expect(page.url()).toMatch(/\/cases\?[^?]*source=manual_order/);

  // ── Case-list rows on /cases ───────────────────────────────────
  // /cases/page.tsx renders each row as a `<button>` with an
  // `aria-label="Open case <case_id>"`. The surface does NOT use
  // the V5.1.1 master-detail listbox pattern (that was specific to
  // the retired /inbox surface). Skip when no manual-order cases
  // are seeded — the assertion is meaningful only against a seeded
  // backend.
  const rows = page.getByRole("button", { name: /^Open case / });
  const rowCount = await rows.count();
  if (rowCount === 0) {
    test.skip(true, "No manual-order cases seeded — skip until backend has cases.");
    return;
  }

  // ── Row click → navigates directly to /cases/{case_id} ─────────
  // The /cases surface clicks straight through to the case detail;
  // there is no intermediate master-detail step.
  await rows.first().click();
  await page.waitForURL(/\/cases\/[^/?]+(\?|$)/, { timeout: 10_000 });
});


test("N2 — /cases/[id] keeps NavBar with Sign out in the user menu", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");
  const firstCaseRow = page.locator("table tbody tr").first();
  if ((await firstCaseRow.count()) === 0) {
    test.skip(
      true,
      "No cases visible for the manager — skip N2 until cases seeded.",
    );
    return;
  }
  await firstCaseRow.click();
  await page.waitForURL(/\/cases\/[^/?]+(\?|$)/, { timeout: 10_000 });

  // The NavBar must still be there — historically /cases/[id]
  // rendered no NavBar at all and operators had no way to sign out
  // without typing a URL.
  await expect(
    page.getByRole("button", { name: /user menu/i }),
  ).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /user menu/i }).click();
  await expect(
    page.getByRole("menuitem", { name: /sign out/i }),
  ).toBeVisible({ timeout: 5_000 });
});
