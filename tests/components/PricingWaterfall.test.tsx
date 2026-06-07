/**
 * PricingWaterfall — signed-money rendering (UX audit T3) + presence guards.
 *
 * The component visualises a line item's price build-up (BASE → CONTRACT → TPR
 * → UOM → RESULT). Adjustment steps are signed deltas; BASE/RESULT are
 * magnitudes that may still be negative (a net-credit RESULT). The sign must
 * always be textual, never colour-only.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingWaterfall } from "@/components/ui/PricingWaterfall";
import type { PricingWaterfallStep } from "@/types/exceptions";

function step(over: Partial<PricingWaterfallStep> = {}): PricingWaterfallStep {
  return {
    type: "CONTRACT",
    label: "Contract price",
    record: "K005",
    value: 1.0,
    running: 11.0,
    ...over,
  };
}

describe("PricingWaterfall — signed money (T3)", () => {
  // REGRESSION (fails on parent): the local fmtPrice used Math.abs, so a
  // negative adjustment (a discount) rendered as "$3.50" amber — direction
  // by colour only. It must now show "-$3.50".
  it("renders a negative adjustment delta with an explicit minus sign", () => {
    render(
      <PricingWaterfall
        steps={[step({ type: "TPR", label: "Promo markdown", value: -3.5, running: 7.5 })]}
      />,
    );
    expect(screen.getByText("-$3.50")).toBeInTheDocument();
  });

  it("prefixes a positive adjustment delta with a plus sign", () => {
    render(
      <PricingWaterfall steps={[step({ type: "CONTRACT", value: 2, running: 12 })]} />,
    );
    expect(screen.getByText("+$2.00")).toBeInTheDocument();
  });

  // REGRESSION (fails on parent): a negative RESULT (net credit) was forced
  // through Math.abs (and green), hiding the sign entirely.
  it("keeps the minus on a negative RESULT (net credit), without a forced +", () => {
    render(
      <PricingWaterfall
        steps={[step({ type: "RESULT", label: "Net", value: -1.25, running: null })]}
      />,
    );
    expect(screen.getByText("-$1.25")).toBeInTheDocument();
  });

  it("does not prefix BASE (a magnitude) with a plus", () => {
    render(
      <PricingWaterfall
        steps={[step({ type: "BASE", label: "List", value: 10, running: null })]}
      />,
    );
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.queryByText("+$10.00")).not.toBeInTheDocument();
  });

  // REGRESSION (fails on parent): step.record was rendered unconditionally,
  // producing an empty <code> chip when absent.
  it("renders no record chip when the step has no record", () => {
    const { container } = render(
      <PricingWaterfall
        steps={[step({ record: undefined, value: 1, running: 1 })]}
      />,
    );
    expect(container.querySelector("code")).toBeNull();
  });
});
