// Mock OrderAnalysis fixtures, keyed by ExceptionSummary.id.
//
// Extracted from `src/lib/api.ts` in ADR-041 P5 — the file had
// grown to ~3900 lines and was the biggest single contributor.
// This module is consumed only by `src/lib/api.ts` in mock mode
// (`exceptionsApi.orderAnalysis()`); the real-API path doesn't
// touch it.
//
// Add an entry here whenever you add an `ExceptionSummary` to
// `MOCK_EXCEPTIONS` in `src/lib/api.ts`. The
// `tests/architectural/mock_verdict_coverage.test.ts` check
// asserts every mock exception has a matching analysis fixture so
// `/cases/[id]?record=<id>` doesn't render a skeleton forever in
// preview mode.

import type { OrderAnalysis } from "@/types/exceptions";
import { SCENARIO_ANALYSES } from "./__generated__/scenario_analyses";

export const MOCK_ORDER_ANALYSES: Record<string, OrderAnalysis> = {
  // Migrated intent families sourced from the asoe2 scenario analysis fixture
  // (fixtures/scenarios/analyses.yaml -> __generated__/scenario_analyses.ts).
  // Slice 1: PRICE_HOLD_RELEASE (exc-017 auto-release, exc-018 escalate). The
  // runtime `primary_section` stamp below re-derives the presentation hint for
  // these the same as for the hand-authored records.
  //
  // Deep-cloned so the generated module stays an immutable seed: the runtime
  // machinery here (primary_section stamp) and the in-place mutation on the
  // api.ts action paths must operate on owned copies, never on the exported
  // generated objects.
  ...structuredClone(SCENARIO_ANALYSES),
  /* ── CONTRACTUAL_CORRECTION: Pricing / Promo exception ───────────── */
  "exc-001": {
    diagnosis: "Two line items reference promo pricing from an expired Q4 trade promotion (ZPROM condition valid through 12/31). One line has a $0.02 EDI rounding variance within tolerance. Recommend auto-override for the rounding and promo reload for the expired conditions.",
    confidence: 92,
    // ADR-032 — the same score as a typed signal. Uncalibrated until the
    // calibration loop ships (mirrors the backend `from_raw` projection), so
    // the card frames it as a model score, not a validated probability.
    confidence_signal: { value: 0.92, calibrated: false, method: "llm_intent_classifier_raw" },
    risk: "MEDIUM",
    resolution: "AUTO_OVERRIDE",
    root_cause: "Promotional condition ZPROM/155 expired 12/31/2025. PO still references promo pricing.",
    recommendation: "Adjust price to contract base — reload Q1 promotional conditions or approve at expired promo rate.",
    entity_profile: {
      customer_name: "Metro Grocery Holdings",
      bp_number: "BP-102440",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 1218.24,
      delta_amount: 766.08,
      delta_percentage: 11.3,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-12T18:00:00Z",
      affected_lines: 3,
    },
    price_analysis: {
      erp_unit_price: 14.88,
      po_unit_price: 13.20,
      variance_amount: 1.68,
      variance_pct: 11.3,
      total_at_risk: 1218.24,
      total_quantity: 456,
      uom: "CS",
      doc_type: "Sales Order",
      doc_number: "SO-1001",
      sku: "SKU-0042",
      material_desc: "12-pk Cola",
      order_date: "2026-04-11T08:12:00Z",
      rule_id: "SO-PRICE-002",
      root_cause_category: "PROMO_EXPIRED",
      contract_ref: "4600012840",
      promotion_ref: "ZPROM/155 (expired 12/31/2025)",
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "TPR discount ZPROM expired 12/31. PO reflects promo price $13.20 but ERP reverted to base $14.88.",
        resolution: "AUTO_OVERRIDE",
        risk: "MEDIUM",
        waterfall: [
          { type: "BASE", label: "Base Price (PR00)", record: "PR00/10", value: 14.88, running: 14.88, detail: "SAP list price, material group 042, effective 01/01/2025" },
          { type: "CONTRACT", label: "Contract Price (ZA01)", record: "ZA01/620", value: 0, running: 14.88, detail: "Active contract #4600012840 — no additional discount at this tier" },
          { type: "TPR", label: "Trade Promo (ZPROM)", record: "ZPROM/155", value: -1.68, running: 13.20, detail: "Q4 promo: 11.3% off-invoice. Valid 10/01–12/31/2025." },
          { type: "ERROR", label: "Promo Validity Check", record: "ZPROM/155", value: null, running: null, detail: "Condition expired 12/31/2025. Current date outside validity.", error: "Promotional condition expired. PO $13.20 reflects promo price, ERP $14.88 reflects reverted base. Delta: -$1.68/unit." },
          { type: "RESULT", label: "ERP Computed Price", record: "—", value: 14.88, running: 14.88, detail: "Final ERP price after condition chain (promo excluded)" },
        ],
      },
      {
        line_id: "L2",
        diagnosis: "Same expired ZPROM condition as L1. Identical root cause.",
        resolution: "AUTO_OVERRIDE",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L3",
        diagnosis: "EDI transmission rounding: $14.90 vs $14.88. Within ±$0.05 tolerance.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── DUPLICATE_PO exception (YELLOW — needs approval) ────────────── */
  "exc-002": {
    diagnosis: "PO #PO-88421 matches existing PO #PO-88419 received 36 hours prior. Identical line items, quantities, and ship-to address. Likely EDI retransmission or buyer system retry.",
    confidence: 88,
    risk: "MEDIUM",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "Duplicate PO ID detected within 48-hour window. Identical SKUs, quantities, and delivery address.",
    recommendation: "Block duplicate PO and notify buyer for confirmation before processing.",
    entity_profile: {
      customer_name: "QuickMart Distribution",
      bp_number: "BP-207815",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 5200 — Dallas DC",
      region: "Central",
    },
    impact_metrics: {
      revenue_at_risk: 6720.00,
      delta_amount: 0,
      delta_percentage: 0,
      fulfillment_gap_pct: 0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T14:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Exact duplicate of PO-88419/L1. Same SKU, qty, ship-to.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Exact duplicate of PO-88419/L2. Same SKU, qty, ship-to.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
    duplicate_detection: {
      original_order: {
        so_number: "SO-1040",
        po_number: "PO-88419",
        created_date: "2026-04-09T21:00:00Z",
        total_value: 6720.00,
        line_count: 2,
        status: "In Fulfillment",
      },
      duplicate_order: {
        so_number: "SO-1042",
        po_number: "PO-88421",
        created_date: "2026-04-11T09:00:00Z",
        total_value: 6720.00,
        line_count: 2,
        status: "Pending",
      },
      detection_method: "Same customer + identical SKUs + identical quantities within 48-hour window",
      days_between: 1.5,
      confidence: 88,
      // ADR-032 — canonical 0-1 signal mirroring the backend projection
      // (uncalibrated until the loop ships). The scalar above stays 0-100.
      confidence_signal: { value: 0.88, calibrated: false, method: "duplicate_detection_composite_raw" },
      recommended_action: "Block duplicate SO-1042 and notify buyer QuickMart for confirmation",
      cancellation_target: "SO-1042",
      autonomy_applied: "L2 — Review required, value $6,720 exceeds auto-block threshold ($1,000)",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-1040",
          po_number: "PO-88419",
          created_date: "2026-04-09T21:00:00Z",
          customer: "QuickMart Distribution",
          lines: [
            { sku: "SKU-1180", description: "24-pk Water", qty: 500, unit_price: 9.60 },
            { sku: "SKU-1181", description: "12-pk Sparkling", qty: 200, unit_price: 11.40 },
          ],
          total_value: 7080.00,
          status: "In Fulfillment",
        },
        {
          so_number: "SO-1042",
          po_number: "PO-88421",
          created_date: "2026-04-11T09:00:00Z",
          customer: "QuickMart Distribution",
          lines: [
            { sku: "SKU-1180", description: "24-pk Water", qty: 500, unit_price: 9.62 },
            { sku: "SKU-1181", description: "12-pk Sparkling", qty: 200, unit_price: 10.00 },
          ],
          total_value: 6810.00,
          status: "Pending",
        },
      ],
      matching_fields: ["customer_id", "ship_to_address", "sku_list", "quantities"],
      differing_fields: ["po_number", "unit_prices"],
    },
  },
  /* ── CREDIT_BLOCK exception (RED) ────────────────────────────────── */
  "exc-003": {
    diagnosis: "Customer credit exposure ($142,500) exceeds approved credit limit ($125,000) by $17,500 (14%). Four line items totalling $13,782 would push exposure to $156,282. Credit hold applied per policy CREDIT-001.",
    confidence: 99,
    risk: "HIGH",
    resolution: "ESCALATE",
    root_cause: "Credit limit breach — current exposure 114% of approved limit. Order would push to 125%.",
    recommendation: "Escalate to Credit Manager for limit review. Do not release hold until exposure is within policy.",
    entity_profile: {
      customer_name: "FreshCo Wholesale Ltd",
      bp_number: "BP-310092",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "At Risk",
      location: "Plant 3400 — Chicago DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 13782.00,
      delta_amount: 17500.00,
      delta_percentage: 14.0,
      sla_priority: "CRITICAL",
      sla_deadline: "2026-04-11T12:00:00Z",
      affected_lines: 4,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "High-value snack bar order. Contributes $8,532 to credit exposure.",
        resolution: "ESCALATE",
        risk: "HIGH",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Protein bar line. Contributes $3,600 to credit exposure.",
        resolution: "ESCALATE",
        risk: "HIGH",
        waterfall: [],
      },
      {
        line_id: "L3",
        diagnosis: "Granola bar line. No price delta but contributes to credit total.",
        resolution: "ESCALATE",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L4",
        diagnosis: "Kids bar line. $600 delta adds $3,600 to exposure.",
        resolution: "ESCALATE",
        risk: "HIGH",
        waterfall: [],
      },
    ],
  },
  /* ── MASS_PRICING_ERROR exception ────────────────────────────────── */
  "exc-004": {
    diagnosis: "UOM conversion factor mismatch on both line items. Pack-size to case conversion not loaded in ERP master data.",
    confidence: 97,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "UOM conversion factor CS→EA missing from material master. ERP prices in case units, PO in each units.",
    recommendation: "Apply UOM correction factor and update material master to prevent recurrence.",
    entity_profile: {
      customer_name: "ValuePack Stores Inc",
      bp_number: "BP-445520",
      customer_tier: "Platinum",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 7800 — LA DC",
      region: "West",
    },
    impact_metrics: {
      revenue_at_risk: 14940.00,
      delta_amount: 2520.00,
      delta_percentage: 14.3,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T16:00:00Z",
      affected_lines: 2,
    },
    price_analysis: {
      erp_unit_price: 42.00,
      po_unit_price: 36.00,
      variance_amount: 6.00,
      variance_pct: 14.3,
      total_at_risk: 14940.00,
      total_quantity: 270,
      uom: "CS",
      doc_type: "Sales Order",
      doc_number: "SO-3100",
      sku: "SKU-5521",
      material_desc: "Family Pack x6",
      order_date: "2026-04-11T11:00:00Z",
      rule_id: "SO-PRICE-002",
      root_cause_category: "UOM_ERROR",
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "UOM conversion factor mismatch: 6-pack case factor not loaded.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [
          { type: "BASE", label: "Base Price (PR00)", record: "PR00/55", value: 42.00, running: 42.00, detail: "SAP list price per case (6-pack)" },
          { type: "UOM", label: "UOM Conversion", record: "QUOM/12", value: -6.00, running: 36.00, detail: "Pack-size conversion factor CS→EA" },
          { type: "ERROR", label: "UOM Validation", record: "QUOM/12", value: null, running: null, detail: "Conversion factor not loaded in material master.", error: "UOM conversion factor missing. PO price $36.00 uses EA unit, ERP price $42.00 uses CS unit." },
          { type: "RESULT", label: "ERP Computed Price", record: "—", value: 42.00, running: 42.00, detail: "ERP price without UOM conversion applied" },
        ],
      },
      {
        line_id: "L2",
        diagnosis: "Same UOM conversion issue for 12-pack variant.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── CONTRACTUAL_CORRECTION: Resolved ────────────────────────────── */
  "exc-005": {
    diagnosis: "Single line item — ERP base price not loaded for new SKU-0099. PO price matches contracted rate.",
    confidence: 95,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "New SKU price record (PR00) not yet loaded in SAP condition table. Contract rate is correct.",
    recommendation: "Approve PO price as contract rate and request SAP master data load for SKU-0099.",
    entity_profile: {
      customer_name: "Sunrise Beverages Co",
      bp_number: "BP-118903",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2100 — Miami DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 6220.80,
      delta_amount: 691.20,
      delta_percentage: 10.0,
      sla_priority: "LOW",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "ERP base price not loaded. PO price $17.28 is the correct contract rate.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── DUPLICATE_PO: Escalated (ambiguous duplicate) ────────────────── */
  "exc-006": {
    diagnosis: "PO flagged as potential duplicate. Similar line items but different quantities — may be a legitimate reorder vs. duplicate transmission.",
    confidence: 72,
    risk: "MEDIUM",
    resolution: "REQUEST_BUYER_CONFIRMATION",
    root_cause: "PO structure matches prior order within 72h window but quantities differ by 15%. Ambiguous duplicate.",
    recommendation: "Request buyer confirmation — quantities differ enough to be a legitimate reorder.",
    entity_profile: {
      customer_name: "PowerDrink Distributors",
      bp_number: "BP-520871",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 6100 — Denver DC",
      region: "Mountain",
    },
    impact_metrics: {
      revenue_at_risk: 8092.80,
      delta_amount: 456.00,
      delta_percentage: 5.6,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-12T08:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Similar to prior PO-91203/L1 but qty differs (480 vs 410). May be reorder.",
        resolution: "REQUEST_BUYER_CONFIRMATION",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Similar to prior PO-91203/L2 but qty differs (240 vs 200).",
        resolution: "REQUEST_BUYER_CONFIRMATION",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
    duplicate_detection: {
      original_order: {
        so_number: "SO-5008",
        po_number: "PO-91203",
        created_date: "2026-04-07T14:30:00Z",
        total_value: 7876.80,
        line_count: 2,
        status: "Shipped",
      },
      duplicate_order: {
        so_number: "SO-5010",
        po_number: "PO-91210",
        created_date: "2026-04-09T16:45:00Z",
        total_value: 8092.80,
        line_count: 2,
        status: "Pending Review",
      },
      detection_method: "Same customer + overlapping SKUs within 72-hour window. Quantities differ by 15%.",
      days_between: 2.1,
      confidence: 72,
      recommended_action: "Request buyer confirmation — quantities differ, may be legitimate reorder",
      cancellation_target: "SO-5010",
      autonomy_applied: "L3 — Buyer confirmation required, ambiguous duplicate with 72% confidence",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-5008",
          po_number: "PO-91203",
          created_date: "2026-04-07T14:30:00Z",
          customer: "PowerDrink Distributors",
          lines: [
            { sku: "SKU-7701", description: "Energy Drink 4pk", qty: 410, unit_price: 8.96 },
            { sku: "SKU-7705", description: "Energy Drink 8pk", qty: 200, unit_price: 17.50 },
          ],
          total_value: 7173.60,
          status: "Shipped",
        },
        {
          so_number: "SO-5010",
          po_number: "PO-91210",
          created_date: "2026-04-09T16:45:00Z",
          customer: "PowerDrink Distributors",
          lines: [
            { sku: "SKU-7701", description: "Energy Drink 4pk", qty: 480, unit_price: 8.50 },
            { sku: "SKU-7705", description: "Energy Drink 8pk", qty: 240, unit_price: 16.00 },
          ],
          total_value: 7920.00,
          status: "Pending Review",
        },
      ],
      matching_fields: ["customer_id", "sku_list", "ship_to_address"],
      differing_fields: ["quantities", "unit_prices", "po_number", "total_value"],
    },
  },
  /* ── CREDIT_BLOCK: Pending Review ────────────────────────────────── */
  "exc-007": {
    diagnosis: "Customer approaching credit limit. Current exposure $93,200 against $100,000 limit. This order ($5,040) would bring exposure to $98,240 — within limit but triggering the 90% warning threshold.",
    confidence: 85,
    risk: "MEDIUM",
    resolution: "ALLOW_BOTH",
    root_cause: "Credit exposure at 93.2% of limit. Order is within limit but triggers 90% warning policy (CREDIT-002).",
    recommendation: "Approve order — within credit limit. Flag account for proactive credit review within 7 days.",
    entity_profile: {
      customer_name: "ActiveLife Health Stores",
      bp_number: "BP-660134",
      customer_tier: "Gold",
      vip_status: true,
      credit_standing: "Watch",
      location: "Plant 1500 — NYC DC",
      region: "Northeast",
    },
    impact_metrics: {
      revenue_at_risk: 5040.00,
      delta_amount: 640.00,
      delta_percentage: 12.7,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T10:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Sports drink order. $1.60/unit delta. Within credit limit but near threshold.",
        resolution: "ALLOW_BOTH",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
  },
  /* ── CONTRACTUAL_CORRECTION: Closed ──────────────────────────────── */
  "exc-008": {
    diagnosis: "One line with expired seasonal promotion, one line priced correctly. Auto-resolved — promo condition reloaded from Q1 trade plan.",
    confidence: 96,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "Seasonal promo ZTEA/Q4 expired. Q1 replacement promo ZTEA/Q1 available in trade plan.",
    recommendation: "No action required — auto-resolved. Q1 promo condition applied successfully.",
    entity_profile: {
      customer_name: "GreenLeaf Natural Foods",
      bp_number: "BP-890045",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 3200 — Portland DC",
      region: "Pacific Northwest",
    },
    impact_metrics: {
      revenue_at_risk: 3375.00,
      delta_amount: 375.00,
      delta_percentage: 11.1,
      sla_priority: "LOW",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Seasonal promo ZTEA/Q4 expired. Q1 replacement promo available.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Correctly priced at base rate. No action needed.",
        resolution: "NONE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── DUPLICATE_PO: Auto-resolved (GREEN) ────────────────────────── */
  "exc-009": {
    diagnosis: "PO #PO-55102 is an exact retransmission of PO #PO-55100 received 4 hours prior. Identical customer, SKU, quantity, and ship-to. Low-value order ($504) auto-blocked per L1 autonomy policy.",
    confidence: 98,
    risk: "LOW",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "EDI retransmission — identical PO received within 4 hours. Single line item, exact match on all fields.",
    recommendation: "No action required — auto-resolved. Duplicate blocked and buyer notification sent.",
    entity_profile: {
      customer_name: "CornerShop Express",
      bp_number: "BP-330210",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2500 — Houston DC",
      region: "South",
    },
    impact_metrics: {
      revenue_at_risk: 504.00,
      delta_amount: 0,
      delta_percentage: 0,
      sla_priority: "LOW",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Exact duplicate of PO-55100/L1. Same SKU, qty, price, ship-to.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "LOW",
        waterfall: [],
      },
    ],
    duplicate_detection: {
      original_order: {
        so_number: "SO-8098",
        po_number: "PO-55100",
        created_date: "2026-04-11T02:15:00Z",
        total_value: 504.00,
        line_count: 1,
        status: "In Fulfillment",
      },
      duplicate_order: {
        so_number: "SO-8100",
        po_number: "PO-55102",
        created_date: "2026-04-11T06:20:00Z",
        total_value: 504.00,
        line_count: 1,
        status: "Blocked",
      },
      detection_method: "Exact match — same customer, SKU, quantity, price, and ship-to within 24-hour window",
      days_between: 0.17,
      confidence: 98,
      recommended_action: "Auto-blocked duplicate SO-8100. Buyer notification sent.",
      cancellation_target: "SO-8100",
      autonomy_applied: "L1 — Auto-block, value $504 below auto-block threshold ($1,000)",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-8098",
          po_number: "PO-55100",
          created_date: "2026-04-11T02:15:00Z",
          customer: "CornerShop Express",
          lines: [
            { sku: "SKU-4410", description: "Sports Water 24pk", qty: 60, unit_price: 8.40 },
          ],
          total_value: 504.00,
          status: "In Fulfillment",
        },
        {
          so_number: "SO-8100",
          po_number: "PO-55102",
          created_date: "2026-04-11T06:20:00Z",
          customer: "CornerShop Express",
          lines: [
            { sku: "SKU-4410", description: "Sports Water 24pk", qty: 60, unit_price: 8.40 },
          ],
          total_value: 504.00,
          status: "Blocked",
        },
      ],
      matching_fields: ["customer_id", "sku_list", "quantities", "unit_prices", "ship_to_address"],
      differing_fields: ["po_number"],
    },
  },
  /* ── BACK_ORDER: Pending Review (YELLOW) ───────────────────────────── */
  "exc-010": {
    diagnosis: "Customer ordered 800 CS of Premium Lager but only 480 CS available at primary DC. Gap of 320 CS (40%). Alternate DC in Denver has 200 CS with 3-day transit. Production order for 500 CS due in 8 days.",
    confidence: 84,
    risk: "HIGH",
    resolution: "SPLIT_SHIPMENT",
    root_cause: "Seasonal demand spike exceeded ATP forecast. Primary DC depleted below safety stock.",
    recommendation: "Split shipment: ship 480 CS from Atlanta DC now, source 200 CS from Denver DC (3-day transit, +$0.45/CS freight), backorder remaining 120 CS against production order.",
    entity_profile: {
      customer_name: "BevWorld Distributors",
      bp_number: "BP-750320",
      customer_tier: "Platinum",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 21280.00,
      delta_amount: 5920.00,
      delta_percentage: 27.8,
      fulfillment_gap_pct: 40.0,
      sla_priority: "CRITICAL",
      sla_deadline: "2026-04-13T18:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Premium Lager: 800 CS ordered, 480 CS available. 40% gap. Split shipment recommended.",
        resolution: "SPLIT_SHIPMENT",
        risk: "HIGH",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Light Lager: 400 CS ordered, 400 CS available. Fully available — no gap.",
        resolution: "FULFILL",
        risk: "LOW",
        waterfall: [],
      },
    ],
    backorder_analysis: {
      ordered_qty: 800,
      available_qty: 480,
      gap_qty: 320,
      gap_pct: 40.0,
      unit_price: 18.50,
      uom: "CS",
      at_risk: 5920.00,
      atp_date: "2026-04-20T00:00:00Z",
      primary_dc: {
        plant: "4100",
        name: "Atlanta Regional DC",
        region: "Southeast",
        qty: 480,
      },
      alternate_warehouses: [
        { plant: "6500", name: "Denver National DC", region: "Mountain", qty: 200, eta_days: 3, freight_delta_per_unit: 0.45, freight_delta_total: 90.00 },
        { plant: "7800", name: "LA Distribution Hub", region: "West", qty: 150, eta_days: 5, freight_delta_per_unit: 0.82, freight_delta_total: 123.00 },
        { plant: "1500", name: "NYC Metro DC", region: "Northeast", qty: 80, eta_days: 4, freight_delta_per_unit: 0.65, freight_delta_total: 52.00 },
      ],
      substitutes: [
        { sku: "SKU-6110", description: "Premium Lager 24pk", available_qty: 300, price_delta_pct: 8.5, acceptance_rate: 0.72, source: "Same brewery", priority: 1 },
        { sku: "SKU-6120", description: "Craft Lager 12pk", available_qty: 600, price_delta_pct: -5.2, acceptance_rate: 0.45, source: "Alternate brand", priority: 2 },
      ],
      production: { qty: 500, date: "2026-04-20T00:00:00Z" },
      inbound_po: { qty: 300, eta: "2026-04-18T00:00:00Z", po_num: "PO-99210" },
      resolution_options: [
        {
          id: "opt-1",
          type: "SPLIT_SHIPMENT",
          title: "Split Shipment (Atlanta + Denver)",
          description: "Ship 480 CS from Atlanta DC immediately. Source 200 CS from Denver DC (3-day transit, +$0.45/CS). Backorder 120 CS against production due Apr 20.",
          composite_score: 0.87,
          scores: { service: 0.82, revenue: 0.90, logistics: 0.85, preference: 0.91 },
          sap_steps: ["VA02 (split delivery)", "VL01N (create 2nd delivery)", "ME21N (interplant transfer)"],
          recommended: true,
        },
        {
          id: "opt-2",
          type: "FUTURE_DELIVERY",
          title: "Full Order — Future Delivery",
          description: "Hold entire order for production completion (Apr 20). Ship full 800 CS from Atlanta. Customer SLA risk: 8-day delay.",
          composite_score: 0.68,
          scores: { service: 0.45, revenue: 0.95, logistics: 0.92, preference: 0.40 },
          sap_steps: ["VA02 (change delivery date)", "ZPROD (reserve production)"],
          recommended: false,
        },
        {
          id: "opt-3",
          type: "SUBSTITUTE_SKU",
          title: "Substitute with Premium Lager 24pk",
          description: "Offer SKU-6110 (24pk) as substitute for 300 CS. 72% historical acceptance rate. 8.5% price premium requires approval.",
          composite_score: 0.61,
          scores: { service: 0.70, revenue: 0.55, logistics: 0.90, preference: 0.30 },
          sap_steps: ["VA02 (line substitution)", "VK11 (price adjustment)", "ZPROM (promo check)"],
          recommended: false,
        },
        {
          id: "opt-4",
          type: "ALT_DC",
          title: "Fulfill from LA Hub",
          description: "Source full 800 CS from LA Distribution Hub. All stock available but 5-day transit and +$0.82/CS freight increases cost by $656.",
          composite_score: 0.52,
          scores: { service: 0.60, revenue: 0.40, logistics: 0.35, preference: 0.72 },
          sap_steps: ["VL01N (delivery from 7800)", "ME21N (interplant)", "VA02 (reassign)"],
          recommended: false,
        },
      ],
    },
  },
  /* ── BACK_ORDER: Auto-resolved (GREEN) ─────────────────────────────── */
  "exc-011": {
    diagnosis: "Customer ordered 200 CS of Craft IPA. Only 140 CS available at primary DC. Alternate DC in Chicago has 120 CS with 2-day transit. Auto-resolved via split shipment.",
    confidence: 94,
    risk: "LOW",
    resolution: "SPLIT_SHIPMENT",
    root_cause: "Routine stock depletion — replenishment order in transit covers gap.",
    recommendation: "No action required — auto-resolved. Split shipment executed: 140 CS from Portland, 60 CS from Chicago.",
    entity_profile: {
      customer_name: "Hop City Brewing Supply",
      bp_number: "BP-220145",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 3200 — Portland DC",
      region: "Pacific Northwest",
    },
    impact_metrics: {
      revenue_at_risk: 4400.00,
      delta_amount: 1320.00,
      delta_percentage: 30.0,
      fulfillment_gap_pct: 30.0,
      sla_priority: "MEDIUM",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Craft IPA: 200 CS ordered, 140 CS at primary DC. Split shipment auto-executed.",
        resolution: "SPLIT_SHIPMENT",
        risk: "LOW",
        waterfall: [],
      },
    ],
    backorder_analysis: {
      ordered_qty: 200,
      available_qty: 140,
      gap_qty: 60,
      gap_pct: 30.0,
      unit_price: 22.00,
      uom: "CS",
      at_risk: 1320.00,
      atp_date: "2026-04-15T00:00:00Z",
      primary_dc: {
        plant: "3200",
        name: "Portland DC",
        region: "Pacific Northwest",
        qty: 140,
      },
      alternate_warehouses: [
        { plant: "3400", name: "Chicago Central DC", region: "Midwest", qty: 120, eta_days: 2, freight_delta_per_unit: 0.35, freight_delta_total: 21.00 },
      ],
      substitutes: [],
      production: { qty: 400, date: "2026-04-17T00:00:00Z" },
      inbound_po: null,
      resolution_options: [
        {
          id: "opt-1",
          type: "SPLIT_SHIPMENT",
          title: "Split Shipment (Portland + Chicago)",
          description: "Ship 140 CS from Portland DC, 60 CS from Chicago DC (2-day transit, +$0.35/CS).",
          composite_score: 0.92,
          scores: { service: 0.90, revenue: 0.88, logistics: 0.95, preference: 0.95 },
          sap_steps: ["VA02 (split delivery)", "VL01N (create 2nd delivery)"],
          recommended: true,
        },
      ],
    },
  },
  /* ── OVER_MAX: Pending Review (YELLOW) ─────────────────────────────── */
  "exc-012": {
    diagnosis: "Total order quantity (2,600 CS) exceeds contract maximum (2,000 CS) by 600 CS (30%). Three line items, two exceeding per-line maximums. SAP block V4080 applied.",
    confidence: 91,
    risk: "MEDIUM",
    resolution: "TRIM",
    root_cause: "Customer placed order 30% above contract max. SKU-9010 and SKU-9020 individually exceed line-level maximums.",
    recommendation: "Apply AI trim plan to reduce order to contract maximum. Two lines need trimming; one is within limit.",
    entity_profile: {
      customer_name: "AquaPure Distribution",
      bp_number: "BP-880460",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 30020.00,
      delta_amount: 8660.00,
      delta_percentage: 28.8,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-14T12:00:00Z",
      affected_lines: 3,
    },
    lines: [
      { line_id: "L1", diagnosis: "1,200 CS ordered, max 900 CS. Excess 300 CS. Trim recommended.", resolution: "TRIM", risk: "MEDIUM", waterfall: [] },
      { line_id: "L2", diagnosis: "800 CS ordered, within max 800 CS. No action needed.", resolution: "OK", risk: "LOW", waterfall: [] },
      { line_id: "L3", diagnosis: "600 CS ordered, max 300 CS. Excess 300 CS. Even-layer item — trim to 288 CS (full layers).", resolution: "TRIM", risk: "MEDIUM", waterfall: [] },
    ],
    overmax_analysis: {
      total_ordered: 2600,
      max_qty: 2000,
      excess_qty: 600,
      exceedance_pct: 30.0,
      uom: "CS",
      at_risk: 8660.00,
      contract_ref: "CTR-4600018820",
      block_status: "V4080",
      block_reason: "Order quantity exceeds contract maximum — automatic block per SD-OM-001",
      order_lines: [
        { sku: "SKU-9010", description: "Sparkling Mineral 12pk", qty: 1200, max_line_qty: 900, excess: 300, is_even_layer_item: false },
        { sku: "SKU-9015", description: "Still Mineral 12pk", qty: 800, max_line_qty: 800, excess: 0, is_even_layer_item: false },
        { sku: "SKU-9020", description: "Flavored Water 24pk", qty: 600, max_line_qty: 300, excess: 300, is_even_layer_item: true },
      ],
      trim_plan: [
        { sku: "SKU-9010", description: "Sparkling Mineral 12pk", ordered: 1200, trimmed_to: 900, delta: 300, action: "TRIM" },
        { sku: "SKU-9015", description: "Still Mineral 12pk", ordered: 800, trimmed_to: 800, delta: 0, action: "OK" },
        { sku: "SKU-9020", description: "Flavored Water 24pk", ordered: 600, trimmed_to: 288, delta: 312, action: "TRIM" },
      ],
      // Server-computed roll-ups (api/schemas.py model_validator): sum of
      // trimmed_to / delta across trim_plan. Mirrored here so the mock layer
      // matches the backend contract (Guardrail #6).
      trimmed_total: 1988,
      delta_total: 612,
    },
  },
  /* ── MIN_ORDER_QTY: Pending Review (YELLOW) ────────────────────────── */
  "exc-013": {
    diagnosis: "Order for 65 CS total (2 SKUs) is below the minimum order quantity of 100 CS for this distribution channel. SAP V4082 block applied. Two lines: one can be rounded up to MOQ, one needs escalation due to KNMT waiver requirement.",
    confidence: 89,
    risk: "MEDIUM",
    resolution: "ROUND_UP",
    root_cause: "Order quantity 35% below channel MOQ. MOQ set via KNMT-MINBM for Direct Store Delivery channel.",
    recommendation: "Round up SKU-7800 from 40 to 72 CS (full pallet layer). Escalate SKU-7810 for KNMT waiver — below individual MOQ of 48 CS.",
    entity_profile: {
      customer_name: "Fermented Foods Co",
      bp_number: "BP-990215",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2100 — Miami DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 1790.00,
      delta_amount: 625.00,
      delta_percentage: 34.9,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-15T12:00:00Z",
      affected_lines: 2,
    },
    lines: [
      { line_id: "L1", diagnosis: "40 CS ordered, MOQ 48 CS. Shortfall 8 CS. Round up to 72 CS (full layer = 24 CS/layer × 3).", resolution: "ROUND_UP", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "25 CS ordered, MOQ 48 CS. Shortfall 23 CS. Below 50% of MOQ — requires KNMT waiver.", resolution: "ESCALATE", risk: "MEDIUM", waterfall: [] },
    ],
    moq_analysis: {
      ordered_qty: 65,
      moq_qty: 100,
      shortfall_qty: 35,
      shortfall_pct: 35.0,
      sku: "SKU-7800",
      description: "Organic Kombucha 6pk",
      unit_cost: 28.50,
      uom: "CS",
      at_risk: 1790.00,
      moq_source: "KNMT-MINBM",
      channel: "Direct Store Delivery",
      block_message: "Order quantity 65 CS is below minimum order quantity 100 CS for DSD channel. Block V4082 applied per SD-MOQ-001.",
      contract_ref: "CTR-4600022150",
      block_status: "V4082",
      round_up_plan: [
        { sku: "SKU-7800", description: "Organic Kombucha 6pk", ordered: 40, round_up_to: 72, delta: 32, action: "ROUND_UP" },
        { sku: "SKU-7810", description: "Ginger Kombucha 6pk", ordered: 25, round_up_to: 25, delta: 0, action: "ESCALATE" },
      ],
      sap_steps: [
        { step: 1, transaction: "VA02", table: "VBAP", field: "KWMENG", description: "Update order quantity for SKU-7800 from 40 to 72 CS" },
        { step: 2, transaction: "VK11", table: "KONV", field: "KBETR", description: "Apply MOQ round-up pricing adjustment (volume discount tier)" },
        { step: 3, transaction: "V.23", table: "VBAK", field: "LIFSK", description: "Release V4082 delivery block after quantity adjustment" },
        { step: 4, transaction: "VA02", table: "VBAP", field: "ABGRU", description: "Set rejection reason on SKU-7810 pending KNMT waiver approval" },
      ],
    },
  },
  /* ── PALLET_CONFIG: Pending Review (YELLOW) ────────────────────────── */
  "exc-014": {
    diagnosis: "Order has 3 SKUs with pallet alignment violations. 2 broken layers and 1 partial pallet. Total 37 loose cases requiring manual handling — estimated 1.5 extra labor hours and 8.2% freight waste.",
    confidence: 93,
    risk: "MEDIUM",
    resolution: "PALLET_ALIGN",
    root_cause: "Ordered quantities do not align to full pallet layers. Broken layers on SKU-3500 and SKU-3520; partial pallet on SKU-3510.",
    recommendation: "Apply AI suggested plan: round SKU-3500 from 170 to 168 (7 full layers), round SKU-3510 from 85 to 84 (6 full layers), round SKU-3520 from 50 to 48 (4 full layers).",
    entity_profile: {
      customer_name: "CafeBrew Supply Co",
      bp_number: "BP-410830",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 3400 — Chicago DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 11162.50,
      delta_amount: 267.00,
      delta_percentage: 2.4,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-15T16:00:00Z",
      affected_lines: 3,
    },
    lines: [
      { line_id: "L1", diagnosis: "170 CS ordered, layer qty 24. 7 full layers = 168, 2 loose. Broken layer.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "85 CS ordered, layer qty 14. 6 full layers = 84, 1 loose. Broken layer.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
      { line_id: "L3", diagnosis: "50 CS ordered, layer qty 12. 4 full layers = 48, 2 loose. Partial pallet.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
    ],
    pallet_analysis: {
      // Lines mix Broken Layer + Partial Pallet → recipe classifies MIXED_VIOLATION.
      classification: "MIXED_VIOLATION",
      total_ordered_cases: 305,
      loose_cases_total: 37,
      at_risk_total: 1301.50,
      extra_labor_est_hrs: 1.5,
      freight_waste_pct: 8.2,
      order_line_count: 3,
      lines: [
        {
          sku: "SKU-3500", description: "Premium Coffee 12oz 24pk", uom: "CS",
          layer_qty: 24, pallet_qty: 168, ordered_qty: 170, complete_layers: 7,
          loose_qty: 2, full_pallets: 1, pallet_fill_pct: 101.2, violation_type: "Broken Layer",
        },
        {
          sku: "SKU-3510", description: "Decaf Coffee 12oz 24pk", uom: "CS",
          layer_qty: 14, pallet_qty: 84, ordered_qty: 85, complete_layers: 6,
          loose_qty: 1, full_pallets: 1, pallet_fill_pct: 101.2, violation_type: "Broken Layer",
        },
        {
          sku: "SKU-3520", description: "Cold Brew 10oz 12pk", uom: "CS",
          layer_qty: 12, pallet_qty: 48, ordered_qty: 50, complete_layers: 4,
          loose_qty: 2, full_pallets: 1, pallet_fill_pct: 104.2, violation_type: "Partial Pallet",
        },
      ],
      suggested_plan: [
        { sku: "SKU-3500", description: "Premium Coffee 24pk", current: 170, suggested: 168, delta: -2, layers: 7, full_pallets: 1, reason: "Round down to full layers (24 CS/layer × 7)" },
        { sku: "SKU-3510", description: "Decaf Coffee 24pk", current: 85, suggested: 84, delta: -1, layers: 6, full_pallets: 1, reason: "Round down to full layers (14 CS/layer × 6)" },
        { sku: "SKU-3520", description: "Cold Brew 12pk", current: 50, suggested: 48, delta: -2, layers: 4, full_pallets: 1, reason: "Round down to full layers (12 CS/layer × 4)" },
      ],
    },
  },
  /* ── DELIVERY_DELAY: Pending Review (YELLOW) ──────────────────────────── */
  "exc-016": {
    diagnosis: "Shipment is 6 days behind the contracted delivery window. Root cause is a carrier hub closure in the Southwest corridor. SLA breach is imminent; three alternate routing options available.",
    confidence: 88,
    risk: "HIGH",
    resolution: "ALTERNATE_ROUTING",
    root_cause: "Carrier DHL regional hub closure (weather-driven) — affected all southbound lanes for 48h.",
    recommendation: "Re-route via FedEx Express through Memphis hub; restores ETA to within 1 day of planned, +$620 freight.",
    entity_profile: {
      customer_name: "Target Supply Co",
      bp_number: "BP-TGT-002",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "DC-042 — Dallas",
      region: "Southwest",
    },
    impact_metrics: {
      revenue_at_risk: 48600.00,
      delta_amount: 2430.00,
      delta_percentage: 5.0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-22T18:00:00Z",
      affected_lines: 4,
    },
    lines: [
      { line_id: "L1", diagnosis: "12,000 CS of grocery SKUs held at DHL Phoenix hub.", resolution: "RE-ROUTE", risk: "MEDIUM", waterfall: [] },
    ],
    delivery_delay_analysis: {
      planned_date: "2026-04-18T00:00:00Z",
      projected_eta: "2026-04-24T00:00:00Z",
      days_late: 6,
      rule_id: "SD-DELAY-002",
      delay_category: "CARRIER_DELAY",
      delay_reason: "DHL Phoenix regional hub was closed Apr 16–18 due to severe weather. 12,000 CS of strategic-tier inventory waiting on outbound line-haul. Ripple effect on 3 downstream POs.",
      affected_lines: 4,
      at_risk: 48600.00,
      carrier: "DHL Ground",
      route: "LGB → PHX → DAL",
      sla_deadline: "2026-04-22T18:00:00Z",
      alternate_options: [
        {
          id: "opt-1",
          type: "EXPEDITE",
          title: "Re-route via FedEx Memphis hub",
          description: "Swap to FedEx Express line-haul through MEM; bypasses affected PHX corridor. ETA Apr 19.",
          new_eta: "2026-04-19T00:00:00Z",
          extra_cost: 620,
          recommended: true,
        },
        {
          id: "opt-2",
          type: "SPLIT_SHIP",
          title: "Partial pickup + priority balance",
          description: "Release 70% from PHX as soon as hub reopens (Apr 20), expedite remaining 30% via UPS 2-Day.",
          new_eta: "2026-04-22T00:00:00Z",
          extra_cost: 280,
          recommended: false,
        },
        {
          id: "opt-3",
          type: "RESCHEDULE",
          title: "Full re-slot to Apr 24 window",
          description: "Customer confirmed flexibility on 2 of 4 SKUs; negotiate revised PO with 6-day push, no premium.",
          new_eta: "2026-04-24T00:00:00Z",
          extra_cost: 0,
          recommended: false,
        },
      ],
    },
  },
  /* ── EDI_MISMATCH: SKU hard reject (RED) ────────────────────────────
   * Inbound PO references a material not in the master. Hard-reject.
   */
  "exc-019": {
    diagnosis: "Target PO PO-EDM-SKU-001 references material SKU-999-UNKNOWN on line 1 — not present in the SAP material master (MARA). Inbound-order validation hard-rejected the line; buyer notification dispatched automatically.",
    confidence: 99,
    risk: "HIGH",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "Received SKU does not match any active record in SAP material master. Order cannot be fulfilled as received — either buyer picked a stale SKU or a catalog entry was purged without buyer-side update.",
    recommendation: "Buyer has been notified with the unknown-SKU block. Await corrected PO with the active successor SKU before resuming fulfilment.",
    entity_profile: {
      customer_name: "Target Supply Co",
      bp_number: "BP-TGT-002",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 3200 — Minneapolis DC",
      region: "North Central",
    },
    impact_metrics: {
      // PO nominally references ~80 CS at ~$63/CS per the surrounding
      // line — capturing the nominal revenue so operators see the blast
      // radius even for an unknown SKU.
      revenue_at_risk: 5040.00,
      delta_amount: 5040.00,
      delta_percentage: 100.0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-18T12:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Expected SKU-001 (active in MARA, material group 201); received SKU-999-UNKNOWN (no MARA record). Qty 80 CS, nominal value $5,040.00.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "HIGH",
        waterfall: [],
      },
    ],
    edi_mismatch_analysis: {
      sub_type: "SKU_MISMATCH",
      classification: "HARD_REJECT",
      recommended_action: "BLOCK_AND_NOTIFY",
      autonomy_level: "L3",
      expected_value: "SKU-001",
      received_value: "SKU-999-UNKNOWN",
      notification_template: "edi_line_mismatch_blocked",
    },
  },
  /* ── EDI_MISMATCH: QTY review required (YELLOW) ─────────────────────
   * Quantity variance exceeds pallet tolerance. Confirm with buyer.
   */
  "exc-020": {
    diagnosis: "Costco PO PO-EDM-QTY-001 received quantity 144 CS on line 1 instead of the contract-aligned 120 CS (+20%). Variance exceeds pallet-break tolerance; EdiMismatchRecipe flagged for buyer confirmation before release.",
    confidence: 87,
    risk: "MEDIUM",
    resolution: "REQUEST_BUYER_CONFIRMATION",
    root_cause: "Quantity received is 1 pallet layer above the contract forecast. Likely buyer-side PO upsize (seasonal / promo-driven) or an EDI translation error at the 3PL integration.",
    recommendation: "Confirm upsize with Costco's buyer. Approve to fulfil at 144 CS, or override to the contract quantity (120 CS) and flag an exception to the buyer.",
    entity_profile: {
      customer_name: "Costco Wholesale",
      bp_number: "BP-CSC-004",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 7100 — Issaquah DC",
      region: "Pacific NW",
    },
    impact_metrics: {
      revenue_at_risk: 7200.00,
      delta_amount: 1200.00,
      delta_percentage: 20.0,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-18T18:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Expected qty 120 CS (contract forecast); received 144 CS (+24 CS, +20%). Aligns to 1 pallet-layer over-pull at current pack config.",
        resolution: "REQUEST_BUYER_CONFIRMATION",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
    edi_mismatch_analysis: {
      sub_type: "QTY_MISMATCH",
      classification: "REVIEW",
      recommended_action: "REQUEST_BUYER_CONFIRMATION",
      autonomy_level: "L2",
      expected_value: 120,
      received_value: 144,
      notification_template: "edi_line_mismatch_inquiry",
    },
  },
  /* ── PRICE_MISMATCH routing fork: lands as CONTRACTUAL_CORRECTION ───
   * Backend classifier routed this EDI_850_LINE_MISMATCH (sub_type
   * PRICE_MISMATCH) to CONTRACTUAL_CORRECTION + PriceAdjustmentRecipe —
   * preserving the single source of truth for pricing (CLAUDE.md §1
   * in asoe2). The UI renders PriceAnalysisSection (not
   * EdiMismatchSection) because only `price_analysis` is populated;
   * edi_mismatch_analysis is absent.
   */
  "exc-021": {
    diagnosis: "Inbound EDI 850 line 1 arrived with a price mismatch: received $95.00 against contract base $100.00 (−5.0%). The asoe2 classifier routed the event to CONTRACTUAL_CORRECTION so PriceAdjustmentRecipe owns the resolution. Variance is within the 15% discount ceiling — GREEN shadow verdict, auto-override applied via YK07 customer-match condition.",
    confidence: 94,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "PO references a Q2 customer-match price concession (ZCUST/404) outside the base pricing condition. Variance within the contractual discount ceiling; auto-override permitted.",
    recommendation: "No human action required. SAP adjusted via YK07 customer-match condition; delivery proceeds at $95.00.",
    entity_profile: {
      customer_name: "Walmart Inc",
      bp_number: "BP-WMT-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 4100 — Bentonville DC",
      region: "South Central",
    },
    impact_metrics: {
      revenue_at_risk: 9500.00,
      delta_amount: 500.00,
      delta_percentage: 5.0,
      sla_priority: "LOW",
      sla_deadline: "2026-04-18T18:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "PO $95.00 vs contract base $100.00 (−5.0%). Matches active Q2 customer concession ZCUST/404. Within 15% discount ceiling — auto-override via YK07.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [
          { type: "BASE",     label: "Base Price (PR00)",        record: "PR00/10",    value: 100.00, running: 100.00, detail: "SAP list price, material group 205, effective 01/01/2026" },
          { type: "CONTRACT", label: "Contract Price (ZA01)",    record: "ZA01/620",   value: 0,      running: 100.00, detail: "Walmart strategic-tier contract #4600019910 — base unchanged" },
          { type: "TPR",      label: "Customer Concession",      record: "ZCUST/404",  value: -5.00,  running: 95.00,  detail: "Q2 customer-match concession. Valid 04/01–06/30/2026." },
          { type: "RESULT",   label: "Override Applied (YK07)",  record: "YK07/55",    value: 0,      running: 95.00,  detail: "Auto-override via customer-match condition. Delta within 15% ceiling." },
        ],
      },
    ],
    price_analysis: {
      erp_unit_price: 100.00,
      po_unit_price: 95.00,
      variance_amount: 5.00,
      variance_pct: 5.0,
      total_at_risk: 9500.00,
      total_quantity: 100,
      uom: "CS",
      doc_type: "Sales Order",
      doc_number: "SO-PM-ROUTING-001",
      sku: "SKU-PRICE-MM",
      material_desc: "Routed from EDI 850 sub_type PRICE_MISMATCH",
      order_date: "2026-04-17T10:00:00Z",
      rule_id: "SO-PRICE-002",
      root_cause_category: "CUSTOMER_CONCESSION",
      contract_ref: "4600019910",
      promotion_ref: "ZCUST/404 (Q2 2026 concession)",
    },
  },

  /* ── Multi-issue case fixtures ────────────────────────────────────
     Three CPG-realistic clusters: one PO produces N coincident
     exceptions. Each record below stands alone (its own analysis
     payload, evidence grid, and resolution recommendation), but
     they share a `parent_case_id` in MOCK_EXCEPTIONS so the
     RecordListPane renders an N-row picker on the case detail
     surface.
     ─────────────────────────────────────────────────────────────── */

  /* ── Case 1 (PO-WMT-Q1-RESET-001) — Walmart Q1 reset bundle.
   *    exc-027  Price hold escalate band (+5.5% over base)
   *    exc-028  Back-order at primary DC (320 CS short of 800)
   *    exc-029  Buyer EDI system retransmitted the PO (duplicate)
   * ───────────────────────────────────────────────────────────── */
  "exc-027": {
    diagnosis: "Q1 reset PO from Walmart held on pricing check: line 1's PO price ($21.10) deviates +5.5% from the SAP base ($20.00) at Plant 4100. Above the 2.0% auto-release tolerance, below the 10.0% hard-block ceiling — PriceHoldReleaseRecipe escalated to category manager. Q1 promotional reset window opened 2026-05-01; buyer may have applied an unconfirmed promo upcharge ahead of the planogram swap.",
    confidence: 90,
    risk: "MEDIUM",
    resolution: "ESCALATE",
    root_cause: "PO price exceeds auto-release tolerance. Walmart's Q1 reset typically lands with a +3–5% margin uplift confirmed via JBP letter; that letter has not yet arrived in the contract repository.",
    recommendation: "Category manager confirms the Q1 JBP uplift letter is in flight, then approves the price-hold release. Reject + buyer notification if the uplift is unauthorised.",
    entity_profile: {
      customer_name: "Walmart Inc",
      bp_number: "BP-WMT-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 4100 — Bentonville DC",
      region: "South Central",
    },
    impact_metrics: {
      revenue_at_risk: 33_760.00,
      delta_amount: 1_760.00,
      delta_percentage: 5.5,
      sla_priority: "HIGH",
      sla_deadline: "2026-05-05T18:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "PO $21.10 vs SAP base $20.00 (+5.5%). Above ±2.0% release tolerance, under +10.0% hard-block. Q1 reset window — pending JBP confirmation.",
        resolution: "ESCALATE",
        risk: "MEDIUM",
        waterfall: [
          { type: "BASE",     label: "Base Price (PR00)",       record: "PR00/10",    value: 20.00, running: 20.00, detail: "SAP list price, material group 207, effective 04/01/2026" },
          { type: "CONTRACT", label: "Contract Price (ZA01)",   record: "ZA01/620",   value: 0,     running: 20.00, detail: "Walmart strategic contract #4600055901 — base aligned, no automatic Q1 uplift clause" },
          { type: "RESULT",   label: "PO Price (incoming)",     record: "EDI 850/L1", value: 21.10, running: 21.10, detail: "Variance +$1.10 (+5.5%). Above tolerance; block held for review." },
          { type: "ERROR",    label: "Pricing Block Check",     record: "VBKD-FAKSK", value: null,  running: null,  detail: "Release tolerance: ±2.0%. Hard-block: ±10.0%.", error: "Escalate — variance above auto-release threshold; below hard-block." },
        ],
      },
    ],
    price_hold_analysis: {
      hold_status: "HELD",
      po_price: 21.10,
      sap_base_price: 20.00,
      variance_pct: 0.055,
      tolerance_pct: 0.02,
      hard_block_pct: 0.10,
      action: "ESCALATE",
      reason: "Variance +5.5% above tolerance (+2.0%); under hard-block (+10.0%). Category manager review required pending Q1 JBP uplift confirmation.",
    },
  },

  "exc-028": {
    diagnosis: "Walmart ordered 1,600 CS of the Q1-reset SKU but Bentonville DC had only 1,280 CS on hand (320 CS / 20% gap). Agent split the shipment: 1,280 CS ex-Bentonville released for outbound; 320 CS ex-Memphis NDC on the 2-day transfer lane. Planogram window preserved; freight uplift $102.40 within the GREEN tolerance band.",
    confidence: 94,
    risk: "LOW",
    resolution: "SPLIT_SHIPMENT",
    root_cause: "Bentonville pre-shipped Q4 closeout volume against the new planogram, depleting safety stock below the Q1 reset wave demand. Mid-month production run not yet scheduled.",
    recommendation: "No action required — auto-resolved. Split shipment executed: 1,280 CS from Bentonville, 320 CS from Memphis NDC.",
    entity_profile: {
      customer_name: "Walmart Inc",
      bp_number: "BP-WMT-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 4100 — Bentonville DC",
      region: "South Central",
    },
    impact_metrics: {
      revenue_at_risk: 33_760.00,
      delta_amount: 6_752.00,
      delta_percentage: 20.0,
      fulfillment_gap_pct: 20.0,
      sla_priority: "CRITICAL",
      sla_deadline: "2026-05-06T12:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Q1 reset SKU: 1,600 CS ordered, 1,280 CS available at primary DC (Bentonville). 20% gap.",
        resolution: "SPLIT_SHIPMENT",
        risk: "HIGH",
        waterfall: [],
      },
    ],
    backorder_analysis: {
      ordered_qty: 1_600,
      available_qty: 1_280,
      gap_qty: 320,
      gap_pct: 20.0,
      unit_price: 21.10,
      uom: "CS",
      at_risk: 6_752.00,
      atp_date: "2026-05-12T00:00:00Z",
      primary_dc: {
        plant: "4100",
        name: "Bentonville Regional DC",
        region: "South Central",
        qty: 1_280,
      },
      alternate_warehouses: [
        { plant: "3450", name: "Memphis National DC", region: "Mid-South", qty: 400, eta_days: 2, freight_delta_per_unit: 0.32, freight_delta_total: 102.40 },
        { plant: "5200", name: "Dallas Distribution Hub", region: "South Central", qty: 220, eta_days: 3, freight_delta_per_unit: 0.48, freight_delta_total: 153.60 },
      ],
      substitutes: [],
      production: { qty: 800, date: "2026-05-12T00:00:00Z" },
      inbound_po: null,
      resolution_options: [
        {
          id: "opt-1",
          type: "SPLIT_SHIPMENT",
          title: "Split Shipment (Bentonville + Memphis)",
          description: "1,280 CS ex-Bentonville, 320 CS ex-Memphis on the 2-day lane. Maintains planogram window.",
          composite_score: 0.91,
          scores: { service: 0.93, revenue: 0.92, logistics: 0.88, preference: 0.92 },
          sap_steps: ["VA02 (split delivery)", "VL01N (create 2nd delivery)", "ME21N (interplant transfer)"],
          recommended: true,
        },
        {
          id: "opt-2",
          type: "FUTURE_DELIVERY",
          title: "Hold full 1,600 CS for production run",
          description: "Defer ship date 6 days for the inbound production order. Misses the May 6 planogram window.",
          composite_score: 0.42,
          scores: { service: 0.25, revenue: 0.95, logistics: 0.85, preference: 0.20 },
          sap_steps: ["VA02 (change delivery date)", "ZPROD (reserve production)"],
          recommended: false,
        },
      ],
    },
  },

  "exc-029": {
    diagnosis: "PO PO-WMT-Q1-RESET-001-R2 arrived 18h after the original PO-WMT-Q1-RESET-001 with identical line items, quantities, and ship-to. RED — DuplicatePORecipe auto-blocked the retransmission; a courtesy 855 ack was queued against the original PO and Walmart's EDI ops were notified. No human action required for THIS record; the original PO remains in pricing review on its sibling exc-027.",
    confidence: 97,
    risk: "MEDIUM",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "Buyer EDI VAN auto-retried after missing 855 ack within the 12h SLA. The original PO is the canonical record; the R2 retry was caught by the 48h duplicate-detection window.",
    recommendation: "Blocked and notified — no operator action on this record. Resolve the price-hold escalation on the sibling exc-027 to release the original PO.",
    entity_profile: {
      customer_name: "Walmart Inc",
      bp_number: "BP-WMT-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 4100 — Bentonville DC",
      region: "South Central",
    },
    impact_metrics: {
      revenue_at_risk: 33_760.00,
      delta_amount: 0,
      delta_percentage: 0,
      fulfillment_gap_pct: 0,
      sla_priority: "HIGH",
      sla_deadline: "2026-05-06T01:30:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Exact duplicate of PO-WMT-Q1-RESET-001/L1. Same SKU, qty, ship-to, ship date.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
    duplicate_detection: {
      original_order: {
        so_number: "SO-WMT-Q1RESET-001",
        po_number: "PO-WMT-Q1-RESET-001",
        created_date: "2026-05-04T07:10:00Z",
        total_value: 33_760.00,
        line_count: 1,
        status: "Pending Pricing Review",
      },
      duplicate_order: {
        so_number: "SO-WMT-Q1RESET-001-R2",
        po_number: "PO-WMT-Q1-RESET-001-R2",
        created_date: "2026-05-05T01:30:00Z",
        total_value: 33_760.00,
        line_count: 1,
        status: "Pending",
      },
      detection_method: "Identical customer + SKU + qty + ship-to within the 48-hour window; PO suffix '-R2' matches Walmart's retransmission convention.",
      days_between: 0.77,
      confidence: 97,
      recommended_action: "Auto-blocked SO-WMT-Q1RESET-001-R2; 855 ack sent against the original PO.",
      cancellation_target: "SO-WMT-Q1RESET-001-R2",
      autonomy_applied: "L3 — Auto-blocked. Exact retransmission of an in-window canonical PO; the case still owes a decision on the price-hold sibling (exc-027).",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-WMT-Q1RESET-001",
          po_number: "PO-WMT-Q1-RESET-001",
          created_date: "2026-05-04T07:10:00Z",
          customer: "Walmart Inc",
          lines: [
            { sku: "SKU-Q1R-2076", description: "Q1 Reset Display Pack", qty: 1_600, unit_price: 21.10 },
          ],
          total_value: 33_760.00,
          status: "Pending Pricing Review",
        },
        {
          so_number: "SO-WMT-Q1RESET-001-R2",
          po_number: "PO-WMT-Q1-RESET-001-R2",
          created_date: "2026-05-05T01:30:00Z",
          customer: "Walmart Inc",
          lines: [
            { sku: "SKU-Q1R-2076", description: "Q1 Reset Display Pack", qty: 1_600, unit_price: 21.10 },
          ],
          total_value: 33_760.00,
          status: "Pending",
        },
      ],
      matching_fields: ["customer_id", "ship_to_address", "sku_list", "quantities", "unit_prices"],
      differing_fields: ["po_number", "received_at"],
    },
  },

  /* ── Case 2 (PO-COST-EOQ-2026Q1) — Costco end-of-quarter bundle.
   *    exc-030  Over-max: club-pack ceiling breach (+33%)
   *    exc-031  Pallet config: layers don't tile to Costco club spec
   * ───────────────────────────────────────────────────────────── */
  "exc-030": {
    diagnosis: "Costco end-of-quarter PO totals 4,000 CS, exceeding the contract maximum of 3,000 CS by 1,000 CS (33%). Two SKUs blew through their per-line ceilings. SAP V4080 applied. The EOQ closeout is a known seasonal spike — last year saw the same buyer over-pull by 28%.",
    confidence: 92,
    risk: "MEDIUM",
    resolution: "TRIM",
    root_cause: "Costco's EOQ allocation grid does not gate against our contract maxima — buyer-side planning lands the order at the gross demand figure even when our line-level ceilings would cap it.",
    recommendation: "Apply the AI trim plan: round SKU-COST-EOQ-A to its per-line ceiling (1,500 CS) and SKU-COST-EOQ-B to a full club-pack pallet (1,500 CS, even layers). Notify category manager that the EOQ wave overran again.",
    entity_profile: {
      customer_name: "Costco Wholesale Corp",
      bp_number: "BP-COST-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 7800 — LA Distribution Hub",
      region: "West",
    },
    impact_metrics: {
      revenue_at_risk: 122_000.00,
      delta_amount: 30_500.00,
      delta_percentage: 25.0,
      sla_priority: "HIGH",
      sla_deadline: "2026-05-08T16:00:00Z",
      affected_lines: 2,
    },
    lines: [
      { line_id: "L1", diagnosis: "2,000 CS ordered, line max 1,500 CS. Excess 500 CS. Trim to ceiling.", resolution: "TRIM", risk: "MEDIUM", waterfall: [] },
      { line_id: "L2", diagnosis: "2,000 CS ordered, line max 1,500 CS. Even-layer SKU — trim to 1,500 CS (5 layers × 300 CS).", resolution: "TRIM", risk: "MEDIUM", waterfall: [] },
    ],
    overmax_analysis: {
      total_ordered: 4_000,
      max_qty: 3_000,
      excess_qty: 1_000,
      exceedance_pct: 33.3,
      uom: "CS",
      at_risk: 30_500.00,
      contract_ref: "CTR-4600060101",
      block_status: "V4080",
      block_reason: "Order quantity exceeds contract maximum — automatic block per SD-OM-001",
      order_lines: [
        { sku: "SKU-COST-EOQ-A", description: "Costco Club-Pack Bundle 36ct", qty: 2_000, max_line_qty: 1_500, excess: 500, is_even_layer_item: false },
        { sku: "SKU-COST-EOQ-B", description: "Costco Club-Pack Bundle 48ct", qty: 2_000, max_line_qty: 1_500, excess: 500, is_even_layer_item: true },
      ],
      trim_plan: [
        { sku: "SKU-COST-EOQ-A", description: "Costco Club-Pack Bundle 36ct", ordered: 2_000, trimmed_to: 1_500, delta: 500, action: "TRIM" },
        { sku: "SKU-COST-EOQ-B", description: "Costco Club-Pack Bundle 48ct", ordered: 2_000, trimmed_to: 1_500, delta: 500, action: "TRIM" },
      ],
      // Server-computed roll-ups (api/schemas.py model_validator).
      trimmed_total: 3_000,
      delta_total: 1_000,
    },
  },

  "exc-031": {
    diagnosis: "Two SKUs on the same Costco EOQ PO arrived with quantities that didn't tile to Costco's club-pack pallet spec (300 CS/pallet, 60 CS/layer). PalletAlignmentRecipe rounded both SKUs down to 1,800 CS / 6 full pallets each. Plan is locked in and waiting on the sibling OVER_MAX decision (exc-030) before SAP write-back fires.",
    confidence: 96,
    risk: "LOW",
    resolution: "PALLET_ALIGN",
    root_cause: "Buyer-side ordering quantum doesn't enforce Costco's own pallet spec. The agent's quanta (1,800 CS) match the OVER_MAX trim ceiling, so when the manager approves exc-030 the pallet plan applies in one VA02 transaction.",
    recommendation: "No action required for the pallet alignment — auto-resolved. Apply the OVER_MAX trim decision on exc-030; the pallet plan will flow through with it.",
    entity_profile: {
      customer_name: "Costco Wholesale Corp",
      bp_number: "BP-COST-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 7800 — LA Distribution Hub",
      region: "West",
    },
    impact_metrics: {
      revenue_at_risk: 122_000.00,
      delta_amount: 520.00,
      delta_percentage: 0.4,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-05-08T16:00:00Z",
      affected_lines: 2,
    },
    lines: [
      { line_id: "L1", diagnosis: "2,000 CS ordered, layer qty 60. 33 full layers = 1,980, 20 loose. Broken layer.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "2,000 CS ordered, layer qty 60. 33 full layers = 1,980, 20 loose. Broken layer.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
    ],
    pallet_analysis: {
      classification: "BROKEN_LAYER",
      total_ordered_cases: 4_000,
      loose_cases_total: 40,
      at_risk_total: 520.00,
      extra_labor_est_hrs: 2.4,
      freight_waste_pct: 1.0,
      order_line_count: 2,
      lines: [
        {
          sku: "SKU-COST-EOQ-A", description: "Costco Club-Pack Bundle 36ct", uom: "CS",
          layer_qty: 60, pallet_qty: 300, ordered_qty: 2_000, complete_layers: 33,
          loose_qty: 20, full_pallets: 6, pallet_fill_pct: 66.7, violation_type: "Broken Layer",
        },
        {
          sku: "SKU-COST-EOQ-B", description: "Costco Club-Pack Bundle 48ct", uom: "CS",
          layer_qty: 60, pallet_qty: 300, ordered_qty: 2_000, complete_layers: 33,
          loose_qty: 20, full_pallets: 6, pallet_fill_pct: 66.7, violation_type: "Broken Layer",
        },
      ],
      suggested_plan: [
        { sku: "SKU-COST-EOQ-A", description: "Costco Club-Pack Bundle 36ct", current: 2_000, suggested: 1_800, delta: -200, layers: 30, full_pallets: 6, reason: "Round down to 6 full pallets (60 CS/layer × 5 layers/pallet × 6 pallets). Aligns with EOQ trim plan." },
        { sku: "SKU-COST-EOQ-B", description: "Costco Club-Pack Bundle 48ct", current: 2_000, suggested: 1_800, delta: -200, layers: 30, full_pallets: 6, reason: "Round down to 6 full pallets. Aligns with EOQ trim plan." },
      ],
    },
  },

  /* ── Case 3 (PO-KR-WK15-2026) — Kroger weekly replenishment bundle.
   *    exc-032  MOQ violation across two SKUs
   *    exc-033  Carrier slip — 5+ days late on the same PO
   * ───────────────────────────────────────────────────────────── */
  "exc-032": {
    diagnosis: "Kroger's WK-15 replenishment PO totals 70 CS across two SKUs, below the 100 CS MOQ for the DSD channel. SAP V4082 applied. One SKU rounds cleanly to MOQ; the other is below 50% and requires a KNMT waiver.",
    confidence: 90,
    risk: "MEDIUM",
    resolution: "ROUND_UP",
    root_cause: "Kroger's WK-15 forecast under-allocated the seasonal kombucha SKUs after a category review. The store-level demand projection cleared MOQ at the chain level but not at our line level.",
    recommendation: "Round SKU-KR-1100 from 50 to 72 CS (full layer). Escalate SKU-KR-1110 (20 CS, 42% of MOQ) for a KNMT-MINBM waiver via category manager.",
    entity_profile: {
      customer_name: "Kroger Co",
      bp_number: "BP-KRG-003",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 5100 — Cincinnati DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 1_960.00,
      delta_amount: 882.00,
      delta_percentage: 45.0,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-05-09T12:00:00Z",
      affected_lines: 2,
    },
    lines: [
      { line_id: "L1", diagnosis: "50 CS ordered, MOQ 48 CS. Within MOQ but breaks pallet layer — round up to 72 CS (24 CS/layer × 3).", resolution: "ROUND_UP", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "20 CS ordered, MOQ 48 CS. Shortfall 28 CS. Below 50% of MOQ — requires KNMT waiver.", resolution: "ESCALATE", risk: "MEDIUM", waterfall: [] },
    ],
    moq_analysis: {
      ordered_qty: 70,
      moq_qty: 100,
      shortfall_qty: 30,
      shortfall_pct: 30.0,
      sku: "SKU-KR-1100",
      description: "Kombucha Variety 6pk",
      unit_cost: 28.00,
      uom: "CS",
      at_risk: 1_960.00,
      moq_source: "KNMT-MINBM",
      channel: "Direct Store Delivery",
      block_message: "Order quantity 70 CS is below minimum order quantity 100 CS for DSD channel. Block V4082 applied per SD-MOQ-001.",
      contract_ref: "CTR-4600022150",
      block_status: "V4082",
      round_up_plan: [
        { sku: "SKU-KR-1100", description: "Kombucha Variety 6pk", ordered: 50, round_up_to: 72, delta: 22, action: "ROUND_UP" },
        { sku: "SKU-KR-1110", description: "Ginger Kombucha 6pk", ordered: 20, round_up_to: 20, delta: 0, action: "ESCALATE" },
      ],
      sap_steps: [
        { step: 1, transaction: "VA02", table: "VBAP", field: "KWMENG", description: "Update order quantity for SKU-KR-1100 from 50 to 72 CS" },
        { step: 2, transaction: "VK11", table: "KONV", field: "KBETR", description: "Apply MOQ round-up pricing tier" },
        { step: 3, transaction: "V.23", table: "VBAK", field: "LIFSK", description: "Release V4082 delivery block after quantity adjustment" },
        { step: 4, transaction: "VA02", table: "VBAP", field: "ABGRU", description: "Set rejection reason on SKU-KR-1110 pending KNMT waiver approval" },
      ],
    },
  },

  "exc-033": {
    diagnosis: "Kroger WK-15 PO was 5 days behind plan after a DHL equipment failure at the Indianapolis cross-dock. DeliveryDelayResolutionRecipe re-routed the load via FedEx Express on the Chicago → Cincinnati direct lane. ETA recovered to within 1 day of plan; freight uplift $480 within the GREEN auto-route tolerance band.",
    confidence: 92,
    risk: "LOW",
    resolution: "ALTERNATE_ROUTING",
    root_cause: "Primary carrier (DHL Ground) equipment failure at the Indianapolis cross-dock on 2026-05-05; the WK-15 replenishment lane funnels through that hub.",
    recommendation: "No action required — auto-resolved. FedEx Express booking confirmed; tracking updated in the carrier portal.",
    entity_profile: {
      customer_name: "Kroger Co",
      bp_number: "BP-KRG-003",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 5100 — Cincinnati DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 1_960.00,
      delta_amount: 480.00,
      delta_percentage: 24.5,
      sla_priority: "HIGH",
      sla_deadline: "2026-05-09T18:00:00Z",
      affected_lines: 2,
    },
    lines: [
      { line_id: "L1", diagnosis: "WK-15 replenishment shipment held at DHL Indianapolis cross-dock. Equipment failure 2026-05-05; recovery ETA 5-7 days.", resolution: "RE-ROUTE", risk: "HIGH", waterfall: [] },
    ],
    delivery_delay_analysis: {
      planned_date: "2026-05-09T00:00:00Z",
      projected_eta: "2026-05-14T00:00:00Z",
      days_late: 5,
      rule_id: "SD-DELAY-002",
      delay_category: "CARRIER_DELAY",
      delay_reason: "DHL Ground equipment failure at Indianapolis cross-dock on 2026-05-05. WK-15 replenishment held on the inbound deck; recovery estimate 5-7 days. SKUs are also under MOQ review on the same case — coordinate routing only after the MOQ adjustment is approved so we don't expedite an under-quantity load.",
      affected_lines: 2,
      at_risk: 1_960.00,
      carrier: "DHL Ground",
      route: "CIN → IND → CIN",
      sla_deadline: "2026-05-09T18:00:00Z",
      alternate_options: [
        {
          id: "opt-1",
          type: "EXPEDITE",
          title: "Re-route via FedEx Express (CHI → CIN direct)",
          description: "Bypass the affected IND cross-dock. ETA 2026-05-10. Freight +$480.",
          new_eta: "2026-05-10T00:00:00Z",
          extra_cost: 480,
          recommended: true,
        },
        {
          id: "opt-2",
          type: "RESCHEDULE",
          title: "Hold for DHL recovery, push delivery 5 days",
          description: "Wait for IND cross-dock to clear backlog. No freight uplift; misses SLA by 5 days.",
          new_eta: "2026-05-14T00:00:00Z",
          extra_cost: 0,
          recommended: false,
        },
        {
          id: "opt-3",
          type: "SPLIT_SHIP",
          title: "Partial pickup ex-Cincinnati DC, balance via DHL when recovered",
          description: "Customer-pickup arrangement for the MOQ-cleared SKU; balance follows once DHL recovers.",
          new_eta: "2026-05-12T00:00:00Z",
          extra_cost: 120,
          recommended: false,
        },
      ],
    },
  },
};

// Presentation hint — stamp `primary_section` so preview mode auto-expands
// the primary comparison delta, mirroring the backend read path
// (api/routes/exceptions.py sets it to the field the primary projection
// lands on). A mock record carries a single primary enrichment field, so
// "first present in precedence order" resolves to that one field; the
// precedence only disambiguates the (mock-absent) multi-field case. Skips
// records that already declare it explicitly and records with no primary
// comparison (e.g. auto-resolved EDI orders).
const PRIMARY_SECTION_KEYS = [
  "price_hold_analysis",
  "edi_mismatch_analysis",
  "price_analysis",
  "duplicate_detection",
  "order_comparison",
  "backorder_analysis",
  "overmax_analysis",
  "moq_analysis",
  "pallet_analysis",
  "delivery_delay_analysis",
] as const;
for (const analysis of Object.values(MOCK_ORDER_ANALYSES)) {
  if (analysis.primary_section) continue;
  const present = PRIMARY_SECTION_KEYS.find(
    (key) => (analysis as unknown as Record<string, unknown>)[key] != null,
  );
  if (present) analysis.primary_section = present;
}
