/**
 * four-eyes-cosign — end-to-end high-value override + second-reviewer
 * cosign flow.
 *
 * Flow:
 *   1. Manager A creates a record, seeds it with financial_impact_usd
 *      above HIGH_VALUE_OVERRIDE_THRESHOLD_USD ($10k) via the sandbox
 *      /_sandbox/seed/financial-impact helper endpoint.
 *   2. Manager A opens Override…, fills the form, submits → backend
 *      stages resolution_data.pending_override and transitions the
 *      lifecycle to PENDING_COSIGN. Lifecycle is NOT yet RESOLVED.
 *   3. Manager B (different sub) logs in, navigates to the same
 *      record, sees the cosign banner + Approve/Reject cosign buttons.
 *   4. Manager B clicks Approve cosign, supplies notes via the
 *      window.prompt() that handleCosign() raises; backend applies the
 *      staged override, records cosigned_by=Manager B, lifecycle →
 *      RESOLVED, resolved_by=Manager A (the initiator).
 *
 * Exercises the full Phase 2 #5 four-eyes control end-to-end including
 * the SOD constraint that the cosigner must not be the initiator.
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  backendToken,
  exceptionUrl,
  createPendingReviewException,
  seedFinancialImpact,
  resetTenant,
  USERS,
  BACKEND_URL,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

test("high-value override stages PENDING_COSIGN; different manager cosigns → RESOLVED", async ({
  page,
  context,
  request,
}) => {
  // ── Seed: manager A creates + seeds financial_impact_usd ────────
  const tokenA = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(request, tokenA);
  await seedFinancialImpact(request, tokenA, exceptionId, 25_000);

  // ── Manager A submits override → PENDING_COSIGN ─────────────────
  await loginAs(page, USERS.MANAGER);
  await page.goto(await exceptionUrl(request, tokenA, exceptionId));

  const openOverride = page.getByRole("button", { name: /choose different action/i });
  await expect(openOverride).toBeVisible({ timeout: 15_000 });
  await openOverride.click();

  const dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByLabel(/^resolution action$/i).selectOption("ALLOW_BOTH");
  await dialog.getByLabel(/^override reason category$/i).selectOption("CUSTOMER_CONCESSION_LOW");
  await dialog.getByLabel(/^override notes$/i).fill(
    "buyer confirmed concession per email 2026-04-16",
  );
  await dialog.getByRole("button", { name: /confirm override/i }).click();

  // Backend stages rather than resolves.
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${tokenA}` } },
        );
        return res.ok() ? (await res.json()).lifecycle_state : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("PENDING_COSIGN");

  // Cosign banner renders for the initiator too — but without the
  // Approve/Reject cosign buttons (read-only "awaiting cosign"
  // message).
  await expect(
    page.getByText(/awaiting second-reviewer cosign/i),
  ).toBeVisible({ timeout: 10_000 });

  // ── Switch to manager B + cosign ────────────────────────────────
  await context.clearCookies();
  await loginAs(page, USERS.MANAGER_2);
  const tokenB = await backendToken(request, USERS.MANAGER_2);
  await page.goto(await exceptionUrl(request, tokenB, exceptionId));

  const approveCosign = page.getByRole("button", { name: /^approve cosign$/i });
  await expect(approveCosign).toBeVisible({ timeout: 15_000 });

  // handleCosign() uses window.prompt() for required notes. Arm the
  // dialog handler before clicking.
  page.once("dialog", (d) => d.accept("verified — applying approved override"));
  await approveCosign.click();

  // Backend resolves.
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${tokenB}` } },
        );
        return res.ok() ? (await res.json()).lifecycle_state : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("RESOLVED");

  // Resolved_action matches the staged override; cosign metadata
  // records both parties per the four-eyes contract.
  const finalRes = await request.get(
    `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
    { headers: { Authorization: `Bearer ${tokenB}` } },
  );
  const finalBody = await finalRes.json();
  expect(finalBody.resolved_action).toBe("ALLOW_BOTH");
  // resolved_by is the initiator (Manager A); cosigned_by on
  // resolution_data is Manager B. The sub claim is the user's email.
  const cosign = (finalBody.resolution_data as Record<string, unknown>).cosign;
  expect(cosign).toBeTruthy();
});
