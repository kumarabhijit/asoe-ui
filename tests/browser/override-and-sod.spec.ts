/**
 * override-and-sod — scaffolded, currently skipped.
 *
 * Asserts the full Override disposition + Segregation-of-Duties story
 * through the UI:
 *   1. Manager A opens a YELLOW exception, clicks Override…, picks a
 *      different action, fills notes + reason_tag, submits.
 *   2. Backend responds 200 RESOLVED; detail panel updates.
 *   3. Manager A logs out, Manager B logs in, opens the same record,
 *      tries a second override → SoD banner / toast surfaces the 403
 *      SOD_VIOLATION error from the backend.
 *
 * Why skipped: the chooser dialog's selector surface isn't stable in
 * this branch (Radix/Shadcn Dialog uses portals + deferred mounting),
 * and getting the assertion matrix deterministic needs a few rounds of
 * selector hardening. Unskip once the Override chooser gets stable
 * data-testid hooks — see `ExceptionDetailPanel.tsx` override dialog.
 */
import { test } from "@playwright/test";

test.describe.skip("Override disposition + SoD — SCAFFOLD", () => {
  test("manager A overrides → RESOLVED; manager B second override → SoD 403", async () => {
    // Pseudocode:
    //   const tokenA = await backendToken(request, USERS.MANAGER);
    //   const eid = await createPendingReviewException(request, tokenA);
    //   await loginAs(page, USERS.MANAGER);
    //   await page.goto(`/exceptions/${eid}`);
    //   await page.getByRole("button", { name: /choose different action/i }).click();
    //   await page.getByRole("combobox", { name: /resolution action/i }).selectOption("SUPERSEDE");
    //   await page.getByRole("combobox", { name: /reason category/i }).selectOption("policy_exception");
    //   await page.getByRole("textbox", { name: /notes/i }).fill("manager A overrides");
    //   await page.getByRole("button", { name: /^override$/i }).click();
    //   await expect(page.getByText(/resolved/i)).toBeVisible();
    //
    //   await context.clearCookies();
    //   await loginAs(page, USERS.MANAGER_2);
    //   await page.goto(`/exceptions/${eid}`);
    //   await page.getByRole("button", { name: /choose different action/i }).click();
    //   // … second override attempt …
    //   await expect(page.getByText(/segregation of duties/i)).toBeVisible();
  });
});
