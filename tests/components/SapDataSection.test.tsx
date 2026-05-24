/**
 * SapDataSection — render / data-presence behaviour (ADR-042 Phase 2).
 * Dumb projector: system + validation_status always; order_value_usd /
 * sap_doc_number via <EvidenceBlock> (shown when present, suppressed when
 * null) — never an ad-hoc placeholder (Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SapDataSection } from "@/app/exceptions/SapDataSection";
import type { SapDataAnalysisData } from "@/types/exceptions";

const FULL: SapDataAnalysisData = {
  system: "S4H_PRD",
  validation_status: "SO confirmed, ATP OK",
  order_value_usd: 45200,
  sap_doc_number: "5100012344",
};

const MINIMAL: SapDataAnalysisData = {
  system: "ECC_PRD",
  validation_status: "Order on hold — credit block",
};

describe("SapDataSection", () => {
  it("renders system + validation status", () => {
    render(<SapDataSection data={FULL} />);
    expect(screen.getByText("S4H_PRD")).toBeInTheDocument();
    expect(screen.getByText("SO confirmed, ATP OK")).toBeInTheDocument();
    expect(screen.getByLabelText("SAP data")).toBeInTheDocument();
  });

  it("formats order value + shows the SAP doc when present", () => {
    render(<SapDataSection data={FULL} />);
    expect(screen.getByText("$45,200")).toBeInTheDocument();
    expect(screen.getByText("5100012344")).toBeInTheDocument();
  });

  it("suppresses order value + doc when absent (no placeholder)", () => {
    render(<SapDataSection data={MINIMAL} />);
    expect(screen.getByText("ECC_PRD")).toBeInTheDocument();
    expect(screen.queryByText(/Order value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SAP doc:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
