/**
 * override-and-sod — end-to-end Override chooser + Segregation-of-Duties.
 *
 * Flow:
 *   1. Manager A creates a PENDING_REVIEW record (GREEN verdict —
 *      manager has Override… visible on GREEN).
 *   2. Manager A clicks Override…, picks a chosen_action that differs
 *      from the recipe recommendation → server classifies as
 *      sub_type=OVERRIDE, applies it, lifecycle → RESOLVED.
 *   3. Manager A tries a SECOND override on the same record → backend
 *      returns 403 SOD_VIOLATION (caller.sub == prior resolved_by).
 *      The UI surfaces the error via the error toast.
 *
 * Exercises:
 *   - Override chooser dialog (Radix Dialog + selects + mandatory notes)
 *   - exceptionsApi.disposition() fetch branch with Idempotency-Key
 *   - Server-side sub_type derivation (chosen != recommended → OVERRIDE)
 *   - SoD guard (403 SOD_VIOLATION on self-re-override)
 *   - Error-envelope propagation from asoe2 to the UI toast
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

test("manager overrides → self second attempt hits SOD_VIOLATION toast", async ({
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

  // ── Second override by the same manager → SOD_VIOLATION ──────────
  // Manager+ still sees Override… on RESOLVED (GREEN verdict matrix).
  // Submitting must surface the backend's 403 error envelope.
  await expect(openOverride).toBeVisible({ timeout: 5_000 });
  await openOverride.click();
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByLabel(/^resolution action$/i).selectOption("ALLOW_BOTH");
  await dialog.getByLabel(/^override reason category$/i).selectOption("other");
  await dialog.getByLabel(/^override notes$/i).fill("self-re-override attempt");
  await dialog.getByRole("button", { name: /confirm override/i }).click();

  // The "SOD_VIOLATION: Segregation of duties: ..." error toast
  // appears. Match `.first()` because Next's dev-mode console-error
  // overlay also echoes the text verbatim — both elements are proof
  // the error propagated; the toast is what operators see in prod.
  await expect(
    page.getByText(/segregation of duties/i).first(),
  ).toBeVisible({ timeout: 10_000 });

  // Backend state unchanged — still the first override's action.
  const finalRes = await request.get(
    `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const finalBody = await finalRes.json();
  expect(finalBody.lifecycle_state).toBe("RESOLVED");
  expect(finalBody.resolved_action).toBe("SUPERSEDE");
});
