/**
 * inbox-navigation-chrome — operator-visible navigation regressions
 * surfaced in product review.
 *
 * Three scenarios the contract tests guard structurally; this spec
 * validates them end-to-end against the live app:
 *
 *   N1. Inbox row click on an Email-Order-Entry item (which carries
 *       an exception_id under ADR-034 Phase G) navigates straight to
 *       the exception detail page WITHOUT showing detail in the right
 *       pane. The detail surface that loads must show "Back to Inbox"
 *       (not "Back to Queue") because the operator's mental return
 *       path is /inbox.
 *
 *   N2. Both /exceptions/[id] and /cases/[id] keep the canonical
 *       NavBar with the Sign out menu item visible. Operators must
 *       always have the exit point — historically the detail pages
 *       dropped onSignOut and the menu item disappeared.
 *
 *   N3. Inbox rows WITHOUT an exception_id (SHIPMENT_INQUIRY,
 *       INVOICE_QUERY, COMPLAINT) keep the master-detail behaviour:
 *       click selects locally, right pane updates, no full-page
 *       navigation. This documents the ADR-034 divergence — if
 *       it ever changes, this spec fails and forces an ADR update.
 */
import { expect, test } from "@playwright/test";

import { loginAs, USERS } from "./_helpers";

test.describe.configure({ mode: "serial" });

test("N1 — Email Order Entry inbox row → exception detail with Back to Inbox", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/inbox");

  // The inbox is seeded from a static INBOX constant in
  // src/app/inbox/page.tsx. The Email-Order-Entry items carry an
  // `exception_id` and render with an aria-label of the form
  // "Open exception <id> for <subject>". Pick the first such row.
  const emailOrderRow = page
    .locator('[role="button"][aria-label^="Open exception"]')
    .first();
  await expect(emailOrderRow).toBeVisible({ timeout: 10_000 });

  // Capture the exception id embedded in the aria-label so we can
  // assert the URL ends up where we expect.
  const ariaLabel = (await emailOrderRow.getAttribute("aria-label")) ?? "";
  const exceptionIdMatch = ariaLabel.match(/Open exception (\S+) /);
  expect(
    exceptionIdMatch,
    `Could not parse exception_id from aria-label ${JSON.stringify(ariaLabel)}`,
  ).not.toBeNull();
  const exceptionId = exceptionIdMatch![1];

  await emailOrderRow.click();

  // ── Click navigates AWAY from /inbox to the full-page detail ─
  await page.waitForURL(/\/exceptions\/[^/?]+(\?|$)/, { timeout: 10_000 });
  expect(page.url()).toContain(exceptionId);
  // The referrer hint must be on the URL — the contract test guards
  // the source code, this test guards the runtime behaviour.
  expect(page.url()).toContain("from=inbox");

  // ── Detail surface renders "Back to Inbox" (not "Back to Queue") ─
  await expect(
    page.getByRole("button", { name: /back to inbox/i }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /back to queue/i })).toHaveCount(
    0,
  );

  // ── Click Back to Inbox — operator returns to the inbox surface ─
  await page.getByRole("button", { name: /back to inbox/i }).click();
  await page.waitForURL(/\/inbox(\?|$)/, { timeout: 10_000 });
});


test("N2a — /exceptions/[id] keeps Sign out in the user menu", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/inbox");
  const emailOrderRow = page
    .locator('[role="button"][aria-label^="Open exception"]')
    .first();
  await expect(emailOrderRow).toBeVisible({ timeout: 10_000 });
  await emailOrderRow.click();
  await page.waitForURL(/\/exceptions\/[^/?]+(\?|$)/, { timeout: 10_000 });

  // Open the user menu and assert Sign out is present.
  await page.getByRole("button", { name: /user menu/i }).click();
  await expect(
    page.getByRole("menuitem", { name: /sign out/i }),
  ).toBeVisible({ timeout: 5_000 });
});


test("N2b — /cases/[id] keeps NavBar with Sign out in the user menu", async ({
  page,
  request,
}) => {
  await loginAs(page, USERS.MANAGER);
  // Navigate to /cases first to discover a real case id; if no cases
  // exist the test can't assert anything meaningful.
  await page.goto("/cases");
  // Case rows render the case_id in their click handler; the easiest
  // structural locator is the row click target. Fall back to skipping
  // when the cases list is empty (fresh tenant).
  const firstCaseRow = page.locator("table tbody tr").first();
  if ((await firstCaseRow.count()) === 0) {
    test.skip(
      true,
      "No cases visible for the manager — skip N2b until cases seeded.",
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


test("N3 — non-exception inbox row stays on /inbox (master-detail, no full-page navigation)", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/inbox");

  // Non-Email-Order-Entry items render with aria-label of the form
  // "Select email from <sender>: <subject>" — no exception_id, the
  // click branch invokes setSelectedId for local master-detail
  // behaviour (no router.push).
  const otherRow = page
    .locator('[role="button"][aria-label^="Select email from"]')
    .first();
  if ((await otherRow.count()) === 0) {
    test.skip(
      true,
      "Inbox seed contains only Email-Order-Entry rows; cannot " +
        "exercise the non-exception branch.",
    );
    return;
  }

  const beforeUrl = page.url();
  await otherRow.click();
  // After click the URL must be unchanged — the row selected locally,
  // not navigated. If a future refactor unifies the inbox dispatch
  // (e.g., wraps every item in an exception), this test fires and
  // forces an ADR-034 review.
  await page.waitForTimeout(500);
  expect(page.url()).toBe(beforeUrl);
});
