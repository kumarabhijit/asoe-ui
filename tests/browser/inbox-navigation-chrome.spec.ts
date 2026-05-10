/**
 * inbox-navigation-chrome — operator-visible navigation regressions
 * surfaced in product review.
 *
 * Three scenarios the contract tests guard structurally; this spec
 * validates them end-to-end against the live app:
 *
 *   N1. Inbox row click on ANY item (Email-Order-Entry or otherwise)
 *       selects locally and updates the right-pane detail in place.
 *       For items linked to an Exception Queue record, the right
 *       pane renders an explicit "Open in Exception Queue" jump
 *       button. Clicking it navigates to /exceptions/<id>?from=inbox
 *       and the detail surface shows "Back to Inbox".
 *
 *       (ADR-034 §6.1, PO ruling 2026-05-10 — superseded the original
 *        Phase G.3 deep-link dispatch in favour of consistent
 *        master-detail UX + explicit jump button.)
 *
 *   N2. Both /exceptions/[id] and /cases/[id] keep the canonical
 *       NavBar with the Sign out menu item visible. Operators must
 *       always have the exit point — historically the detail pages
 *       dropped onSignOut and the menu item disappeared.
 *
 *   N3. Inbox rows WITHOUT an exception_id (SHIPMENT_INQUIRY,
 *       INVOICE_QUERY, COMPLAINT) keep the same master-detail
 *       behaviour as N1 but render NO jump button — the right pane
 *       has no Exception Queue counterpart to open.
 */
import { expect, test } from "@playwright/test";

import { loginAs, USERS } from "./_helpers";

test.describe.configure({ mode: "serial" });

test("N1 — inbox row selects locally; jump button opens exception detail with Back to Inbox", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/inbox");

  // The inbox is seeded from a static INBOX constant in
  // src/app/inbox/page.tsx. Per ADR-034 §6.1, every row's
  // aria-label has the same shape now: "Select email from <sender>:
  // <subject>". Pick the row whose detail will carry an
  // `exception_id` — INBOX[3] (id="4", exception_id="exc-026") in
  // the seed.
  const targetSubject = INBOX_EXCEPTION_SUBJECT;
  const exceptionRow = page.locator(
    `[role="button"][aria-label*="${targetSubject}"]`,
  );
  await expect(exceptionRow).toBeVisible({ timeout: 10_000 });

  const beforeUrl = page.url();
  await exceptionRow.click();

  // ── Click stays on /inbox — master-detail, no full-page nav ────
  // Give the route a chance to change if it's going to (it shouldn't).
  await page.waitForTimeout(500);
  expect(page.url()).toBe(beforeUrl);
  expect(page.url()).toMatch(/\/inbox(\?|$)/);

  // ── Right-pane jump button is visible (selected.exception_id set) ─
  const jumpBtn = page.getByRole("button", {
    name: /open exception .* in exception queue/i,
  });
  await expect(jumpBtn).toBeVisible({ timeout: 5_000 });

  // ── Click jump → navigates to /exceptions/<id>?from=inbox ──────
  await jumpBtn.click();
  await page.waitForURL(/\/exceptions\/[^/?]+\?from=inbox/, {
    timeout: 10_000,
  });

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
  // Reach a detail page through the supersession flow: select the
  // exception-bearing row, then click the jump button.
  const exceptionRow = page.locator(
    `[role="button"][aria-label*="${INBOX_EXCEPTION_SUBJECT}"]`,
  );
  await expect(exceptionRow).toBeVisible({ timeout: 10_000 });
  await exceptionRow.click();
  const jumpBtn = page.getByRole("button", {
    name: /open exception .* in exception queue/i,
  });
  await expect(jumpBtn).toBeVisible({ timeout: 5_000 });
  await jumpBtn.click();
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
  await page.goto("/cases");
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


test("N3 — non-exception inbox row stays on /inbox AND shows no jump button", async ({
  page,
}) => {
  await loginAs(page, USERS.MANAGER);
  await page.goto("/inbox");

  // Pick any inbox row that does not have an exception_id (in the
  // current seed: rows id=1, 2, 3, 5, 6 are non-exception). We use
  // a structural selector rather than a hard subject string so the
  // test survives seed edits — pick the FIRST row whose detail
  // does NOT render the jump button.
  const rows = page.locator('[role="button"][aria-label^="Select email from"]');
  const rowCount = await rows.count();
  expect(
    rowCount,
    "Expected at least one non-exception inbox row in the seed.",
  ).toBeGreaterThan(0);

  let foundNonException = false;
  for (let i = 0; i < rowCount; i++) {
    await rows.nth(i).click();
    const jump = page.getByRole("button", {
      name: /open exception .* in exception queue/i,
    });
    // A short timeout — if the button is not present after the
    // selection settles, this is the row we want.
    const visible = await jump.isVisible().catch(() => false);
    if (!visible) {
      foundNonException = true;
      break;
    }
  }
  expect(
    foundNonException,
    "Could not find a non-exception inbox row in the seed; the jump " +
      "button rendered for every row, which contradicts ADR-034 §6.1.",
  ).toBe(true);

  // URL must remain on /inbox throughout.
  expect(page.url()).toMatch(/\/inbox(\?|$)/);
});


// Subject prefix used to locate the exception-bearing inbox row. Maps
// to INBOX[3] (id="4", exception_id="exc-026") in src/app/inbox/page.tsx
// — the MANUAL_ORDER_INTAKE STANDARD_REVIEW demo record. Match a prefix,
// not the full string, since the seed truncates with an ellipsis
// (e.g. "Kroger PO KRO-2025-03-44821 — Bever..."). If the seed for
// exc-026 changes, update this constant and the comment so the spec
// doesn't silently start matching the wrong row.
const INBOX_EXCEPTION_SUBJECT = "Kroger PO KRO-2025-03-44821";
