/**
 * DuplicateDetectionSection — ADR-032 calibration framing of the detection
 * confidence. The section renders through the canonical ConfidenceDisplay; the
 * `calibrated` flag flows from `confidence_signal`.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { DuplicateDetectionSection } from "@/app/exceptions/DuplicateDetectionSection";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";
import type { DuplicateDetectionData } from "@/types/exceptions";

function fixture(): DuplicateDetectionData {
  const found = Object.values(MOCK_ORDER_ANALYSES).find((a) => a.duplicate_detection);
  if (!found?.duplicate_detection) throw new Error("no duplicate_detection mock");
  return found.duplicate_detection;
}

describe("DuplicateDetectionSection — confidence framing", () => {
  it("frames detection confidence as a model score when calibration is not reported", () => {
    const data: DuplicateDetectionData = { ...fixture(), confidence_signal: null };
    render(<DuplicateDetectionSection data={data} />);
    expect(
      screen.getByLabelText(/detection confidence.*model score/i),
    ).toBeInTheDocument();
  });

  it("frames detection confidence as calibrated when the signal reports it", () => {
    const data: DuplicateDetectionData = {
      ...fixture(),
      confidence_signal: { value: 0.88, calibrated: true },
    };
    render(<DuplicateDetectionSection data={data} />);
    expect(
      screen.getByLabelText(/detection confidence.*calibrated confidence/i),
    ).toBeInTheDocument();
  });
});
