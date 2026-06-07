/**
 * ChangeAnalysisSection — render / data-presence behaviour (ADR-042 Phase 6).
 * Dumb projector for the deterministic order-change evaluation. Renders the N
 * constraints / M scenarios the backend returns (variable cardinality); the
 * decision panel is Layer 1. Optional fields flow through <EvidenceBlock> — no
 * ad-hoc placeholders (Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChangeAnalysisSection } from "@/app/exceptions/ChangeAnalysisSection";
import type { ChangeAnalysis } from "@/types/exceptions";

const DATA: ChangeAnalysis = {
  evaluation: {
    lifecycle_stages: ["Created", "Confirmed", "Released", "Picked", "Shipped"],
    lifecycle_index: 2,
    change_items: [
      { field: "quantity", from_value: "480", to_value: "600" },
    ],
    checks: [
      { name: "Inventory", status: "WARNING", detail: "ATP short", metric: "ATP 520 vs 600 required", agent: "Inventory Agent", system_ref: "SAP MM/ATP" },
      { name: "Financial", status: "CONDITIONAL", detail: "Meets four-eyes threshold.", metric: "$45,200.00 revenue impact", agent: "Finance Agent", system_ref: "SAP FI/CO" },
    ],
    pass_count: 0,
    conditional_count: 1,
    warning_count: 1,
  },
  scenarios: [
    { name: "Approve as requested", description: "Apply as-is.", recommended: false, impact: "warning present", financial_delta_usd: 0 },
    { name: "Partial fulfilment", description: "Ship available now.", recommended: true, impact: "protects date", financial_delta_usd: -11300 },
  ],
  decision: {
    recommended_action: "Partial fulfilment",
    confidence: 0.65,
    rationale: "One or more constraints raised a warning.",
    revenue_impact_usd: 45200,
    requires_cosign: true,
    sap_actions: ["VA02: update sales order"],
  },
};

const MINIMAL: ChangeAnalysis = {
  evaluation: {
    lifecycle_stages: [],
    lifecycle_index: null,
    change_items: [],
    checks: [
      { name: "Financial", status: "PASS", detail: "Below threshold", metric: null, agent: null, system_ref: null },
    ],
    pass_count: 1,
    conditional_count: 0,
    warning_count: 0,
  },
  scenarios: [],
  decision: {
    recommended_action: "Approve as requested",
    confidence: 0.98,
    rationale: null,
    revenue_impact_usd: null,
    requires_cosign: false,
    sap_actions: [],
  },
};

describe("ChangeAnalysisSection", () => {
  it("renders the decision panel, constraints, and scenarios (variable cardinality)", () => {
    render(<ChangeAnalysisSection data={DATA} />);
    expect(screen.getByText("65% confidence")).toBeInTheDocument();
    expect(screen.getByText("Cosign required")).toBeInTheDocument();
    expect(screen.getByText("Constraints (2)")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Scenarios (2)")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("quantity")).toBeInTheDocument();
    expect(screen.getByText("600")).toBeInTheDocument();
  });

  // REGRESSION (report 05): constraint status was rendered as the raw enum
  // token, and WARNING was mapped to the red `error` treatment — inverting
  // the severity scale (a warning looked like a hard failure while a
  // CONDITIONAL pass took amber).
  it("humanises the constraint status and tones WARNING as warning, not error", () => {
    render(<ChangeAnalysisSection data={DATA} />);
    // Humanised label, not the raw "WARNING" token.
    const warningBadge = screen.getByText("Warning");
    expect(screen.queryByText("WARNING")).not.toBeInTheDocument();
    // WARNING is the cautionary peak → amber, never the red error treatment.
    expect(warningBadge.className).toMatch(/warning/);
    expect(warningBadge.className).not.toMatch(/error/);
    // CONDITIONAL humanises and is informational, not amber.
    expect(screen.getByText("Conditional")).toBeInTheDocument();
  });

  it("suppresses absent optional fields and omits empty sections (no placeholder)", () => {
    render(<ChangeAnalysisSection data={MINIMAL} />);
    expect(screen.getByText("Constraints (1)")).toBeInTheDocument();
    // No scenarios → the Scenarios heading is omitted entirely.
    expect(screen.queryByText(/^Scenarios/)).not.toBeInTheDocument();
    // No lifecycle stages → no lifecycle bar.
    expect(screen.queryByText("Order lifecycle")).not.toBeInTheDocument();
    // requires_cosign false → no cosign badge.
    expect(screen.queryByText("Cosign required")).not.toBeInTheDocument();
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
