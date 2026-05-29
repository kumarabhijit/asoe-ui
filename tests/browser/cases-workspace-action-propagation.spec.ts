/**
 * cases-workspace-action-propagation — multi-step operator-journey
 * regression for the cross-pane reactivity invariant.
 *
 * Background — the state-drift this spec regression-locks:
 *
 * Pre-fix, `CaseDetailPanel` mounted the inline `ExceptionDetailPanel`
 * with no `onActionComplete` prop. A disposition / override on the
 * selected record mutated `lifecycle_state` server-side and updated
 * the inner detail pane, but the seam that tells the page "an action
 * landed" was dropped. Result: the queue pane on the left and the
 * case-header status badge on the right kept projecting the PRE-
 * action status until an unrelated WebSocket `case_*` event arrived.
 * With the socket down or slow, the operator saw an exception flip
 * to RESOLVED in the detail pane while the queue still said
 * "Awaiting review" — backend state and UI presentation drifted.
 *
 * The fix wires `onRecordActionComplete` through the panel so the
 * page can re-fetch the case detail (header badge + record list)
 * AND `refetch()` the queue. This spec is the behavioural partner
 * to `tests/architectural/cases_workspace_action_propagation.test.ts`
 * — the source-level lock catches a maintainer deleting the prop;
 * this spec catches the wiring being live but silently broken (e.g.
 * the handler refetching the queue but not the case, or vice versa).
 *
 * The journey:
 *   1. Seed a PENDING_REVIEW record → case lands at OPEN_AWAITING_HUMAN.
 *   2. Open /cases, click the queue row.
 *   3. Assert the queue row + case header both project "Awaiting review".
 *   4. Open Override, submit a disposition.
 *   5. Assert the queue row + case header re-project to "Resolved" —
 *      WITHOUT a page reload and without any explicit WebSocket
 *      message in this spec's path. (Real-mode dev DOES emit WS;
 *      the spec must not rely on WS arrival timing — what's under
 *      test is the action → page → refetch wiring.)
 */
import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  BACKEND_URL,
  USERS,
  backendToken,
  createPendingReviewException,
  loginAs,
  resetTenant,
  selectComboboxOption,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

/**
 * Locate the queue row for a given case id. Each row is a `<button
 * role="option">` whose DOM id is `case-row-${case_id}` (set on
 * `src/app/cases/page.tsx`). The visible text on the row is the
 * customer PO / sales-order id, NOT the case UUID, so the stable
 * locator is the DOM id rather than a `hasText` filter.
 */
function queueRow(page: Page, caseId: string): Locator {
  return page.locator(`#case-row-${caseId}`);
}

/** Pull the case id off the URL once selection lands. */
function urlCaseId(page: Page): string | null {
  return new URL(page.url()).searchParams.get("case");
}


test("disposition on the selected record re-projects status in BOTH the queue row and the case header", async ({
  page,
  request,
}) => {
  // ── Seed: one PENDING_REVIEW record → one OPEN_AWAITING_HUMAN case ──
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(
    request, token, `PO-PROP-${Date.now()}`,
  );
  // Look up the parent case so we have a stable id to scope queue
  // assertions to. The helper guarantees parent_case_id is set.
  const lookup = await request.get(
    `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(lookup.ok()).toBe(true);
  const caseId = (await lookup.json()).parent_case_id as string;
  expect(caseId).toBeTruthy();

  // ── Drive the queue → workspace journey ──────────────────────────
  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");

  const row = queueRow(page, caseId);
  await expect(row, "seeded case must appear in the queue").toBeVisible({
    timeout: 15_000,
  });

  // Pre-action: the queue row label projects the OPEN_AWAITING_HUMAN
  // status ("Awaiting review" per STATUS_LABEL).
  await expect(
    row.getByText(/awaiting review/i),
    "queue row must show OPEN_AWAITING_HUMAN as 'Awaiting review' pre-action",
  ).toBeVisible({ timeout: 10_000 });

  // Click the row, wait for the URL to carry both case + record so
  // we know auto-mount fired.
  await row.click();
  await page.waitForURL(/case=[^&]+.*record=/, { timeout: 15_000 });
  expect(urlCaseId(page)).toBe(caseId);

  // The case workspace mounted — assert via the case-context status
  // label, which is the right-pane partner of the queue row's status.
  // (The HITL ribbon varies by verdict — Re-analyze isn't always
  // rendered on GREEN records; the case-context label is.)
  const caseWorkspace = page.getByRole("region", { name: /case workspace/i });
  await expect(
    caseWorkspace.getByText(/awaiting review/i).first(),
    "case header must show OPEN_AWAITING_HUMAN as 'Awaiting review' pre-action",
  ).toBeVisible({ timeout: 15_000 });

  // ── Disposition: Override → RESOLVED ────────────────────────────
  // We use Override (rather than Approve) because the seeded record
  // doesn't carry a recipe-recommended action — Approve would short-
  // circuit with "No recipe recommendation on this exception". The
  // STATUS_MODEL spec treats both APPROVE and OVERRIDE sub-types as
  // chosen-action paths to RESOLVED (STATUS_MODEL §4); either suffices
  // to assert the propagation invariant.
  await page.getByRole("button", { name: /choose different action/i }).click();
  const dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await selectComboboxOption(dialog, /^resolution action$/i, "ALLOW_BOTH");
  await selectComboboxOption(dialog, /^override reason category$/i, "BAND_REVIEW_OVERRIDDEN");
  await dialog.getByLabel(/^override notes$/i)
    .fill("propagation e2e — drive to RESOLVED");
  await dialog.getByRole("button", { name: /confirm override/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  // Backend confirms the lifecycle actually moved — without this we'd
  // be testing only the UI's optimistic write, not the propagation.
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

  // ── The drift assertion ─────────────────────────────────────────
  // The queue row's status label must re-project to "Resolved" (the
  // STATUS_LABEL for the rolled-up CaseStatus = RESOLVED). Pre-fix
  // this stayed "Awaiting review" until a WS event arrived.
  await expect(
    row.getByText(/^resolved$/i),
    "queue row must re-project to 'Resolved' after the disposition " +
      "(cross-pane reactivity — onRecordActionComplete must trigger " +
      "refetch())",
  ).toBeVisible({ timeout: 10_000 });
  // And the OPEN_AWAITING_HUMAN label is gone from the row — guards
  // against a stale duplicate label hanging alongside the new one.
  await expect(
    row.getByText(/awaiting review/i),
    "queue row's pre-action 'Awaiting review' label must be replaced",
  ).toHaveCount(0, { timeout: 10_000 });

  // The case header (right pane) ALSO re-projects to "Resolved". This
  // is what closes the second half of the drift — the inner detail
  // pane refreshed itself pre-fix, but the case status badge above it
  // (sourced from `OrderCase.status`, not the record) stayed stale.
  await expect(
    caseWorkspace.getByText(/^resolved$/i).first(),
    "case header must re-project to 'Resolved' after the disposition " +
      "(onRecordActionComplete must trigger refreshCaseDetail())",
  ).toBeVisible({ timeout: 10_000 });
});
