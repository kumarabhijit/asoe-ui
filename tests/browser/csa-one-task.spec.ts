/**
 * csa-one-task — S15a end-to-end lock.
 *
 * Proves that the post-S15a `/cases/[id]` surface lets the CSA
 * reach the HITL action ribbon in a single click on the happy path
 * (single-record case → ribbon auto-mounts) and via one explicit
 * pick on the multi-record path.
 *
 * Companion to:
 *   - tests/contract/test_csa_one_task_flow.test.tsx (file-scan lock)
 *   - docs/test-strategy/csa-one-task-tracking.md   (deferral closed)
 */
import { test, expect } from "@playwright/test";

import {
  USERS,
  backendToken,
  createPendingReviewException,
  exceptionUrl,
  loginAs,
  resetTenant,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

test("single-record case: visiting /cases/<id> auto-mounts the action ribbon", async ({
  page,
  request,
}) => {
  // Seed: a single PENDING_REVIEW exception. The case-centric pivot
  // attaches every record to a parent case; a fresh exception with
  // no siblings produces a single-record case.
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(request, token);
  const recordUrl = await exceptionUrl(request, token, exceptionId);
  // exceptionUrl returns /cases/<parent>?record=<id>. We want to
  // exercise the auto-mount path — landing on /cases/<parent> with
  // no `?record=` query and asserting the ribbon mounts anyway.
  const caseUrl = recordUrl.split("?")[0];

  await loginAs(page, USERS.MANAGER);
  await page.goto(caseUrl);

  // The Override button is the canonical Layer-1 action affordance
  // for a manager on a PENDING_REVIEW record. It only renders if
  // ExceptionDetailPanel mounted — which only happens if the
  // single-record auto-select fired.
  await expect(
    page.getByRole("button", { name: /choose different action/i }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Council 2026-06-07 (operator Q2): a single-record case no longer
  // renders the "Attached records" picker — there is nothing to pick, so
  // the one record auto-mounts directly. Lock the new IA: the picker is
  // absent and the record detail is mounted on the surface. (The
  // multi-record picker is covered by RecordListPane's unit test.)
  await expect(page.getByText(/attached records/i)).toHaveCount(0);
  await expect(
    page.getByTestId("case-selected-record-detail"),
  ).toBeVisible();
});

test("deep-link via ?record=<id> lands directly on that record's ribbon", async ({
  page,
  request,
}) => {
  // Seed: one record, then deep-link with the explicit ?record=
  // query. This is the shape that email / notification links into
  // a case use.
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(request, token);
  const url = await exceptionUrl(request, token, exceptionId);

  await loginAs(page, USERS.MANAGER);
  await page.goto(url);

  // Ribbon visible (Override button is the manager-tier Layer-1
  // affordance under default thresholds).
  await expect(
    page.getByRole("button", { name: /choose different action/i }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Council 2026-06-07 (operator Q2): a single-record case has no picker
  // to "check" — the record auto-mounts. The deep-link landed on the
  // record iff its detail surface mounted AND the URL preserved the
  // explicit ?record=<id> query (selection source of truth).
  await expect(
    page.getByTestId("case-selected-record-detail"),
  ).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`record=${encodeURIComponent(exceptionId)}`),
  );
});
