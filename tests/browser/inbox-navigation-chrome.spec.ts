/**
 * inbox-navigation-chrome — operator-visible navigation regressions
 * surfaced in product review.
 *
 * Two scenarios this spec validates end-to-end against the live app:
 *
 *   N1. Inbox row click selects locally and updates the right-pane
 *       case-header detail in place. The right pane renders an
 *       explicit "Open case" jump button that navigates to
 *       /cases/{case_id} — the canonical case detail surface.
 *
 *       (ADR-038 §H.6 / Phase 28.5 V5.1 — supersedes the ADR-034
 *        §6.1 inbox-row → /exceptions/{id}?from=inbox jump. The
 *        master-detail dispatch is unchanged; only the off-surface
 *        target moves from per-event exception detail to canonical
 *        case detail.)
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


test("N1 — inbox row selects locally; Open case button navigates to /cases/{id}", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/inbox");

  // V5.1.1 — rows project from `useManualOrderCases()` and now
  // render with `role="option"` inside a `role="listbox"` parent
  // (Phase 28.5.x §D5 a11y swap). Aria-label shape:
  // `Select case <PO-or-SO-or-case_id>`. Skip when no
  // manual-order cases are visible (clean tenant); the assertion is
  // meaningful only against a seeded backend.
  const rows = page.locator('[role="option"][aria-label^="Select case"]');
  const rowCount = await rows.count();
  if (rowCount === 0) {
    test.skip(true, "No manual-order cases seeded — skip until backend has cases.");
    return;
  }

  const beforeUrl = page.url();
  await rows.first().click();

  // ── Click stays on /inbox — master-detail, no full-page nav ────
  await page.waitForTimeout(500);
  expect(page.url()).toBe(beforeUrl);
  expect(page.url()).toMatch(/\/inbox(\?|$)/);

  // ── Right-pane "Open case" button visible after row selection ─
  const openCaseBtn = page.getByRole("button", { name: /open case/i });
  await expect(openCaseBtn).toBeVisible({ timeout: 5_000 });

  // ── Click → navigates to /cases/{case_id} ──────────────────────
  await openCaseBtn.click();
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
