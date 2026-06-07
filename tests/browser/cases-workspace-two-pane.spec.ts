/**
 * cases-workspace-two-pane — locks the two-pane workspace at /cases.
 *
 * The /cases workspace is a two-pane master-detail surface: a case
 * queue (left) and a case workspace (right). The attached-records
 * picker is stacked at the TOP of the detail pane (full width, no
 * truncated labels) rather than living in a narrow dedicated column —
 * a 3rd column squeezed the record rows and clipped their labels at
 * common laptop widths, so the picker was lifted back onto the detail
 * pane.
 *
 * Deliverable-completeness pattern (test-strategy doc Gap 7): a
 * source-level architectural lock at
 * `tests/architectural/cases_workspace_render_guard.test.ts` greps
 * `/cases/page.tsx` for the two pane wrappers + the two-column grid
 * template (and asserts there is NO 3-column grid), so a structural
 * regression fails in <2s during vitest. This browser e2e adds the
 * behavioural half: drive the real DOM and assert (a) both panes
 * mount, (b) clicking a queue row cascades into the records picker on
 * the detail pane, and (c) auto-mount fires the inline ribbon.
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


test("two-pane workspace mounts: case-queue | case-workspace (records on the detail pane)", async ({
  page,
  request,
}) => {
  // A comfortable desktop width — the two-pane layout is active at any
  // width ≥ lg (1024px).
  await page.setViewportSize({ width: 1400, height: 900 });

  const token = await backendToken(request, USERS.MANAGER);
  // Seed a YELLOW exception so the queue is non-empty and the
  // record's HITL ribbon will have action buttons to mount.
  await createYellowException(request, token);

  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");

  // Pre-selection: queue + workspace wrappers are present.
  await expect(page.locator("[aria-label='Case queue']")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("[aria-label='Case workspace']")).toBeVisible();

  // Click the first queue row — selection cascades.
  await page.locator("[role=option]").first().click();

  // (a) Both pane wrappers mounted.
  await expect(page.locator("[aria-label='Case queue']")).toBeVisible();
  await expect(page.locator("[aria-label='Case workspace']")).toBeVisible();

  // (b) The record mounts on the detail pane. Council 2026-06-07
  // (operator Q2): a single-record case mounts its one record DIRECTLY —
  // the "Attached records" picker is multi-record only now (there is
  // nothing to pick when there is one record; the multi-record picker is
  // covered by RecordListPane's unit test). The deliverable this lock
  // guards — record content lives on the detail pane, not a 3rd column —
  // is asserted via the selected-record detail mounting INSIDE the
  // workspace pane.
  await expect(
    page.locator(
      "section[aria-label='Case workspace'] [data-testid='case-selected-record-detail']",
    ),
    "the selected record must mount on the Case workspace detail pane",
  ).toBeVisible({ timeout: 15_000 });
  // And the single-record case shows no picker (the new IA).
  await expect(page.locator("[aria-label='Attached records']")).toHaveCount(0);

  // (c) The right pane's inline ribbon mounted (auto-mount fired since
  // the seeded case has exactly one record).
  await expect(
    page.getByRole("button", { name: /re-analyze/i }).first(),
    "the right pane's HITL ribbon must mount via the single-record " +
      "auto-mount in CaseDetailPanel",
  ).toBeVisible({ timeout: 15_000 });

  // The URL gained ?case=…&record=… (URL is the source of truth for
  // selection; the panes reflect it).
  await expect(page).toHaveURL(/case=[^&]+.*record=/);
});
