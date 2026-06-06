/**
 * ReviewQualityPanel — renders the real automation-bias SLIs and stays honest
 * about the surfaces that have no data source yet.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReviewQualityPanel } from "@/components/ui/ReviewQualityPanel";
import type { ReviewerActivitySnapshot } from "@/lib/api";

const BASE: ReviewerActivitySnapshot = {
  scope: "process_local_since_restart",
  decisions: 100,
  layer2_opened: 70,
  layer2_open_rate: 0.7,
  dwell_seconds_histogram: [
    { le_seconds: 1, count: 10 },
    { le_seconds: 5, count: 40 },
    { le_seconds: null, count: 100 },
  ],
  dwell_seconds_sum: 1234,
  by_highlight: {
    shown: { decisions: 50, layer2_open_rate: 0.8 },
    not_shown: { decisions: 50, layer2_open_rate: 0.6 },
  },
};

describe("ReviewQualityPanel", () => {
  it("renders the real scrutiny SLIs", () => {
    render(<ReviewQualityPanel data={BASE} />);
    expect(screen.getByText("70%")).toBeInTheDocument(); // scrutiny rate
    expect(screen.getByText("100")).toBeInTheDocument(); // decisions
    expect(screen.getByLabelText(/scrutiny by evidence-highlight cohort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/decision dwell distribution/i)).toBeInTheDocument();
  });

  it("decomposes the cumulative dwell histogram into per-bucket counts", () => {
    render(<ReviewQualityPanel data={BASE} />);
    // +Inf bucket: 100 cumulative − 40 = 60 decisions over 5s.
    expect(screen.getByText("> 5s")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("flags the automation-bias regression when scrutiny drops under highlighting", () => {
    const regressed: ReviewerActivitySnapshot = {
      ...BASE,
      by_highlight: {
        shown: { decisions: 50, layer2_open_rate: 0.4 },
        not_shown: { decisions: 50, layer2_open_rate: 0.7 },
      },
    };
    render(<ReviewQualityPanel data={regressed} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/automation-bias regression/i);
  });

  it("renders honest 'no data source yet' cards for STP and calibration (never fabricated)", () => {
    render(<ReviewQualityPanel data={BASE} />);
    expect(screen.getByText(/straight-through-processing/i)).toBeInTheDocument();
    expect(screen.getByText(/calibration reliability/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no data source yet/i).length).toBeGreaterThanOrEqual(2);
  });
});
