/**
 * OverMaxSection tests.
 *
 * Regression (V&V audit 2026-06-06): `OverMaxLine.max_line_qty` mirrors the
 * backend contract `api/schemas.py::OverMaxLine.max_line_qty =
 * Optional[float] = None` — the OMS does not always carry a per-line cap, so
 * the wire value can be `null`. The per-line table rendered
 * `line.max_line_qty.toLocaleString()` unguarded, which throws
 * `TypeError: Cannot read properties of null` and blanks the entire
 * exception detail surface. The UI type also wrongly declared the field
 * non-null, hiding the hazard from the type checker.
 *
 * These cases lock both halves: a present cap formats normally, and an
 * absent cap renders a placeholder instead of crashing.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverMaxSection } from "@/app/exceptions/OverMaxSection";
import type { OverMaxAnalysisData, OverMaxLine } from "@/types/exceptions";

/** The per-line table is behind a collapsed "Order Lines" disclosure. */
function expandOrderLines() {
  fireEvent.click(screen.getByRole("button", { name: /Order Lines/i }));
}

function makeData(
  line: Partial<OverMaxLine>,
  totals?: { trimmed_total?: number; delta_total?: number },
): OverMaxAnalysisData {
  return {
    total_ordered: 1200,
    max_qty: 1000,
    excess_qty: 200,
    exceedance_pct: 20,
    uom: "EA",
    at_risk: 5000,
    order_lines: [
      {
        sku: "SKU-7800",
        description: "Pallet widget",
        qty: 1200,
        max_line_qty: 1000,
        excess: 200,
        is_even_layer_item: false,
        ...line,
      },
    ],
    trim_plan: [
      {
        sku: "SKU-7800",
        description: "Pallet widget",
        ordered: 1200,
        trimmed_to: 1000,
        delta: 200,
        action: "TRIM",
      },
    ],
    // Server-computed roll-ups (the section renders these, not a UI reduce).
    trimmed_total: totals?.trimmed_total ?? 1000,
    delta_total: totals?.delta_total ?? 200,
  };
}

describe("OverMaxSection", () => {
  it("formats a present per-line cap", () => {
    render(<OverMaxSection data={makeData({ max_line_qty: 1234 })} />);
    expandOrderLines();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("does not crash when max_line_qty is null (backend Optional[float])", () => {
    // The backend legitimately emits null for a line with no per-line cap.
    // Now routed through EvidenceBlock (structural omission — renders nothing,
    // no ad-hoc "—"), so the line still renders without crashing.
    render(<OverMaxSection data={makeData({ max_line_qty: null })} />);
    expect(() => expandOrderLines()).not.toThrow();
    expect(screen.getAllByText("SKU-7800").length).toBeGreaterThan(0);
  });

  // REGRESSION (fails on parent): the TOTAL row derived its figures with a
  // client-side `reduce` over trim_plan (Guardrail #6 — audit totals must come
  // from the backend). The section now renders the server-computed
  // trimmed_total / delta_total. Distinct-from-sum values prove the field is
  // the source, not the reduce.
  it("renders the backend-computed trim totals, not a UI reduce", () => {
    render(
      <OverMaxSection
        data={makeData({}, { trimmed_total: 777, delta_total: 42 })}
      />,
    );
    // trimmed_total in the "Trim To" total cell (distinct from the per-line
    // trimmed_to=1,000, so this can only come from the backend field)…
    expect(screen.getByText("777")).toBeInTheDocument();
    // …and delta_total in the "Delta" total cell (rendered as "-42", distinct
    // from the per-line delta of -200).
    expect(screen.getByText("-42")).toBeInTheDocument();
  });
});
