/**
 * ConstraintsPipeline — projector test (issue #133 PO #14).
 *
 * The pipeline is a pure projection of `EmailOrderEntryAnalysisData`.
 * These tests lock the contract that the rendered nodes mirror the
 * input floor_status + validation_failures + classification, and
 * that the aria-label summary stays accurate so screen-reader users
 * recover the meaning the SVG carries visually.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ConstraintsPipeline } from "@/components/ui/ConstraintsPipeline";
import type { EmailOrderEntryAnalysisData } from "@/types/exceptions";

const allGreenFloor: EmailOrderEntryAnalysisData["floor_status"] = {
  sender_authorized: true,
  customer_resolved: true,
  duplicate_po_clear: true,
  credit_clear: true,
};

function mockData(
  over: Partial<EmailOrderEntryAnalysisData> = {},
): EmailOrderEntryAnalysisData {
  return {
    classification: "ONE_CLICK_APPROVE",
    composite_confidence: 0.95,
    floor_status: allGreenFloor,
    floor_breaches: [],
    validation_failures: [],
    recommended_action: "ONE_CLICK_APPROVE",
    autonomy_level: "L3",
    notification_template: null,
    reject_reason_code: null,
    ...over,
  };
}

describe("ConstraintsPipeline", () => {
  it("aria-label summarises pass count and classification", () => {
    render(<ConstraintsPipeline data={mockData()} />);
    const svg = screen.getByRole("img");
    // All four floor checks plus the validations gate = 5 gates;
    // every one passed in the clean case.
    expect(svg).toHaveAccessibleName(
      /5 of 5 gates passed; classification One-click approve/i,
    );
  });

  it("breached floor check surfaces as 'fail' in the screen-reader list", () => {
    render(
      <ConstraintsPipeline
        data={mockData({
          floor_status: { ...allGreenFloor, credit_clear: false },
          classification: "FATAL_REJECT",
        })}
      />,
    );
    const list = screen.getByText("Credit:", { exact: false }).closest("li")!;
    expect(within(list).getByText(/breached/i)).toBeInTheDocument();
    // Pass count drops: 3 floor gates + clean validations = 4 of 5.
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /4 of 5 gates passed; classification Fatal reject/i,
    );
  });

  it("validation failures collapse to a single warning node with count", () => {
    const { rerender } = render(
      <ConstraintsPipeline
        data={mockData({ validation_failures: ["BAD_SHIP_TO", "MISSING_UOM"] })}
      />,
    );
    expect(screen.getByText("2 issues")).toBeInTheDocument();
    // One issue = "1 issue" not "1 issues" — rerender in place so we
    // assert against a single mounted tree.
    rerender(
      <ConstraintsPipeline
        data={mockData({ validation_failures: ["BAD_SHIP_TO"] })}
      />,
    );
    expect(screen.getByText("1 issue")).toBeInTheDocument();
  });

  it("unknown classification falls back to the raw token", () => {
    render(
      <ConstraintsPipeline
        data={
          mockData({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            classification: "MYSTERY_BAND" as any,
          })
        }
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/classification MYSTERY_BAND/);
  });
});
