/**
 * edi-mismatch-detail — Playwright e2e for EDI_MISMATCH including the
 * PRICE_MISMATCH backend classifier-fork invariant.
 *
 * Mirrors detail-view.spec.ts:
 *   1. Manager logs in.
 *   2. Backend creates an EDI_850_LINE_MISMATCH event via
 *      /resolve/explain — once with a SKU sub_type (lands as
 *      EDI_MISMATCH), once with PRICE_MISMATCH (lands as
 *      CONTRACTUAL_CORRECTION because the asoe2 classifier forks
 *      that sub_type to preserve PriceAdjustmentRecipe as the single
 *      source of truth for pricing).
 *   3. UI navigates to each detail page; the intent badge / label
 *      reflects the backend's classifier decision.
 *
 * What this proves end-to-end:
 *   - asoe2 health endpoint exposes EDI_MISMATCH +
 *     EdiMismatchRecipe.py.
 *   - The classifier routing fork lands a PRICE_MISMATCH event under
 *     CONTRACTUAL_CORRECTION (preserves single-source-of-truth).
 *   - The UI renders the correct intent badge in both cases — never
 *     double-renders an EDI mismatch panel for the routed-out case.
 *
 * Review L2 landed `api.analysis_adapters.adapt_edi_mismatch` on the
 * asoe2 side. The adapter projects recipe output into
 * AnalysisResponse.edi_mismatch_analysis for GREEN records and
 * synthesises the projection by invoking the pure recipe for
 * YELLOW/RED-gated records (SKU / SHIP_TO mismatches). The
 * EdiMismatchSection-renders spec below is no longer skipped.
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  backendToken,
  resetTenant,
  USERS,
  BACKEND_URL,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

async function createLineMismatchException(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  sub_type: string,
): Promise<string> {
  const res = await request.post(
    `${BACKEND_URL}/api/v1/exceptions/resolve/explain`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        order_id: `PO-EDM-E2E-${sub_type}-${Date.now()}`,
        line_item: 1,
        po_price: 100,
        sap_base_price: 100,
        event_type: "EDI_850_LINE_MISMATCH",
        line_count: 1,
        metadata: {
          mismatch_sub_type: sub_type,
          expected_value: "expected-x",
          received_value: "received-y",
        },
      },
    },
  );
  if (!res.ok()) throw new Error(`create EDM ${sub_type}: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { exception_id: string };
  return body.exception_id;
}

test("EDI_MISMATCH (SKU sub_type) detail page renders with the correct intent", async ({
  page,
  request,
}) => {
  const managerToken = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createLineMismatchException(request, managerToken, "SKU_MISMATCH");

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  await expect(page.getByText(/EDI[_ -]?MISMATCH/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /override/i }).first()).toBeVisible();
});

test("PRICE_MISMATCH event lands as CONTRACTUAL_CORRECTION (classifier fork)", async ({
  page,
  request,
}) => {
  // Backend invariant: an EDI_850_LINE_MISMATCH event whose
  // metadata.mismatch_sub_type is PRICE_MISMATCH is classified as
  // CONTRACTUAL_CORRECTION at backend classifier time. This protects
  // PriceAdjustmentRecipe as the single source of truth for pricing
  // (CLAUDE.md §1 in asoe2). The UI must reflect that without
  // double-rendering an EDI mismatch panel.
  const managerToken = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createLineMismatchException(request, managerToken, "PRICE_MISMATCH");

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Intent badge reflects the classifier decision, NOT the original
  // event_type.
  await expect(page.getByText(/CONTRACTUAL[_ -]?CORRECTION/i).first()).toBeVisible();

  // EdiMismatchSection has a distinctive header that must NOT appear
  // for this exception.
  await expect(page.getByText(/EDI Line Mismatch/i)).toHaveCount(0);
});

test("EdiMismatchSection renders sub_type + classification when backend populates edi_mismatch_analysis", async ({
  page,
  request,
}) => {
  // Enabled by asoe2 review L2. QTY_MISMATCH → REVIEW classification →
  // GREEN shadow → recipe runs → adapter projects resolution_data
  // directly (not the synthetic path). The UI mounts the
  // EdiMismatchSection via the data-presence guard.
  const managerToken = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createLineMismatchException(request, managerToken, "QTY_MISMATCH");
  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);
  await expect(page.getByText(/EDI Line Mismatch/i)).toBeVisible();
  await expect(page.getByText(/QTY_MISMATCH/)).toBeVisible();
  await expect(page.getByText(/Review required/i)).toBeVisible();
});
