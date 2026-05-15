/**
 * cases-workspace-three-pane — locks the ADR-041 P3d-remaining
 * three-pane workspace at /cases.
 *
 * Background — the bug this spec regression-locks:
 *
 * After two-pane shipped in P3a (queue + detail) the PO asked "I
 * can't find the 3-pane view; is this a bug or missing mock data?".
 * It was neither — the third pane was simply not built; the records
 * picker still lived inside `CaseDetailPanel`'s right pane.
 * Behavioural tests passed because the existing two-pane layout
 * worked correctly. The systemic gap was that no test asserted the
 * EXPECTED STRUCTURE of the workspace — feature absence was
 * invisible to the suite.
 *
 * Deliverable-completeness pattern (test-strategy doc Gap 7): a
 * source-level architectural lock at
 * `tests/architectural/cases_workspace_render_guard.test.ts` greps
 * `/cases/page.tsx` for the three pane wrappers + the three-column
 * grid template, so a structural regression fails in <2s during
 * vitest. This browser e2e adds the behavioural half: drive the
 * real DOM at a viewport above the `xl` breakpoint (1280px) and
 * assert (a) all three panes mount, (b) clicking a queue row
 * cascades into the records column, and (c) auto-mount fires the
 * inline ribbon in the third pane.
 *
 * Viewport is fixed at 1400×900 so the spec exercises the three-
 * column track unambiguously. Below `xl` the middle column
 * collapses by design (see the `lg:grid-cols-[…]` template) and
 * the test would mis-fire.
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


test("three-pane workspace mounts at xl: case-queue | records | detail", async ({
  page,
  request,
}) => {
  // Set viewport explicitly above the `xl` (1280px) breakpoint so
  // the third column track is active. Using `page.setViewportSize`
  // rather than `test.use({ viewport })` because the latter has
  // strict placement rules (must be inside `test.describe` and
  // before `test.describe.configure`) and the playwright.config
  // already declares the default viewport — this is a per-test
  // override that's safe to apply in the body.
  await page.setViewportSize({ width: 1400, height: 900 });

  const token = await backendToken(request, USERS.MANAGER);
  // Seed a YELLOW exception so the queue is non-empty and the
  // record's HITL ribbon will have action buttons to mount.
  await createYellowException(request, token);

  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");

  // Pre-selection: queue is visible; record-list + workspace
  // wrappers haven't mounted yet (selectedCaseId is null).
  await expect(page.locator("[aria-label='Case queue']")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("[aria-label='Case workspace']")).toBeVisible();

  // Click the first queue row — selection cascades.
  await page.locator("[role=option]").first().click();

  // (a) Three pane wrappers all mounted.
  //
  // The records picker (RecordListPane) renders TWICE in the
  // responsive DOM: as the dedicated middle column (visible at xl
  // via `hidden xl:block`) and as the CaseDetailPanel inline
  // fallback (P3e — `display:none` at xl via `xl:hidden`). Both
  // carry `aria-label='Attached records'`, so an unscoped locator
  // matches two elements and trips Playwright strict mode. Scope
  // to `:visible` so the assertion targets the xl middle column —
  // which is what "three-pane workspace mounts at xl" means.
  await expect(page.locator("[aria-label='Case queue']")).toBeVisible();
  await expect(
    page.locator("[aria-label='Attached records']:visible"),
    "middle records pane (lifted into RecordListPane) must mount " +
      "at xl ≥ 1280px",
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[aria-label='Case workspace']")).toBeVisible();

  // (b) The records pane has at least one row. Scoped to the
  // visible picker for the same responsive-duplication reason.
  await expect(
    page
      .locator("[aria-label='Attached records']:visible [role='radio']")
      .first(),
  ).toBeVisible();

  // (c) The right pane's inline ribbon mounted (auto-mount fired
  // since the seeded case has exactly one record).
  await expect(
    page.getByRole("button", { name: /re-analyze/i }).first(),
    "the right pane's HITL ribbon must mount via the single-record " +
      "auto-mount in CaseDetailPanel",
  ).toBeVisible({ timeout: 15_000 });

  // The URL gained ?case=…&record=… (URL is the source of truth
  // for selection; the panes reflect it).
  await expect(page).toHaveURL(/case=[^&]+.*record=/);
});
