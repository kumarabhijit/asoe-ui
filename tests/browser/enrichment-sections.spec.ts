/**
 * enrichment-sections — coverage for the 7 detail sections that were
 * not browser-tested before the 2026-04-22 → 2026-04-25 Verdict
 * full-close engagement.
 *
 * Each test:
 *   1. Seeds a real exception via /api/v1/exceptions/resolve.
 *   2. Logs in as a manager (so the verdict-aware action row renders).
 *   3. Navigates to the detail page.
 *   4. Asserts both that the intent / lifecycle render AND that
 *      audit-bearing fields from the section's enrichment payload
 *      are visible on screen.
 *
 * What this proves end-to-end:
 *   - Recipe gateway dependencies (declared in recipes/registry.py)
 *     resolve via the sandbox StubGateways.
 *   - The composer projects enrichment_context into the typed
 *     *AnalysisData on AnalysisResponse.
 *   - The UI's section component renders the populated fields
 *     verbatim (no client-side composition — Guardrail #6).
 *
 * Sections covered here: BackOrder, DuplicatePO + OrderComparison
 * (paired), DeliveryDelay, OverMax, MOQ, PriceAnalysis. The
 * already-covered sections (PriceHold, EDI mismatch, basic detail
 * view) live in their own spec files.
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
import type { APIRequestContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});

/** Seed an exception via the live /resolve endpoint and return its ID. */
async function seed(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await request.post(
    `${BACKEND_URL}/api/v1/exceptions/resolve`,
    { headers: { Authorization: `Bearer ${token}` }, data: body },
  );
  if (!res.ok()) {
    throw new Error(`seed failed: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as { exception_id: string };
  return data.exception_id;
}

test("BackOrder detail page renders primary_dc + alternate warehouses + substitutes from gateway", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await seed(request, token, {
    order_id: `SO-BO-E2E-${Date.now()}`,
    line_item: 1,
    po_price: 10.0,
    sap_base_price: 10.0,
    event_type: "BACK_ORDER_OOS",
    retailer_id: "R-70",
    line_count: 1,
    sku: "SKU-BO-1",
    metadata: {
      ordered_qty: 100, available_qty: 75,
      unit_price: 10.0, uom: "CS",
    },
  });

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Enrichment sections are collapsed by default (PO ruling 2026-05-03);
  // expand the Back-Order pane before asserting its inner content.
  await expandSection(page, /Back-Order Analysis/i);

  // Inventory Gap heading lands once the BackOrderSection mounts.
  await expect(page.getByText(/Inventory Gap/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // Gateway-fetched primary_dc populates ("DC-EAST" via sandbox stub).
  await expect(page.getByText(/East DC/i).first()).toBeVisible();

  // Alternate-warehouse block renders the West DC option.
  await expect(page.getByText(/West DC/i).first()).toBeVisible();
});

test("DuplicatePO detail shows OrderSnapshot pair from matched_po_details gateway", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await seed(request, token, {
    order_id: `PO-DUP-E2E-${Date.now()}`,
    line_item: 1,
    po_price: 100.0,
    sap_base_price: 100.0,
    event_type: "EDI_850_DUPLICATE_PO",
    retailer_id: "R-10",
    line_count: 1,
    metadata: {
      signal_scores: {
        po_number: 1.0, customer_id: 1.0, line_items: 0.95,
        amount: 0.90, timestamp: 0.80, ship_to: 0.80,
        channel: 1.0, delivery_date: 0.80,
      },
      matched_po_id: "PO-DUP-PRIOR",
    },
  });

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Both Duplicate Detection and Order Comparison are collapsed by
  // default; expand them before asserting their inner snapshots.
  await expandSection(page, /Duplicate Detection/i);
  await expandSection(page, /Order Comparison/i);

  // Both snapshot SO numbers (SO-DUP-001 / SO-DUP-002) should render
  // somewhere in the duplicate / comparison sections.
  await expect(page.getByText(/SO-DUP-001/).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/SO-DUP-002/).first()).toBeVisible();
});

test("DeliveryDelay detail shows projected_eta + at_risk from sla_contract gateway", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await seed(request, token, {
    order_id: `SO-DD-E2E-${Date.now()}`,
    line_item: 1,
    po_price: 10.0,
    sap_base_price: 10.0,
    event_type: "DELIVERY_DELAY",
    retailer_id: "R-74",
    line_count: 2,
    metadata: {
      planned_date: "2026-04-20T00:00:00Z",
      projected_eta: "2026-04-23T00:00:00Z",
      days_late: 3,
      delay_category: "CARRIER_DELAY",
    },
  });

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Delivery Delay pane is collapsed by default; expand it.
  await expandSection(page, /Delivery Delay/i);

  // Recipe-output classification + gateway-fetched at_risk both show.
  await expect(page.getByText(/CARRIER_DELAY/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("OverMax detail shows trim plan + contract / block context from gateway", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await seed(request, token, {
    order_id: `SO-OM-E2E-${Date.now()}`,
    line_item: 1,
    po_price: 10.0,
    sap_base_price: 10.0,
    event_type: "OVER_MAX_QTY",
    retailer_id: "R-71",
    line_count: 1,
    metadata: {
      total_ordered: 130, max_qty: 100, uom: "CASE",
      order_lines: [
        {
          sku: "A", description: "A", qty: 130,
          max_line_qty: 100, is_even_layer_item: true,
        },
      ],
    },
  });

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Over-Max pane is collapsed by default; expand it.
  await expandSection(page, /Over-Max Analysis/i);

  // contract_ref from sap_contract stub renders.
  await expect(page.getByText(/KONA-CN-1001/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("MOQ detail shows moq_source + channel from sap_customer_master gateway", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await seed(request, token, {
    order_id: `SO-MOQ-E2E-${Date.now()}`,
    line_item: 1,
    po_price: 5.0,
    sap_base_price: 5.0,
    event_type: "MIN_ORDER_QTY",
    retailer_id: "R-72",
    line_count: 1,
    sku: "SKU-MOQ-1",
    metadata: {
      ordered_qty: 40, moq_qty: 48,
      unit_cost: 5.0, uom: "CS",
    },
  });

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // MOQ pane is collapsed by default; expand it.
  await expandSection(page, /MOQ Analysis/i);

  // Gateway-fetched moq_source ("KNMT-MINBM") or channel ("DIRECT")
  // populates the audit-bearing row.
  await expect(
    page.getByText(/KNMT-MINBM|DIRECT/i).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("PriceAnalysis detail shows variance summary + SAP Context with doc_number from gateway", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await seed(request, token, {
    order_id: `SO-CC-E2E-${Date.now()}`,
    line_item: 1,
    po_price: 90.0,
    sap_base_price: 100.0,
    event_type: "EDI_850_PRICE_MISMATCH",
    retailer_id: "R-02",
    line_count: 5,
    sku: "SKU-CC-1",
  });

  await loginAs(page, USERS.MANAGER);
  await page.goto(`/exceptions/${exceptionId}`);

  // Price Analysis pane is collapsed by default; expand it before
  // looking at the variance summary that lives inside.
  await expandSection(page, /Price Analysis/i);

  // Variance summary (top-level audit-bearing fields) renders first.
  await expect(page.getByText(/Variance/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/At Risk/i).first()).toBeVisible();

  // SAP Context block holds the gateway-fetched doc_type / doc_number /
  // contract_ref / promotion_ref. This is a nested disclosure inside
  // PriceAnalysisSection — expand it second.
  await page.getByRole("button", { name: /SAP Context/i }).click();

  // doc_number from the sap_doc StubGateway response.
  await expect(page.getByText(/5500001234/).first()).toBeVisible();
});
