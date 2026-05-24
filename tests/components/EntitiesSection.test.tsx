/**
 * EntitiesSection — render / data-presence behaviour (ADR-042 Phase 2).
 *
 * Dumb projector: renders extracted entities; optional per-row confidence /
 * source_span flow through <EvidenceBlock> (shown when present, suppressed
 * when null) — never an ad-hoc placeholder (Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { EntitiesSection } from "@/app/exceptions/EntitiesSection";
import type { EntitiesAnalysisData } from "@/types/exceptions";

const FULL: EntitiesAnalysisData = {
  extracted: [
    {
      key: "primary",
      value: "4500023421",
      kind: "order_id",
      confidence: 0.97,
      source_span: "change to order 4500023421",
    },
  ],
};

const MINIMAL: EntitiesAnalysisData = {
  extracted: [{ key: "po", value: "0093847612", kind: "po" }],
};

describe("EntitiesSection", () => {
  it("renders each extracted entity's kind, key, and value", () => {
    render(<EntitiesSection data={FULL} />);
    expect(screen.getByText("order_id")).toBeInTheDocument(); // kind
    expect(screen.getByText("primary")).toBeInTheDocument(); // key
    expect(screen.getByText("4500023421")).toBeInTheDocument(); // value
    expect(screen.getByLabelText("Extracted entities")).toBeInTheDocument();
  });

  it("shows confidence + source_span when present", () => {
    render(<EntitiesSection data={FULL} />);
    expect(screen.getByText(/confidence 97%/)).toBeInTheDocument();
    expect(
      screen.getByText(/change to order 4500023421/),
    ).toBeInTheDocument();
  });

  it("suppresses confidence + source_span when absent (no placeholder)", () => {
    render(<EntitiesSection data={MINIMAL} />);
    expect(screen.getByText("0093847612")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
    // No ad-hoc dash/N/A placeholder leaked in.
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
