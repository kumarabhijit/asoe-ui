/**
 * four-eyes-cosign — scaffolded, currently skipped.
 *
 * End-to-end four-eyes flow:
 *   1. Manager A creates a YELLOW exception with financial_impact_usd
 *      seeded via /api/v1/_sandbox/seed/financial-impact so it crosses
 *      HIGH_VALUE_OVERRIDE_THRESHOLD_USD ($10k).
 *   2. Manager A clicks Override… → dialog → submits → record
 *      transitions to PENDING_COSIGN (stages pending_override).
 *   3. Manager B logs in, opens the record, sees the cosign banner and
 *      [Approve cosign] / [Reject cosign] buttons.
 *   4. Manager B clicks Approve cosign with notes → lifecycle RESOLVED,
 *      resolved_by = Manager A (initiator), cosigned_by = Manager B.
 *   5. Spec also covers the SoD case: Manager A tries to cosign their
 *      own pending override → 403 SOD_VIOLATION surface.
 *
 * Uses the sandbox seed endpoint added in asoe2 alongside this branch.
 */
import { test } from "@playwright/test";

test.describe.skip("Four-eyes cosign — SCAFFOLD", () => {
  test("manager A initiates high-value override → manager B cosigns → RESOLVED", async () => {
    // Pseudocode:
    //   const tokenA = await backendToken(request, USERS.MANAGER);
    //   const eid = await createPendingReviewException(request, tokenA);
    //   await seedFinancialImpact(request, tokenA, eid, 25_000);
    //   await loginAs(page, USERS.MANAGER);
    //   await page.goto(`/exceptions/${eid}`);
    //   // … Override… dialog → submit …
    //   await expect(page.getByText(/pending cosign|awaiting cosign/i)).toBeVisible();
    //
    //   await context.clearCookies();
    //   await loginAs(page, USERS.MANAGER_2);
    //   await page.goto(`/exceptions/${eid}`);
    //   await expect(page.getByText(/awaiting second-reviewer cosign/i)).toBeVisible();
    //   await page.getByRole("button", { name: /approve cosign/i }).click();
    //   // window.prompt for notes
    //   await expect(page.getByText(/resolved/i)).toBeVisible();
  });
});
