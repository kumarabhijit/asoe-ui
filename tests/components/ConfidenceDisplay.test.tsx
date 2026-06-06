/**
 * ConfidenceDisplay — calibration honesty must be VISIBLE, not aria-only.
 *
 * Regression for the 2026-06 rendered-experience audit: the "model score /
 * not a calibrated probability" caveat was previously only in the aria-label
 * on the `bar` / `inline` variants, so a sighted operator saw a confident
 * "98% High" chip with no visible honesty cue. These assertions query the
 * VISIBLE text (getByText), so they fail on the aria-only parent.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ConfidenceDisplay } from "@/components/ui/ConfidenceDisplay";

describe("ConfidenceDisplay — visible calibration cue", () => {
  it("bar variant shows the model-score caveat as visible text (uncalibrated)", () => {
    render(<ConfidenceDisplay value={0.98} variant="bar" />);
    expect(screen.getByText(/not a calibrated probability/i)).toBeInTheDocument();
  });

  it("inline variant shows a visible 'model score' cue (uncalibrated)", () => {
    render(<ConfidenceDisplay value={0.98} variant="inline" />);
    expect(screen.getByText(/^model score$/i)).toBeInTheDocument();
  });

  it("shows a visible 'calibrated' cue when the backend reports calibration", () => {
    render(<ConfidenceDisplay value={0.98} variant="inline" calibrated />);
    expect(screen.getByText(/^calibrated$/i)).toBeInTheDocument();
  });

  it("prominent variant keeps its visible caveat", () => {
    render(<ConfidenceDisplay value={0.88} variant="prominent" />);
    expect(screen.getByText(/calibration not reported/i)).toBeInTheDocument();
  });
});
