/**
 * ComplianceHitCountChip tests — ADR-041 P3e §2.3
 * (Compliance reversal condition #3).
 *
 * Verifies the chip's null-on-zero contract (Guardrail #6 — no
 * synthesised "no hits" placeholder), and the SR pluralisation on
 * the aria-label.
 */
import { render, screen } from "@testing-library/react";

import { ComplianceHitCountChip } from "@/components/ui/ComplianceHitCountChip";

describe("ComplianceHitCountChip", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(<ComplianceHitCountChip count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for negative values (defensive)", () => {
    const { container } = render(<ComplianceHitCountChip count={-3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the count text and singular aria-label when count is 1", () => {
    render(<ComplianceHitCountChip count={1} />);
    expect(screen.getByLabelText("1 compliance hit")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders plural aria-label when count > 1", () => {
    render(<ComplianceHitCountChip count={3} />);
    expect(screen.getByLabelText("3 compliance hits")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders an aria-hidden icon (WCAG 1.4.1 — icon paired with text)", () => {
    const { container } = render(<ComplianceHitCountChip count={2} />);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
