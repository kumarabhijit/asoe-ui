/**
 * PriceHoldSection tests — branch coverage per recipe action.
 *
 * Five cases (per plan §Tests Layer 2):
 *   1. AUTO_RELEASE branch (GREEN)
 *   2. ESCALATE branch (YELLOW)
 *   3. HARD_BLOCK branch (RED)
 *   4. variance formatting (signed fraction → percent with explicit sign)
 *   5. data-presence invariant: passing no `data` prop is impossible
 *      (TypeScript blocks it), but mounting via the data-presence pattern
 *      is verified — section renders only when its analysis field is set.
 */
import { render, screen } from "@testing-library/react";
import { PriceHoldSection } from "@/app/exceptions/PriceHoldSection";
import type { PriceHoldAnalysisData } from "@/types/exceptions";

const baseData: PriceHoldAnalysisData = {
  hold_status: "HELD",
  po_price: 105,
  sap_base_price: 100,
  variance_pct: 0.05,
  tolerance_pct: 0.02,
  hard_block_pct: 0.10,
  action: "ESCALATE",
  reason: "Variance 0.0500 above tolerance 0.0200; manual review required.",
};

describe("PriceHoldSection", () => {
  describe("recipe action branches", () => {
    it("AUTO_RELEASE renders the success badge label", () => {
      render(
        <PriceHoldSection
          data={{ ...baseData, action: "AUTO_RELEASE", variance_pct: 0.01, po_price: 101 }}
        />,
      );
      expect(screen.getAllByText(/Auto-release/).length).toBeGreaterThan(0);
    });

    it("ESCALATE renders the warning badge label", () => {
      render(<PriceHoldSection data={{ ...baseData, action: "ESCALATE" }} />);
      expect(screen.getAllByText(/Escalate/).length).toBeGreaterThan(0);
    });

    it("HARD_BLOCK renders the error badge label", () => {
      render(
        <PriceHoldSection
          data={{ ...baseData, action: "HARD_BLOCK", variance_pct: 0.15, po_price: 115 }}
        />,
      );
      expect(screen.getAllByText(/Hard block/).length).toBeGreaterThan(0);
    });
  });

  describe("variance formatting", () => {
    it("renders positive variance with + sign and one decimal", () => {
      render(<PriceHoldSection data={{ ...baseData, variance_pct: 0.05 }} />);
      expect(screen.getByText("+5.0%")).toBeInTheDocument();
    });

    it("renders negative variance with − sign and one decimal", () => {
      render(<PriceHoldSection data={{ ...baseData, variance_pct: -0.034 }} />);
      // toFixed(1) of -3.4 → "-3.4"; the sign comes from toFixed itself
      expect(screen.getByText("-3.4%")).toBeInTheDocument();
    });

    it("renders tolerance threshold as a percentage", () => {
      render(<PriceHoldSection data={{ ...baseData, tolerance_pct: 0.02 }} />);
      // Expect to find "+2.0%" somewhere (could overlap with variance, so
      // use getAllByText)
      expect(screen.getAllByText("+2.0%").length).toBeGreaterThan(0);
    });
  });

  describe("data presence", () => {
    it("renders the section header when data is present", () => {
      render(<PriceHoldSection data={baseData} />);
      expect(screen.getByText("Price Hold Analysis")).toBeInTheDocument();
      expect(screen.getByText("Hold Status")).toBeInTheDocument();
    });

    it("displays the recipe name in the footer for traceability", () => {
      render(<PriceHoldSection data={baseData} />);
      expect(screen.getByText("PriceHoldReleaseRecipe.py")).toBeInTheDocument();
    });

    it("renders an unknown action with the neutral fallback rather than crashing (CLAUDE.md Guardrail #1)", () => {
      // Simulate a forward-compat scenario where asoe2 shipped a new
      // PriceHoldAction literal (e.g. MANUAL_RELEASE) that the UI
      // bundle doesn't know about yet. The render must not throw —
      // mirrors the Badge.tsx::verdictVariant() default-fallback
      // pattern.
      const newAction = "MANUAL_RELEASE" as PriceHoldAnalysisData["action"];
      expect(() =>
        render(<PriceHoldSection data={{ ...baseData, action: newAction }} />),
      ).not.toThrow();
      expect(screen.getAllByText("MANUAL_RELEASE").length).toBeGreaterThan(0);
    });
  });
});
