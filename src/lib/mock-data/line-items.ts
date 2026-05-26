// Mock LineItem fixtures, keyed by ExceptionSummary.id.
//
// Extracted from `src/lib/api.ts` in ADR-041 P5. Consumed by the
// mock branch of `exceptionsApi.lineItems()`; the `USE_REAL_API`
// branch hits `/api/v1/exceptions/{id}/line-items` directly.
//
// Each entry models the line-level breakdown the EvidenceGrid
// renders (SKU, description, UOM, qty, erp_price, po_price,
// optional root_cause). Add an entry alongside any new mock
// exception that should surface evidence rows in mock mode.

import type { LineItem } from "@/types/exceptions";

export const MOCK_LINE_ITEMS: Record<string, LineItem[]> = {
  "exc-001": [
    { line_id: "L1", sku: "SKU-0042", description: "12-pk Cola", uom: "CS", quantity: 240, erp_price: 14.88, po_price: 13.20, root_cause: "PROMO_EXPIRED" },
    { line_id: "L2", sku: "SKU-0043", description: "12-pk Diet Cola", uom: "CS", quantity: 120, erp_price: 14.88, po_price: 13.20, root_cause: "PROMO_EXPIRED" },
    { line_id: "L3", sku: "SKU-0051", description: "12-pk Zero Sugar", uom: "CS", quantity: 96, erp_price: 14.88, po_price: 14.90, root_cause: "EDI_MISMATCH" },
  ],
  "exc-002": [
    { line_id: "L1", sku: "SKU-1180", description: "24-pk Water", uom: "CS", quantity: 500, erp_price: 9.60, po_price: 9.62, root_cause: "EDI_MISMATCH" },
    { line_id: "L2", sku: "SKU-1181", description: "12-pk Sparkling", uom: "CS", quantity: 200, erp_price: 11.40, po_price: 10.00, root_cause: "CONTRACT_GAP" },
  ],
  "exc-003": [
    { line_id: "L1", sku: "SKU-3310", description: "Snack Bar 48ct", uom: "CS", quantity: 300, erp_price: 28.44, po_price: 25.00, root_cause: "CONTRACT_GAP" },
    { line_id: "L2", sku: "SKU-3312", description: "Protein Bar 36ct", uom: "CS", quantity: 150, erp_price: 24.00, po_price: 21.50, root_cause: "PROMO_EXPIRED" },
    { line_id: "L3", sku: "SKU-3315", description: "Granola Bar 60ct", uom: "CS", quantity: 80, erp_price: 32.00, po_price: 32.00, root_cause: "EDI_MISMATCH" },
    { line_id: "L4", sku: "SKU-3320", description: "Kids Bar 24ct", uom: "CS", quantity: 200, erp_price: 18.00, po_price: 15.00, root_cause: "MASTER_DATA" },
  ],
  "exc-004": [
    { line_id: "L1", sku: "SKU-5521", description: "Family Pack x6", uom: "CS", quantity: 180, erp_price: 42.00, po_price: 36.00, root_cause: "UOM_ERROR" },
    { line_id: "L2", sku: "SKU-5525", description: "Mega Pack x12", uom: "CS", quantity: 90, erp_price: 82.00, po_price: 72.00, root_cause: "UOM_ERROR" },
  ],
  "exc-005": [
    { line_id: "L1", sku: "SKU-0099", description: "Juice 1L x12", uom: "CS", quantity: 360, erp_price: 19.20, po_price: 17.28, root_cause: "ERP_NOT_LOADED" },
  ],
  "exc-006": [
    { line_id: "L1", sku: "SKU-7701", description: "Energy Drink 4pk", uom: "CS", quantity: 480, erp_price: 8.96, po_price: 8.50, root_cause: "MASTER_DATA" },
    { line_id: "L2", sku: "SKU-7705", description: "Energy Drink 8pk", uom: "CS", quantity: 240, erp_price: 17.50, po_price: 16.00, root_cause: "MASTER_DATA" },
  ],
  "exc-007": [
    { line_id: "L1", sku: "SKU-2210", description: "Sports Drink 12pk", uom: "CS", quantity: 400, erp_price: 12.60, po_price: 11.00, root_cause: "CONTRACT_GAP" },
  ],
  "exc-008": [
    { line_id: "L1", sku: "SKU-8801", description: "Organic Tea 6pk", uom: "CS", quantity: 150, erp_price: 22.50, po_price: 20.00, root_cause: "PROMO_EXPIRED" },
    { line_id: "L2", sku: "SKU-8805", description: "Green Tea 12pk", uom: "CS", quantity: 200, erp_price: 18.00, po_price: 18.00 },
  ],
  "exc-009": [
    { line_id: "L1", sku: "SKU-4410", description: "Sports Water 24pk", uom: "CS", quantity: 60, erp_price: 8.40, po_price: 8.40 },
  ],
  "exc-010": [
    { line_id: "L1", sku: "SKU-6100", description: "Premium Lager 12pk", uom: "CS", quantity: 800, erp_price: 18.50, po_price: 18.50 },
    { line_id: "L2", sku: "SKU-6105", description: "Light Lager 12pk", uom: "CS", quantity: 400, erp_price: 16.20, po_price: 16.20 },
  ],
  "exc-011": [
    { line_id: "L1", sku: "SKU-6200", description: "Craft IPA 6pk", uom: "CS", quantity: 200, erp_price: 22.00, po_price: 22.00 },
  ],
  "exc-012": [
    { line_id: "L1", sku: "SKU-9010", description: "Sparkling Mineral 12pk", uom: "CS", quantity: 1200, erp_price: 11.50, po_price: 11.50 },
    { line_id: "L2", sku: "SKU-9015", description: "Still Mineral 12pk", uom: "CS", quantity: 800, erp_price: 9.80, po_price: 9.80 },
    { line_id: "L3", sku: "SKU-9020", description: "Flavored Water 24pk", uom: "CS", quantity: 600, erp_price: 14.20, po_price: 14.20 },
  ],
  "exc-013": [
    { line_id: "L1", sku: "SKU-7800", description: "Organic Kombucha 6pk", uom: "CS", quantity: 40, erp_price: 28.50, po_price: 28.50 },
    { line_id: "L2", sku: "SKU-7810", description: "Ginger Kombucha 6pk", uom: "CS", quantity: 25, erp_price: 26.00, po_price: 26.00 },
  ],
  "exc-014": [
    { line_id: "L1", sku: "SKU-3500", description: "Premium Coffee 12oz 24pk", uom: "CS", quantity: 170, erp_price: 36.00, po_price: 36.00 },
    { line_id: "L2", sku: "SKU-3510", description: "Decaf Coffee 12oz 24pk", uom: "CS", quantity: 85, erp_price: 34.50, po_price: 34.50 },
    { line_id: "L3", sku: "SKU-3520", description: "Cold Brew 10oz 12pk", uom: "CS", quantity: 50, erp_price: 42.00, po_price: 42.00 },
  ],
  "exc-016": [
    { line_id: "L1", sku: "SKU-9100", description: "Sparkling Water 16oz 12pk", uom: "CS", quantity: 5000, erp_price: 11.50, po_price: 11.50 },
    { line_id: "L2", sku: "SKU-9110", description: "Sparkling Water 20oz 12pk", uom: "CS", quantity: 3200, erp_price: 13.80, po_price: 13.80 },
    { line_id: "L3", sku: "SKU-9120", description: "Electrolyte Blend 12oz 24pk", uom: "CS", quantity: 2400, erp_price: 18.40, po_price: 18.40 },
    { line_id: "L4", sku: "SKU-9130", description: "Flavored Soda 12oz 24pk", uom: "CS", quantity: 1400, erp_price: 15.20, po_price: 15.20 },
  ],
  "exc-017": [
    { line_id: "L1", sku: "SKU-101", description: "12oz Craft Soda Variety 24pk", uom: "CS", quantity: 10, erp_price: 100.00, po_price: 101.00 },
  ],
  "exc-018": [
    { line_id: "L1", sku: "SKU-102", description: "16oz Energy Drink 12pk", uom: "CS", quantity: 50, erp_price: 100.00, po_price: 105.00 },
  ],
  "exc-019": [
    // Unknown-SKU line retains the buyer's intended qty + PO price so
    // the grid shows the nominal blast radius. The SKU does not exist
    // in the material master — hence the "UNKNOWN" marker in the SKU
    // and description fields.
    { line_id: "L1", sku: "SKU-999-UNKNOWN", description: "SKU not in material master — buyer-cited variant of SKU-001", uom: "CS", quantity: 80, erp_price: 63.00, po_price: 63.00 },
  ],
  "exc-020": [
    { line_id: "L1", sku: "SKU-202", description: "32oz Sports Drink 6pk", uom: "CS", quantity: 144, erp_price: 50.00, po_price: 50.00 },
  ],
  "exc-021": [
    { line_id: "L1", sku: "SKU-PRICE-MM", description: "18oz Premium Juice 8pk (Q2 concession)", uom: "CS", quantity: 100, erp_price: 100.00, po_price: 95.00 },
  ],
  "exc-026": [
    { line_id: "L1", sku: "SKU-1101", description: "12oz Cola 24pk", uom: "CS", quantity: 80, erp_price: 22.50, po_price: 22.50 },
    { line_id: "L2", sku: "SKU-1102", description: "12oz Diet Cola 24pk", uom: "CS", quantity: 80, erp_price: 22.50, po_price: 22.50 },
    { line_id: "L3", sku: "SKU-1108", description: "16oz Sparkling Water 12pk", uom: "CS", quantity: 60, erp_price: 18.40, po_price: 18.40 },
    { line_id: "L4", sku: "SKU-1112", description: "20oz Sports Drink 12pk", uom: "CS", quantity: 100, erp_price: 26.00, po_price: 26.00 },
  ],

  // Multi-issue case fixtures — each row's evidence is per-record, so
  // siblings on the same case carry their own line tables. The shared
  // PO is reflected in the parent case header, not in the line grids.
  "exc-027": [
    { line_id: "L1", sku: "SKU-Q1R-2076", description: "Q1 Reset Display Pack", uom: "CS", quantity: 1_600, erp_price: 20.00, po_price: 21.10, root_cause: "PRICE_HOLD_ESCALATE" },
  ],
  "exc-028": [
    { line_id: "L1", sku: "SKU-Q1R-2076", description: "Q1 Reset Display Pack", uom: "CS", quantity: 1_600, erp_price: 21.10, po_price: 21.10, root_cause: "BACK_ORDER_GAP" },
  ],
  "exc-029": [
    { line_id: "L1", sku: "SKU-Q1R-2076", description: "Q1 Reset Display Pack (retransmit)", uom: "CS", quantity: 1_600, erp_price: 21.10, po_price: 21.10, root_cause: "EDI_RETRANSMIT" },
  ],
  "exc-030": [
    { line_id: "L1", sku: "SKU-COST-EOQ-A", description: "Costco Club-Pack Bundle 36ct", uom: "CS", quantity: 2_000, erp_price: 30.50, po_price: 30.50, root_cause: "OVER_MAX_LINE" },
    { line_id: "L2", sku: "SKU-COST-EOQ-B", description: "Costco Club-Pack Bundle 48ct", uom: "CS", quantity: 2_000, erp_price: 30.50, po_price: 30.50, root_cause: "OVER_MAX_LINE" },
  ],
  "exc-031": [
    { line_id: "L1", sku: "SKU-COST-EOQ-A", description: "Costco Club-Pack Bundle 36ct", uom: "CS", quantity: 2_000, erp_price: 30.50, po_price: 30.50, root_cause: "PALLET_BROKEN_LAYER" },
    { line_id: "L2", sku: "SKU-COST-EOQ-B", description: "Costco Club-Pack Bundle 48ct", uom: "CS", quantity: 2_000, erp_price: 30.50, po_price: 30.50, root_cause: "PALLET_BROKEN_LAYER" },
  ],
  "exc-032": [
    { line_id: "L1", sku: "SKU-KR-1100", description: "Kombucha Variety 6pk", uom: "CS", quantity: 50, erp_price: 28.00, po_price: 28.00, root_cause: "MOQ_BELOW_LINE" },
    { line_id: "L2", sku: "SKU-KR-1110", description: "Ginger Kombucha 6pk", uom: "CS", quantity: 20, erp_price: 28.00, po_price: 28.00, root_cause: "MOQ_BELOW_LINE" },
  ],
  "exc-033": [
    { line_id: "L1", sku: "SKU-KR-1100", description: "Kombucha Variety 6pk", uom: "CS", quantity: 50, erp_price: 28.00, po_price: 28.00, root_cause: "CARRIER_DELAY" },
    { line_id: "L2", sku: "SKU-KR-1110", description: "Ginger Kombucha 6pk", uom: "CS", quantity: 20, erp_price: 28.00, po_price: 28.00, root_cause: "CARRIER_DELAY" },
  ],

  // ── ADR-042 Customer Inbox — change-request / inquiry / complaint / happy
  // path lines so the "Evidence Detail" pane (EvidenceGrid.tsx) is populated
  // for every MANUAL_ORDER_INTAKE case, not just the canonical EML-PO-2026-0042.
  // Each row mirrors the order context already in INBOX_SECTION_BUNDLES so the
  // line table and the order-entry / KG tabs reconcile.
  "exc-040": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case (reduce 600 → 420)", uom: "CS", quantity: 600, erp_price: 8.64, po_price: 8.64, root_cause: "CHANGE_QTY_REDUCTION" },
    { line_id: "L2", sku: "BEV-LEMON-6PK", description: "Lemon 6-pack case", uom: "CS", quantity: 240, erp_price: 7.20, po_price: 7.20 },
  ],
  "exc-041": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case (expedite 05/24 → 05/20)", uom: "CS", quantity: 600, erp_price: 8.64, po_price: 8.64, root_cause: "CHANGE_EXPEDITE" },
    { line_id: "L2", sku: "BEV-LEMON-6PK", description: "Lemon 6-pack case", uom: "CS", quantity: 240, erp_price: 7.20, po_price: 7.20 },
  ],
  "exc-042": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case (cancellation requested — picked)", uom: "CS", quantity: 4_800, erp_price: 8.64, po_price: 8.64, root_cause: "CHANGE_CANCELLATION" },
    { line_id: "L2", sku: "BEV-SPRT-20OZ", description: "Sports Drink 20oz 12pk (cancellation requested — picked)", uom: "CS", quantity: 750, erp_price: 9.20, po_price: 9.20, root_cause: "CHANGE_CANCELLATION" },
  ],
  "exc-043": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case", uom: "CS", quantity: 600, erp_price: 8.64, po_price: 8.64 },
    { line_id: "L2", sku: "BEV-LEMON-6PK", description: "Lemon 6-pack (request: swap to 12-pack)", uom: "CS", quantity: 240, erp_price: 7.20, po_price: 7.20, root_cause: "CHANGE_SKU_SUBSTITUTION" },
  ],
  "exc-044": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case (referenced order SO-5100012344, delivered)", uom: "CS", quantity: 480, erp_price: 8.64, po_price: 8.64, root_cause: "INQUIRY_REFERENCED_ORDER" },
  ],
  "exc-045": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case (short shipment: received 380 of 480)", uom: "CS", quantity: 480, erp_price: 8.64, po_price: 8.64, root_cause: "COMPLAINT_SHORT_SHIPMENT" },
  ],
  "exc-046": [
    { line_id: "L1", sku: "BEV-COLA-12PK", description: "Cola 12-pack case (EDI 850 — auto-confirmed)", uom: "CS", quantity: 480, erp_price: 8.64, po_price: 8.64 },
  ],
  // exc-047 (uncategorised email — not an order-desk matter): no line items
  // by design; the Evidence Detail pane is structurally empty here because
  // there is no order to evidence. The bundle's draft_reply makes that clear.
};
