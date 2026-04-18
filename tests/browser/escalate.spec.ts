/**
 * escalate — scaffolded, currently skipped.
 *
 * Analyst opens a YELLOW exception, clicks Escalate, provides a reason,
 * and observes the lifecycle move to ESCALATED. Verifies /api/v1/escalate
 * fires with the analyst's exceptions:escalate permission (not piggy-
 * backing on the override endpoint).
 */
import { test } from "@playwright/test";

test.describe.skip("Escalate — SCAFFOLD", () => {
  test("analyst escalates a YELLOW exception → lifecycle ESCALATED", async () => {
    // Pseudocode:
    //   const tokenA = await backendToken(request, USERS.ANALYST);
    //   const eid = await createPendingReviewException(request, tokenA);
    //   await loginAs(page, USERS.ANALYST);
    //   await page.goto(`/exceptions/${eid}`);
    //   await page.getByRole("button", { name: /send for triage/i }).click();
    //   // handle the reason prompt (window.prompt is tricky; use
    //   // page.on('dialog', d => d.accept('needs senior review')) )
    //   await expect(page.getByText(/escalated/i)).toBeVisible();
  });
});
