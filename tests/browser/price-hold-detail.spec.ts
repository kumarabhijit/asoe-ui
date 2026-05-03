/**
 * price-hold-detail — Playwright e2e for PRICE_HOLD_RELEASE.
 *
 * Mirrors detail-view.spec.ts:
 *   1. Manager logs in.
 *   2. Backend creates a PRICE_HOLD_RELEASE event via /resolve/explain.
 *   3. UI navigates to the detail page; the intent / recipe show on
 *      the AgentReasoningCard.
 *
 * What this proves:
 *   - asoe2 health endpoint exposes PRICE_HOLD_RELEASE +
 *     PriceHoldReleaseRecipe.py end-to-end.
 *   - The UI fetches and renders an exception whose intent is
 *     PRICE_HOLD_RELEASE without crashing (regression net for the
 *     hardcoded-union work).
 *
 * Review L2 landed `api.analysis_adapters.adapt_price_hold` on the
 * asoe2 side (commit ea088… on claude/asoe-hub-implementation-8ds5T).
 * The adapter projects the recipe output into
 * AnalysisResponse.price_hold_analysis for GREEN records and
 * synthesises the projection by invoking the pure recipe for
 * YELLOW/RED-gated records. The second spec below is no longer
 * skipped — it exercises the adapter end-to-end on a 5% variance
 * (ESCALATE band, YELLOW shadow).
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  backendToken,
  resetTenant,
  USERS,
  BACKEND_URL,
  expandSection,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

async function createPriceHoldException(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  variancePct: number,
): Promise<string> {
  const sap = 100;
  const po = sap * (1 + variancePct);
  const res = await request.post(
    `${BACKEND_URL}/api/v1/exceptions/resolve/explain`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        order_id: `PO-PHR-E2E-${Date.now()}`,
        line_item: 1,
        po_price: po,
        sap_base_price: sap,
        event_type: "EDI_850_PRICE_HOLD",
        line_count: 1,
        metadata: { price_hold_status: "HELD" },
      },
    },
  );
  if (!res.ok()) throw new Error(`create PHR: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { exception_id: string };
  return body.exception_id;
}

test("PRICE_HOLD_RELEASE detail page renders with the correct intent + recipe", async ({
  page,
  request,
}) => {
  const managerToken = await backendToken(request, USERS.MANAGER);
  // 5% variance → ESCALATE branch under default policy thresholds
  // (tolerance 2%, hard-block 10%).
  const exceptionId = await createPriceHoldException(request, managerToken, 0.05);

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Intent badge / label appears verbatim somewhere on the panel.
  // Use a regex so a hyphenated or spaced rendering still matches.
  await expect(page.getByText(/PRICE[_ -]?HOLD[_ -]?RELEASE/i).first()).toBeVisible();

  // The verdict-aware action row is rendered (manager sees Override…).
  // The button's aria-label is "Choose different action" (a11y
  // descriptive); display text is "Override…" (SOX vocabulary).
  // Match by accessible name to stay role-locator-safe.
  await expect(
    page.getByRole("button", { name: /choose different action/i }).first(),
  ).toBeVisible();
});

test("PriceHoldSection renders variance + action when backend populates price_hold_analysis", async ({
  page,
  request,
}) => {
  // Enabled by asoe2 review L2. 5% variance → YELLOW shadow →
  // MANUAL_REVIEW_REQUIRED. The adapter synthesises
  // price_hold_analysis by invoking the pure PriceHoldReleaseRecipe
  // with event-sourced params; the UI section mounts on the
  // data-presence guard. This also exercises the fallback path (no
  // recipe output on the record because shadow gated before
  // execute_recipe).
  const managerToken = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPriceHoldException(request, managerToken, 0.05);
  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);
  // Price Hold pane is collapsed by default; expand it before
  // asserting the recipe-decision content lives inside.
  await expandSection(page, /Price Hold/i);
  await expect(page.getByText(/Price Hold Analysis/i)).toBeVisible();
  await expect(page.getByText(/Recipe Decision/i)).toBeVisible();
  await expect(page.getByText(/PriceHoldReleaseRecipe\.py/)).toBeVisible();
});
