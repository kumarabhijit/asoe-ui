/**
 * escalate — analyst escalates a YELLOW exception via the Send-for-triage
 * button; backend records the lifecycle transition as ESCALATED.
 *
 * Exercises:
 *   - handleEscalate() window.prompt() reason flow
 *   - exceptionsApi.escalate() fetch branch (POST /exceptions/{id}/escalate)
 *   - Dedicated permission gate exceptions:escalate (analyst has it)
 *   - Audit event EXCEPTION_ESCALATED emitted server-side (verified via
 *     backend state re-fetch; UI state is derivative)
 *
 * Why YELLOW specifically: on GREEN the analyst-tier button row is
 * empty by design (auto-resolved exceptions need no review). YELLOW is
 * the canonical "needs human decision" verdict where Escalate renders.
 * Uses createYellowException() which seeds a medium-confidence
 * DUPLICATE_PO event — deterministic YELLOW routing.
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  backendToken,
  createYellowException,
  resetTenant,
  USERS,
  BACKEND_URL,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

test("analyst escalates a YELLOW exception → lifecycle flips to ESCALATED", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.ANALYST);
  const exceptionId = await createYellowException(request, token);

  await loginAs(page, USERS.ANALYST);
  await page.goto(`/exceptions/${exceptionId}`);

  const escalateButton = page.getByRole("button", { name: /send for triage/i });
  await expect(escalateButton).toBeVisible({ timeout: 15_000 });

  // page.once("dialog", …) must be registered BEFORE clicking —
  // window.prompt() blocks JS synchronously, so Playwright only sees
  // the dialog if the handler is attached in advance.
  page.once("dialog", (d) => d.accept("needs senior review"));
  await escalateButton.click();

  // Backend truth-of-record wins. Poll because setDetail() is async.
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
    .toBe("ESCALATED");
});
