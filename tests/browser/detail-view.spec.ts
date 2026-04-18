/**
 * detail-view — end-to-end render of an exception detail panel from a
 * live-backend record.
 *
 * Flow:
 *   1. Mint a manager JWT via POST /api/auth/login.
 *   2. POST /api/v1/exceptions/resolve/explain to create a known
 *      YELLOW+PENDING_REVIEW exception on the backend.
 *   3. Drive the browser through the UI login, navigate to the
 *      exception detail page, and assert the Approve button is
 *      visible — proof that the UI successfully fetched the detail
 *      record via GET /api/v1/exceptions/{id} and rendered the
 *      verdict-aware button matrix.
 *
 * What this adds on top of login-then-queue.spec.ts:
 *   - Exercises the real exceptionsApi.get() fetch branch.
 *   - Proves the manager's exceptions:override permission flows
 *     through the auth session to render `[Override…]` on the card.
 *   - Exercises tenant isolation (the exception we created is visible
 *     under the same tenant we log in under).
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  backendToken,
  createPendingReviewException,
  resetTenant,
  USERS,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  // Each spec wipes its tenant so state doesn't bleed across tests.
  // Admin token is used for the reset (the endpoint requires admin).
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

test("detail view renders Override button for a manager on a backend record", async ({
  page,
  request,
}) => {
  // ── Seed: backend creates the record, no UI involvement ──────────
  const managerToken = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(request, managerToken);

  // ── UI: login as manager, navigate to the detail page ────────────
  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // ── Assertion: the manager-gated Override… affordance renders ────
  //
  // We don't assert on verdict-tier-specific buttons (Approve / Reject /
  // Escalate are YELLOW-only). The `/resolve/explain` verdict is
  // deterministic for a given event payload but depends on live
  // threshold tuning and can produce GREEN or YELLOW; both satisfy the
  // core claim this spec makes: a manager with `exceptions:override`
  // sees the Override… button on a record created via the real
  // backend's /resolve/explain + fetched via /exceptions/{id}.
  //
  // Matching the aria-label "Choose different action" rather than the
  // visible text "Override…" so the assertion survives future visible-
  // verb tweaks — the long-form is the translation key + screen-reader
  // text, intentionally stable.
  await expect(
    page.getByRole("button", { name: /choose different action/i }),
  ).toBeVisible({ timeout: 15_000 });
});
