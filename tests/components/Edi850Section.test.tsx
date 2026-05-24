/**
 * Edi850Section — render / sub-view behaviour (ADR-042 Phase 5).
 * Dumb projector for the deterministically built X12 850. Three sub-views
 * (Decoded / Raw X12 / Segment Map) switch via local presentation state.
 * Optional fields flow through <EvidenceBlock> — no ad-hoc placeholders
 * (Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Edi850Section } from "@/app/exceptions/Edi850Section";
import type { Edi850Document } from "@/types/exceptions";

const DOC: Edi850Document = {
  standard: "ANSI X12 5010",
  transaction_set: "850",
  envelope: {
    sender_id: "300001",
    receiver_id: "VENDOR-7788",
    interchange_control_number: "000012345",
    group_control_number: "12345",
    transaction_set_control_number: "0001",
    usage_indicator: "P",
    x12_version: "005010",
  },
  header: {
    purpose_code: "00",
    po_type: "SA",
    po_number: "0093847612",
    po_date: "2025-03-17",
    currency: "USD",
    requested_delivery_date: "2025-03-24",
  },
  parties: [
    { entity_code: "BY", role: "Buying Party (Purchaser)", name: "Walmart Stores Inc", id_qualifier: "92", id_value: "300001" },
    { entity_code: "SE", role: "Selling Party", name: "Acme Beverages Co", id_qualifier: "92", id_value: "VENDOR-7788" },
  ],
  line_items: [
    { line_num: "001", quantity: 480, uom: "CS", unit_price: 8.64, product_qualifier: "VP", product_id: "BEV-COLA-12PK", description: "Cola 12-pack case", extended_amount: 4147.2 },
  ],
  totals: { total_line_items: 1, total_quantity: 480, total_amount: 4147.2 },
  segments: [
    { seg_id: "ISA", elements: [], raw: "ISA*00*~", meaning: "Interchange Control Header", group: "envelope" },
    { seg_id: "BEG", elements: [], raw: "BEG*00*SA*0093847612~", meaning: "Beginning Segment for Purchase Order", group: "header" },
    { seg_id: "PO1", elements: [], raw: "PO1*001*480*CS~", meaning: "Baseline Item Data", group: "line" },
  ],
  raw_x12: "ISA*00*~\nBEG*00*SA*0093847612~\nPO1*001*480*CS~",
};

const EMPTY_LINES: Edi850Document = {
  ...DOC,
  line_items: [],
  totals: { total_line_items: 0, total_quantity: 0, total_amount: null },
};

describe("Edi850Section", () => {
  it("decoded view renders envelope, header, parties, lines, totals", () => {
    render(<Edi850Section data={DOC} />);
    expect(screen.getByText(/ANSI X12 5010 · 850/)).toBeInTheDocument();
    expect(screen.getByText("0093847612")).toBeInTheDocument();
    expect(screen.getByText("Walmart Stores Inc")).toBeInTheDocument();
    expect(screen.getByText("BEV-COLA-12PK")).toBeInTheDocument();
    expect(screen.getByText("$8.64")).toBeInTheDocument();
    // extended_amount (line) + total_amount (CTT) both render the same figure.
    expect(screen.getAllByText("$4,147.20")).toHaveLength(2);
  });

  it("switches to Raw X12 and Segment Map sub-views", () => {
    render(<Edi850Section data={DOC} />);
    fireEvent.click(screen.getByRole("tab", { name: /Raw X12/ }));
    expect(screen.getByLabelText("Raw X12 segments")).toBeInTheDocument();
    expect(screen.getByText("BEG*00*SA*0093847612~")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Segment Map/ }));
    expect(screen.getByText("Baseline Item Data")).toBeInTheDocument();
    expect(screen.getByText("Beginning Segment for Purchase Order")).toBeInTheDocument();
  });

  it("suppresses total amount and shows no-line message when absent", () => {
    render(<Edi850Section data={EMPTY_LINES} />);
    expect(screen.getByText("No line items.")).toBeInTheDocument();
    // total_amount null → no $ figure in the totals card.
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
