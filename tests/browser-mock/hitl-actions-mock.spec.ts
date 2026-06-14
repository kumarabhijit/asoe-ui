/**
 * MOCK-MODE operator-journey regressions for two defects that the
 * live-backend e2e suite structurally could not catch.
 *
 * Why this file exists (the coverage gap it closes):
 *
 *   1. The live suite (playwright.config.ts) runs with
 *      NEXT_PUBLIC_USE_REAL_API=1, so it never exercises src/lib/api.ts's
 *      mock branches — the data path the Vercel preview actually runs.
 *      `tests/browser/cases-workspace-action-propagation.spec.ts` even
 *      AVOIDS the Approve button with a comment ("Approve would short-
 *      circuit with 'No recipe recommendation'") — a known-broken path
 *      papered over rather than asserted. In mock mode the mock
 *      `exceptionsApi.get` returned no `recommended_action`, so Approve
 *      was a no-op for EVERY record. This file drives Approve to Resolved.
 *
 *   2. Mock mutations live in an in-memory array that re-seeds on every
 *      full page load. A live-backend test can't see the resulting bug
 *      (a real DB persists), so the "action reverts on reload" defect
 *      was invisible. This file reloads mid-journey and asserts the
 *      action stuck.
 *
 * No backend: mock mode is self-contained, so this spec needs only the
 * `next dev` server booted by playwright.mock.config.ts.
 */
import { test, expect, type Page } from "@playwright/test";

import { loginAs, USERS } from "../browser/_helpers";

// Deterministic seeds from the catalog-generated queue (CATALOG_EXCEPTIONS):
//   exc-018 — PRICE_HOLD_RELEASE, YELLOW, PENDING_REVIEW. Its order analysis
//             recommends ESCALATE (→ "Escalate to manager" button). Post
//             parity-flip the old exc-002 duplicate is GREEN-shadow (the
//             shadow passes; the recipe routes to review via autonomy), and
//             AgentReasoningCard treats GREEN as passive — no Approve. A
//             genuinely-YELLOW record is needed to exercise the Approve path.
//   exc-007 — CREDIT_BLOCK, YELLOW, PENDING_REVIEW. Analysis → ALLOW_BOTH.
const APPROVE_CASE = "case-for-exc-018";
const APPROVE_RECORD = "exc-018";
const OVERRIDE_CASE = "case-for-exc-007";
const OVERRIDE_RECORD = "exc-007";

const workspace = (page: Page) =>
  page.getByRole("region", { name: /case workspace/i });

/** Read a /home KPI tile value by its label. */
async function tileValue(page: Page, label: string): Promise<number> {
  const raw = await page.evaluate((wanted) => {
    // Locate the MetricTile by its label span, then read the monospace value
    // span that sits beside it. (The value used to carry a `.text-heading`
    // class; it now uses the dedicated mono-metric token via inline style, so
    // we match on the label↔value relationship rather than a styling class.)
    const labels = Array.from(document.querySelectorAll("span.text-label"));
    for (const lblEl of labels) {
      if (lblEl.textContent?.trim() === wanted) {
        const valueEl = lblEl.parentElement?.querySelector("span.font-mono");
        return valueEl?.textContent?.trim() ?? null;
      }
    }
    return null;
  }, label);
  expect(raw, `KPI tile "${label}" must render`).not.toBeNull();
  return Number(raw);
}

async function openCase(page: Page, caseId: string, recordId: string) {
  await page.goto(`/cases`);
  const row = page.locator(`#case-row-${caseId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await page.waitForURL(new RegExp(`record=${recordId}`), { timeout: 20_000 });
  // Wait for the HITL ribbon to mount (Override… is present on every
  // verdict for the admin role, so it's the stable mount sentinel).
  await expect(
    workspace(page).getByRole("button", { name: /choose different action/i }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("mock-mode HITL actions", () => {
  test("Approve drives a YELLOW record to Resolved (no 'no recommendation' dead-end)", async ({
    page,
  }) => {
    await loginAs(page, USERS.MANAGER);
    await openCase(page, APPROVE_CASE, APPROVE_RECORD);

    // On a single-record case the case header drops its duplicate
    // status (CaseDetailPanel S2); the record ribbon's "Current State"
    // is the state surface. The seeded record is PENDING_REVIEW,
    // humanized to "Pending Review".
    await expect(
      workspace(page).getByText(/pending review/i).first(),
      "record ribbon projects PENDING_REVIEW as 'Current State' pre-action",
    ).toBeVisible();

    // The primary action button carries the recipe's recommendation as
    // its label — for exc-018 that's ESCALATE → "Escalate to manager".
    // Before the fix this label was the bare fallback and the click
    // dead-ended on a "No recipe recommendation" warning toast.
    const approve = workspace(page)
      .getByRole("button", { name: /escalate to manager/i })
      .first();
    await expect(
      approve,
      "the recipe recommendation must surface as the primary action — " +
        "absence of this label is the Approve no-op bug",
    ).toBeVisible({ timeout: 15_000 });
    await approve.click();

    // S2 sprint 2026-05-28 finding #7 — Approve on YELLOW now
    // requires a reason_tag. The Select renders above the textarea
    // and Confirm Approval stays disabled until a tag is picked.
    // Source the option value dynamically (index 0 is the
    // "Select…" placeholder) so no enum literal leaks into the test
    // (Guardrail #2 — same pattern as the Override test below).
    const reasonSel = workspace(page).getByLabel(
      /approval reason category/i,
    );
    const reasonVal = await reasonSel
      .locator("option")
      .nth(1)
      .getAttribute("value");
    await reasonSel.selectOption(reasonVal);

    await workspace(page)
      .getByRole("button", { name: /confirm approval/i })
      .first()
      .click();

    // The dead-end warning must NOT appear.
    await expect(
      page.getByText(/no recipe recommendation/i),
      "Approve must not short-circuit on a missing recommendation",
    ).toHaveCount(0, { timeout: 10_000 });

    // Success toast + the case header re-projects to Resolved.
    await expect(
      page.getByText(new RegExp(`exception ${APPROVE_RECORD} approved`, "i")).first(),
    ).toBeVisible({ timeout: 10_000 });
    // S2 sprint 2026-05-28 finding #11 — next-case auto-advance.
    // After the action completes the workspace moves to the next
    // case in the SLA-sorted queue; the URL no longer references
    // the case we just acted on. The success toast above is the
    // post-condition for the action itself; this assertion is the
    // post-condition for the advance.
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .not.toContain(`case=${APPROVE_CASE}`);
  });

  test("an Override survives a full page reload on /home (reload resilience)", async ({
    page,
  }) => {
    await loginAs(page, USERS.MANAGER);

    // Baseline /home "Awaiting review" count. The tile renders "0"
    // until useCases finishes its fetch, so poll until the seeded
    // count settles (the fixture always has open work).
    await page.goto("/home");
    await expect(page.getByText("Awaiting review").first()).toBeVisible({
      timeout: 30_000,
    });
    let before = 0;
    await expect
      .poll(
        async () => {
          before = await tileValue(page, "Awaiting review");
          return before;
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    // Override exc-007 → Resolved.
    await openCase(page, OVERRIDE_CASE, OVERRIDE_RECORD);
    await workspace(page)
      .getByRole("button", { name: /choose different action/i })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    // S2 follow-up #6 — the native `<select>`s for action + reason
    // are now typeahead Comboboxes. Pick the first available option
    // from each by opening the combobox and clicking the first
    // `role="option"`. Sourcing values dynamically keeps the spec
    // free of hardcoded enum literals (Guardrail #2).
    await dialog.getByRole("combobox", { name: /resolution action/i }).click();
    await dialog.getByRole("option").first().click();
    await dialog
      .getByRole("combobox", { name: /override reason category/i })
      .click();
    await dialog.getByRole("option").first().click();
    await dialog.getByLabel(/notes/i).fill("mock e2e — drive to resolved");
    await dialog.getByRole("button", { name: /confirm override/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    // S2 #11 — auto-advance: URL flips off OVERRIDE_CASE after the
    // override completes. The reload-resilience check below (the
    // tile count drop on /home) is the surviving post-condition for
    // the override mutation itself.
    await expect
      .poll(() => page.url(), { timeout: 10_000 })
      .not.toContain(`case=${OVERRIDE_CASE}`);

    // Soft-nav to /home: count drops by one.
    await page.getByRole("link", { name: /^home$/i }).first().click();
    await page.waitForURL(/\/home/, { timeout: 15_000 });
    await expect(page.getByText("Awaiting review").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => tileValue(page, "Awaiting review"), { timeout: 15_000 })
      .toBe(before - 1);

    // The regression: a FULL RELOAD must NOT revert the count. Pre-fix
    // the in-memory mutation was lost and the tile snapped back to
    // `before`; the localStorage overlay now replays it.
    await page.reload();
    await expect(page.getByText("Awaiting review").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => tileValue(page, "Awaiting review"), { timeout: 15_000 })
      .toBe(before - 1);
  });
});
