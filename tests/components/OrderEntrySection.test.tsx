/**
 * OrderEntrySection — render / data-presence behaviour (ADR-042 Phase 3).
 * Dumb projector for the extracted order form. Optional fields + validation
 * flags flow through <EvidenceBlock> (shown when present, suppressed when
 * absent) — no ad-hoc placeholders (Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { OrderEntrySection } from "@/app/exceptions/OrderEntrySection";
import type { OrderEntryExtraction } from "@/types/exceptions";

const FULL: OrderEntryExtraction = {
  source_type: "PDF",
  confidence: 0.94,
  header: { customer_po: "0093847612", requested_date: "2025-03-17" },
  customer_name: "Walmart Stores Inc",
  customer_bp: "300001",
  line_items: [
    { line_num: "001", material: "BEV-COLA-12PK", quantity: 480, uom: "CS", unit_price: 8.64, mdm_matched: true },
  ],
  validation_flags: [
    { field: "line 003", severity: "WARNING", message: "promo allowance" },
  ],
};

const MINIMAL: OrderEntryExtraction = {
  source_type: "EMAIL_BODY",
  confidence: 0.8,
  header: {},
  line_items: [{ line_num: "1", material: "SKU-X", quantity: 10 }],
  validation_flags: [],
};

describe("OrderEntrySection", () => {
  it("renders source/confidence, header, customer, and line items", () => {
    render(<OrderEntrySection data={FULL} />);
    expect(screen.getByText(/PDF · 94%/)).toBeInTheDocument();
    expect(screen.getByText("0093847612")).toBeInTheDocument();
    expect(screen.getByText("Walmart Stores Inc")).toBeInTheDocument();
    expect(screen.getByText("BEV-COLA-12PK")).toBeInTheDocument();
    expect(screen.getByText("$8.64")).toBeInTheDocument();
    expect(screen.getByText(/line 003: promo allowance/)).toBeInTheDocument();
  });

  it("suppresses absent header/customer/validation (no placeholder)", () => {
    render(<OrderEntrySection data={MINIMAL} />);
    expect(screen.getByText("SKU-X")).toBeInTheDocument();
    expect(screen.queryByText(/Customer PO/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Customer$/)).not.toBeInTheDocument();
    // No unit price for the minimal line → no $ rendered.
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
