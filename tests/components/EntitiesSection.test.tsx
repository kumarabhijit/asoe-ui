/**
 * EntitiesSection — render / data-presence behaviour (ADR-042 Phase 2).
 *
 * Dumb projector: renders extracted entities; optional per-row confidence /
 * source_span flow through <EvidenceBlock> (shown when present, suppressed
 * when null) — never an ad-hoc placeholder (Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { EntitiesSection } from "@/app/exceptions/EntitiesSection";
import { EvidenceSelectionProvider } from "@/hooks/useEvidenceSelection";
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
    // Confidence now renders through the canonical ConfidenceDisplay,
    // which exposes value + band + calibration posture via aria-label.
    expect(
      screen.getByLabelText(/primary confidence: 97 percent/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/change to order 4500023421/),
    ).toBeInTheDocument();
  });

  it("suppresses confidence + source_span when absent (no placeholder)", () => {
    render(<EntitiesSection data={MINIMAL} />);
    expect(screen.getByText("0093847612")).toBeInTheDocument();
    expect(screen.queryByLabelText(/confidence/i)).not.toBeInTheDocument();
    // No ad-hoc dash/N/A placeholder leaked in.
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });

  // ── ADR-043 field↔source linking ──────────────────────────────────────────
  it("offers a 'Show in source' control only when the entity carries an evidence_ref", () => {
    render(
      <EvidenceSelectionProvider>
        <EntitiesSection
          data={{
            extracted: [
              { ...FULL.extracted[0], evidence_ref: "order_entry.primary" },
              { key: "po", value: "0093847612", kind: "po" }, // no ref
            ],
          }}
        />
      </EvidenceSelectionProvider>,
    );
    // Exactly one linkable row → one control.
    const controls = screen.getAllByRole("button", { name: /show in source/i });
    expect(controls).toHaveLength(1);
  });

  it("toggles the shared selection when the link control is activated", () => {
    render(
      <EvidenceSelectionProvider>
        <EntitiesSection
          data={{ extracted: [{ ...FULL.extracted[0], evidence_ref: "order_entry.primary" }] }}
        />
      </EvidenceSelectionProvider>,
    );
    const control = screen.getByRole("button", { name: /show in source/i });
    expect(control).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(control);
    expect(
      screen.getByRole("button", { name: /showing in source/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders no link control when no entity carries an evidence_ref", () => {
    render(
      <EvidenceSelectionProvider>
        <EntitiesSection data={MINIMAL} />
      </EvidenceSelectionProvider>,
    );
    expect(screen.queryByRole("button", { name: /show in source/i })).not.toBeInTheDocument();
  });
});
