/**
 * Component-level axe sweep (L2) for the ADR-042 Customer-Inbox sections
 * (Phases 3–7). Each section is a SOX-evidence projector an operator reads to
 * authorise a financially-binding decision, so each canonical render-state must
 * be axe-clean. Phase 8 hardening — closes the accessibility-sweep gap for the
 * sections added in Phases 3–7.
 */
import * as React from "react";
import { render, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ThemeProvider } from "next-themes";
import { describe, it, expect } from "vitest";

import { OrderEntrySection } from "@/app/exceptions/OrderEntrySection";
import { Edi850Section } from "@/app/exceptions/Edi850Section";
import { ChangeAnalysisSection } from "@/app/exceptions/ChangeAnalysisSection";
import { KnowledgeGraphSection } from "@/app/exceptions/KnowledgeGraphSection";
import { DraftReplySection } from "@/app/exceptions/DraftReplySection";
import type {
  ChangeAnalysis,
  DraftReply,
  Edi850Document,
  KnowledgeGraphPayload,
  OrderEntryExtraction,
} from "@/types/exceptions";

function withTheme(node: React.ReactNode) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {node}
    </ThemeProvider>
  );
}

async function expectNoViolations(node: React.ReactElement) {
  const { container } = render(withTheme(node));
  await act(async () => {});
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

const ORDER_ENTRY: OrderEntryExtraction = {
  source_type: "PDF",
  confidence: 0.94,
  header: { customer_po: "0093847612", requested_date: "2025-03-17" },
  customer_name: "Walmart Stores Inc",
  customer_bp: "300001",
  line_items: [
    { line_num: "001", material: "BEV-COLA-12PK", quantity: 480, uom: "CS", unit_price: 8.64, mdm_matched: true },
  ],
  validation_flags: [{ field: "line 001", severity: "INFO", message: "matched" }],
};

const EDI: Edi850Document = {
  standard: "ANSI X12 5010",
  transaction_set: "850",
  envelope: { sender_id: "300001", receiver_id: "VENDOR-7788", interchange_control_number: "000012345", group_control_number: "12345", transaction_set_control_number: "0001", usage_indicator: "P", x12_version: "005010" },
  header: { purpose_code: "00", po_type: "SA", po_number: "0093847612", po_date: "2025-03-17", currency: "USD", requested_delivery_date: "2025-03-24" },
  parties: [{ entity_code: "BY", role: "Buying Party (Purchaser)", name: "Walmart Stores Inc", id_qualifier: "92", id_value: "300001" }],
  line_items: [{ line_num: "001", quantity: 480, uom: "CS", unit_price: 8.64, product_qualifier: "VP", product_id: "BEV-COLA-12PK", description: "Cola 12-pack", extended_amount: 4147.2 }],
  totals: { total_line_items: 1, total_quantity: 480, total_amount: 4147.2 },
  segments: [{ seg_id: "ISA", elements: [], raw: "ISA*00*~", meaning: "Interchange Control Header", group: "envelope" }],
  raw_x12: "ISA*00*~",
};

const CHANGE: ChangeAnalysis = {
  evaluation: {
    lifecycle_stages: ["Created", "Confirmed", "Released", "Picked", "Shipped"],
    lifecycle_index: 2,
    change_items: [{ field: "quantity", from_value: "480", to_value: "600" }],
    checks: [
      { name: "Inventory", status: "WARNING", detail: "ATP short", metric: "ATP 520 vs 600", agent: "Inventory Agent", system_ref: "SAP MM/ATP" },
      { name: "Financial", status: "CONDITIONAL", detail: "Cosign", metric: "$45,200.00", agent: "Finance Agent", system_ref: "SAP FI/CO" },
    ],
    pass_count: 0, conditional_count: 1, warning_count: 1,
  },
  scenarios: [
    { name: "Approve as requested", description: "Apply as-is.", recommended: false, impact: "warning", financial_delta_usd: 0 },
    { name: "Partial fulfilment", description: "Ship available now.", recommended: true, impact: "protects date", financial_delta_usd: -11300 },
  ],
  decision: { recommended_action: "Partial fulfilment", confidence: 0.65, rationale: "Warning present.", revenue_impact_usd: 45200, requires_cosign: true, sap_actions: ["VA02: update sales order"] },
};

const GRAPH: KnowledgeGraphPayload = {
  root_id: "order:po1",
  nodes: [
    { id: "order:po1", label: "PO-1", kind: "order", detail: "Sales order" },
    { id: "customer:300001", label: "Walmart Stores Inc", kind: "customer", detail: "BP 300001" },
    { id: "material:cola", label: "BEV-COLA-12PK", kind: "material", detail: "480 CS" },
  ],
  edges: [
    { source: "customer:300001", target: "order:po1", relation: "places" },
    { source: "order:po1", target: "material:cola", relation: "contains" },
  ],
};

const DRAFT: DraftReply = {
  status: "DRAFTED",
  reason: null,
  template_name: "clarify_po",
  recipient: "buyer@walmart.example",
  subject: "Re: PO 0093847612",
  body: "Hello, could you confirm the requested quantity?",
  edits_applied: [{ field: "subject", before: "Re: PO", after: "Re: PO 0093847612" }],
  drafted_by: "analyst-1",
  drafted_at: "2026-05-24T10:00:00Z",
};

describe("a11y sweep: ADR-042 inbox sections", () => {
  it("OrderEntrySection", async () => expectNoViolations(<OrderEntrySection data={ORDER_ENTRY} />));
  it("Edi850Section", async () => expectNoViolations(<Edi850Section data={EDI} />));
  it("ChangeAnalysisSection", async () => expectNoViolations(<ChangeAnalysisSection data={CHANGE} />));
  it("KnowledgeGraphSection", async () => expectNoViolations(<KnowledgeGraphSection data={GRAPH} />));
  it("DraftReplySection (DRAFTED)", async () => expectNoViolations(<DraftReplySection data={DRAFT} />));
  it("DraftReplySection (REJECTED)", async () =>
    expectNoViolations(
      <DraftReplySection
        data={{ status: "REJECTED", reason: "No recipient on file", template_name: null, recipient: null, subject: null, body: null, edits_applied: [], drafted_by: null, drafted_at: null }}
      />,
    ));
});
