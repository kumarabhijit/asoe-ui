/**
 * EdiMismatchSection tests — sub_type / classification matrix.
 *
 * Eight cases (per plan §Tests Layer 2):
 *   1-4. One per accepted sub_type (SKU / QTY / UOM / SHIP_TO),
 *        rendering the verbatim sub_type label.
 *   5-7. One per classification (HARD_REJECT / REVIEW / ESCALATE)
 *        rendering the badge label.
 *   8.   `expected_value` / `received_value` shape matrix — string,
 *        number, and object shapes all render via `renderUnknown`.
 */
import { render, screen } from "@testing-library/react";
import { EdiMismatchSection } from "@/app/exceptions/EdiMismatchSection";
import type { EdiMismatchAnalysisData } from "@/types/exceptions";

const base: EdiMismatchAnalysisData = {
  sub_type: "SKU_MISMATCH",
  classification: "HARD_REJECT",
  recommended_action: "BLOCK_AND_NOTIFY",
  autonomy_level: "L3",
  expected_value: "SKU-001",
  received_value: "SKU-002",
  notification_template: "edi_line_mismatch_blocked",
};

describe("EdiMismatchSection", () => {
  describe("sub_type rendering (verbatim)", () => {
    it("SKU_MISMATCH appears in the sub_type badge", () => {
      render(<EdiMismatchSection data={{ ...base, sub_type: "SKU_MISMATCH" }} />);
      expect(screen.getByText("SKU_MISMATCH")).toBeInTheDocument();
    });

    it("QTY_MISMATCH appears in the sub_type badge", () => {
      render(
        <EdiMismatchSection
          data={{ ...base, sub_type: "QTY_MISMATCH", classification: "REVIEW", expected_value: 10, received_value: 12 }}
        />,
      );
      expect(screen.getByText("QTY_MISMATCH")).toBeInTheDocument();
    });

    it("UOM_MISMATCH appears in the sub_type badge", () => {
      render(
        <EdiMismatchSection
          data={{ ...base, sub_type: "UOM_MISMATCH", classification: "REVIEW", expected_value: "EA", received_value: "CS" }}
        />,
      );
      expect(screen.getByText("UOM_MISMATCH")).toBeInTheDocument();
    });

    it("SHIP_TO_MISMATCH appears in the sub_type badge", () => {
      render(
        <EdiMismatchSection
          data={{ ...base, sub_type: "SHIP_TO_MISMATCH", classification: "ESCALATE", autonomy_level: "L1" }}
        />,
      );
      expect(screen.getByText("SHIP_TO_MISMATCH")).toBeInTheDocument();
    });
  });

  describe("classification badge", () => {
    it("HARD_REJECT renders 'Hard reject'", () => {
      render(<EdiMismatchSection data={{ ...base, classification: "HARD_REJECT" }} />);
      expect(screen.getByText(/Hard reject/i)).toBeInTheDocument();
    });

    it("REVIEW renders 'Review required'", () => {
      render(<EdiMismatchSection data={{ ...base, classification: "REVIEW" }} />);
      expect(screen.getByText(/Review required/i)).toBeInTheDocument();
    });

    it("ESCALATE renders 'Escalate'", () => {
      render(<EdiMismatchSection data={{ ...base, classification: "ESCALATE", notification_template: null }} />);
      expect(screen.getAllByText(/Escalate/i).length).toBeGreaterThan(0);
    });
  });

  describe("unknown-value shape matrix", () => {
    it("renders string, number, and object expected/received values", () => {
      // Object value coerces via JSON.stringify
      const objVal = { country: "US", region: "NW" };
      render(
        <EdiMismatchSection
          data={{
            ...base,
            sub_type: "SHIP_TO_MISMATCH",
            classification: "ESCALATE",
            expected_value: objVal,
            received_value: 42,
          }}
        />,
      );
      expect(screen.getByText(JSON.stringify(objVal))).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });
});
