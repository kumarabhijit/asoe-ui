/**
 * cases-workspace-case-switch — the operator clicks one case in the
 * /cases queue, then clicks another. Both cases must show their own
 * action ribbon. The URL's `record=` param must always point at a
 * record that belongs to the URL's `case=` param.
 *
 * Background — the bug this regression-locks:
 *
 * Before this spec, clicking case A then case B in fast succession
 * could leave the URL at `/cases?case=B&record=<record-belonging-to-A>`.
 * The right pane rendered the attached-records picker but never the
 * Approve / Reject / Override / Escalate / Re-analyze ribbon, because
 * `selectedRecordId` referenced a record that didn't exist on the new
 * case. From the operator's perspective: "many cases don't show
 * detailed view". From the test suite's perspective: every existing
 * browser spec navigated DIRECTLY to `/cases/<id>?record=<id>` via the
 * `exceptionUrl()` helper, so the click-through-from-queue flow was
 * untested — and the race only fires on the SECOND click in a row.
 *
 * Two assertions per click:
 *   1. The action ribbon (`role="button", name=/^approve$/i` or
 *      similar) is visible — i.e. the inline `ExceptionDetailPanel`
 *      mounted successfully.
 *   2. `?record=` in the URL refers to a record actually attached to
 *      `?case=` — re-fetched via the backend so we don't trust UI
 *      state alone.
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


/** Read the URL search params off the live page. */
function urlParams(page: import("@playwright/test").Page): {
  caseId: string | null;
  recordId: string | null;
} {
  const u = new URL(page.url());
  return {
    caseId: u.searchParams.get("case"),
    recordId: u.searchParams.get("record"),
  };
}

/** Backend round-trip: assert that `recordId` is a child of `caseId`. */
async function assertRecordBelongsToCase(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  caseId: string,
  recordId: string,
): Promise<void> {
  const res = await request.get(
    `${BACKEND_URL}/api/v1/cases/${encodeURIComponent(caseId)}/records`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(res.ok(), `getRecords(${caseId}) failed`).toBe(true);
  const body = (await res.json()) as { items: { id: string }[] };
  const ids = body.items.map((r) => r.id);
  expect(
    ids,
    `record ${recordId} not in case ${caseId} children — URL → state mismatch`,
  ).toContain(recordId);
}


test("clicking two queue rows in sequence shows each case's own ribbon", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  // Seed two distinct YELLOW exceptions in distinct cases so the queue
  // has at least two rows. createYellowException() opens a fresh case
  // per call (different order_id → distinct case_id).
  const excA = await createYellowException(request, token);
  const excB = await createYellowException(request, token);
  expect(excA).not.toEqual(excB);

  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");

  // Wait for the queue to populate. Two rows minimum.
  const rows = page.locator("[role=option]");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThanOrEqual(2);

  // ── First click ──────────────────────────────────────────
  await rows.nth(0).click();
  // URL must end up with both case= and record= once auto-mount fires.
  await page.waitForURL(/case=[^&]+.*record=/, { timeout: 15_000 });
  const { caseId: caseId1, recordId: recordId1 } = urlParams(page);
  expect(caseId1, "first click must set ?case=").toBeTruthy();
  expect(recordId1, "first click must auto-mount ?record=").toBeTruthy();
  // Ribbon is the canonical sign the inline ExceptionDetailPanel
  // mounted; the Re-analyze button is HITL-vocabulary-stable across
  // verdicts (Approve/Reject vary by role+verdict).
  await expect(
    page.getByRole("button", { name: /re-analyze/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await assertRecordBelongsToCase(request, token, caseId1!, recordId1!);

  // ── Second click — the race condition lived here ─────────
  // Pick a different queue row. nth(1) is fine because the seed
  // created two distinct cases.
  await rows.nth(1).click();
  // URL must update to a NEW case + record pair.
  await page.waitForURL(/case=[^&]+.*record=/, { timeout: 15_000 });
  // Eventual consistency: the record param could briefly be the
  // stale one before the parent's fetch+state-clear+auto-mount
  // resolves. Poll until the record/case pairing is consistent.
  await expect
    .poll(
      async () => {
        const { caseId, recordId } = urlParams(page);
        if (!caseId || !recordId) return null;
        if (caseId === caseId1) return null; // still on the first case
        const r = await request.get(
          `${BACKEND_URL}/api/v1/cases/${encodeURIComponent(caseId)}/records`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!r.ok()) return null;
        const body = (await r.json()) as { items: { id: string }[] };
        return body.items.some((rec) => rec.id === recordId);
      },
      {
        timeout: 15_000,
        intervals: [200, 400, 800, 1600],
        message:
          "URL ?record= must belong to URL ?case= after switching " +
          "queue rows — the parent's render-guard or state-clear " +
          "regressed",
      },
    )
    .toBe(true);

  const { caseId: caseId2, recordId: recordId2 } = urlParams(page);
  expect(caseId2).not.toEqual(caseId1);
  expect(recordId2).not.toEqual(recordId1);

  // Ribbon visible on the new case too.
  await expect(
    page.getByRole("button", { name: /re-analyze/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
});
