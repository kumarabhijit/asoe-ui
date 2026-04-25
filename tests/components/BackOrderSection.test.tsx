/**
 * BackOrderSection — EvidenceBlock + useConditionalField adoption.
 *
 * The four registry-conditional fields
 * (`alternate_warehouses`, `substitutes`, `production`,
 * `inbound_po`) collapse to "Context Not Required for Resolution"
 * post-disposition when their `depends_on` predicate fails
 * (e.g. `resolved_action == ALT_DC` is false), and render their
 * data otherwise. Pre-disposition (operator hasn't picked an
 * action) every block is decision-evidence — present data renders.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackOrderSection } from "@/app/exceptions/BackOrderSection";
import type { BackOrderAnalysisData } from "@/types/exceptions";

const baseData: BackOrderAnalysisData = {
  ordered_qty: 100,
  available_qty: 50,
  gap_qty: 50,
  gap_pct: 50,
  unit_price: 10,
  uom: "CS",
  at_risk: 500,
  atp_date: "2026-04-30",
  primary_dc: { plant: "DC-EAST", name: "East DC", region: "US-EAST", qty: 50 },
  alternate_warehouses: [
    {
      plant: "DC-WEST", name: "West DC", region: "US-WEST", qty: 200,
      eta_days: 4, freight_delta_per_unit: 0.5, freight_delta_total: 25,
    },
  ],
  substitutes: [
    {
      sku: "SKU-ALT-1", description: "Equivalent SKU",
      available_qty: 150, price_delta_pct: 2, acceptance_rate: 0.85,
      source: "catalog", priority: 1,
    },
  ],
  production: { qty: 100, date: "2026-05-05" },
  inbound_po: { qty: 75, eta: "2026-05-02", po_num: "PO-INB-1" },
  resolution_options: [],
};

describe("BackOrderSection — registry-conditional rendering", () => {
  describe("pre-disposition (resolved_action absent)", () => {
    it("renders all conditional blocks when their data is present (decision-evidence mode)", () => {
      render(<BackOrderSection data={baseData} />);
      // alternate warehouses
      expect(screen.getByText("West DC")).toBeInTheDocument();
      // substitutes
      expect(screen.getByText("SKU-ALT-1")).toBeInTheDocument();
      // production
      expect(screen.getByText(/Production/i)).toBeInTheDocument();
      // inbound po
      expect(screen.getByText("PO-INB-1")).toBeInTheDocument();
      // No "Context Not Required" placeholders pre-disposition.
      expect(screen.queryAllByText(/Context Not Required/i)).toHaveLength(0);
    });
  });

  describe("post-disposition resolved_action == ALT_DC", () => {
    it("renders alternate_warehouses; collapses substitutes / production / inbound_po", () => {
      render(<BackOrderSection data={baseData} resolvedAction="ALT_DC" />);
      expect(screen.getByText("West DC")).toBeInTheDocument();
      expect(screen.queryByText("SKU-ALT-1")).toBeNull();
      expect(screen.queryByText(/Production/i)).toBeNull();
      expect(screen.queryByText("PO-INB-1")).toBeNull();
      // Three "Context Not Required" placeholders for the three
      // non-matching conditional fields.
      expect(screen.queryAllByText(/Context Not Required/i)).toHaveLength(3);
    });
  });

  describe("post-disposition resolved_action == SUBSTITUTE", () => {
    it("renders substitutes; collapses the other three", () => {
      render(<BackOrderSection data={baseData} resolvedAction="SUBSTITUTE" />);
      expect(screen.getByText("SKU-ALT-1")).toBeInTheDocument();
      expect(screen.queryByText("West DC")).toBeNull();
      expect(screen.queryByText("PO-INB-1")).toBeNull();
      expect(screen.queryAllByText(/Context Not Required/i)).toHaveLength(3);
    });
  });

  describe("post-disposition resolved_action == RESCHEDULE", () => {
    it("renders production + inbound_po; collapses alternate_warehouses + substitutes", () => {
      render(<BackOrderSection data={baseData} resolvedAction="RESCHEDULE" />);
      expect(screen.getByText(/Production/i)).toBeInTheDocument();
      expect(screen.getByText("PO-INB-1")).toBeInTheDocument();
      expect(screen.queryByText("West DC")).toBeNull();
      expect(screen.queryByText("SKU-ALT-1")).toBeNull();
      // Two placeholders (alternate_warehouses + substitutes).
      expect(screen.queryAllByText(/Context Not Required/i)).toHaveLength(2);
    });
  });

  describe("post-disposition resolved_action == SPLIT_SHIPMENT (no conditional matches)", () => {
    it("collapses all four conditional blocks", () => {
      render(<BackOrderSection data={baseData} resolvedAction="SPLIT_SHIPMENT" />);
      expect(screen.queryByText("West DC")).toBeNull();
      expect(screen.queryByText("SKU-ALT-1")).toBeNull();
      expect(screen.queryByText(/Production/i)).toBeNull();
      expect(screen.queryByText("PO-INB-1")).toBeNull();
      expect(screen.queryAllByText(/Context Not Required/i)).toHaveLength(4);
    });
  });

  describe("structural omission (no conditional data)", () => {
    it("renders nothing for absent conditional fields pre-disposition (no placeholder)", () => {
      const sparse: BackOrderAnalysisData = {
        ...baseData,
        alternate_warehouses: [],
        substitutes: [],
        production: undefined,
        inbound_po: undefined,
      };
      render(<BackOrderSection data={sparse} />);
      // Pre-disposition: predicate effectively holds; absent value
      // → structural omission. NO placeholder, NO data.
      expect(screen.queryAllByText(/Context Not Required/i)).toHaveLength(0);
      // The audit-bearing primary_dc still renders.
      expect(screen.getByText("East DC")).toBeInTheDocument();
    });
  });
});
