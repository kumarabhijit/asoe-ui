/**
 * override-and-sod — end-to-end Override chooser + self-override allowance.
 *
 * Flow:
 *   1. Manager A creates a PENDING_REVIEW record (GREEN verdict —
 *      manager has Override… visible on GREEN).
 *   2. Manager A clicks Override…, picks a chosen_action that differs
 *      from the recipe recommendation → server classifies as
 *      sub_type=OVERRIDE, applies it, lifecycle → RESOLVED.
 *   3. Manager A clicks Override… AGAIN on the same record → succeeds
 *      (PO ruling 2026-05-03 — same user is allowed to correct their
 *      own prior override). Backend persists the new resolved_action.
 *
 * Exercises:
 *   - Override chooser dialog (Radix Dialog + selects + mandatory notes)
 *   - exceptionsApi.disposition() fetch branch with Idempotency-Key
 *   - Server-side sub_type derivation (chosen != recommended → OVERRIDE)
 *   - Self-override allowance (the SoD self-block was relaxed; the
 *     four-eyes cosign rule on high-value overrides is the SOX §404
 *     control that remains in force, exercised by other tests).
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  backendToken,
  createPendingReviewException,
  resetTenant,
  USERS,
  BACKEND_URL,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

test("manager overrides → self-re-override is allowed (PO ruling 2026-05-03)", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(request, token);

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // ── First override: open dialog, fill form, confirm ────────────
  const openOverride = page.getByRole("button", { name: /choose different action/i });
  await expect(openOverride).toBeVisible({ timeout: 15_000 });
  await openOverride.click();

  const dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Pick any valid AllowedResolutionAction that's unlikely to match
  // the PriceAdjustmentRecipe's recommended_action — this guarantees
  // server-side sub_type=OVERRIDE (chosen != recommended) instead of
  // APPROVE (chosen == recommended). SUPERSEDE is a DUPLICATE_PO
  // action that never matches a CONTRACTUAL_CORRECTION recommendation.
  await dialog.getByLabel(/^resolution action$/i).selectOption("SUPERSEDE");
  await dialog.getByLabel(/^override reason category$/i).selectOption("policy_exception");
  await dialog.getByLabel(/^override notes$/i).fill("first override by manager — SoD test");
  await dialog.getByRole("button", { name: /confirm override/i }).click();

  // Verify backend flipped to RESOLVED.
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).lifecycle_state : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("RESOLVED");

  // ── Second override by the same manager → succeeds ──────────────
  // PO ruling 2026-05-03: self-override of a prior resolution is now
  // allowed (operators legitimately need to correct their own earlier
  // overrides without escalation churn). The four-eyes rule on
  // high-value overrides remains the SOX §404 control of record;
  // that's exercised by separate cosign tests.
  await expect(openOverride).toBeVisible({ timeout: 5_000 });
  await openOverride.click();
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByLabel(/^resolution action$/i).selectOption("ALLOW_BOTH");
  await dialog.getByLabel(/^override reason category$/i).selectOption("other");
  await dialog.getByLabel(/^override notes$/i).fill("self-correction of prior override");
  await dialog.getByRole("button", { name: /confirm override/i }).click();

  // No "Segregation of duties" toast must appear — assert absence
  // before reading backend state so a regression to the old SoD
  // self-block fails this test loudly rather than silently.
  await expect(
    page.getByText(/segregation of duties/i),
  ).toHaveCount(0, { timeout: 5_000 });

  // Backend state reflects the NEW override action (ALLOW_BOTH),
  // proving the second submission applied. The poll guards against
  // any in-flight render lag from the toast / detail refresh.
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).resolved_action : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("ALLOW_BOTH");

  const finalRes = await request.get(
    `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const finalBody = await finalRes.json();
  expect(finalBody.lifecycle_state).toBe("RESOLVED");
  expect(finalBody.resolved_action).toBe("ALLOW_BOTH");
});
