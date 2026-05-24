/**
 * KnowledgeGraphSection — render behaviour (ADR-042 Phase 7). Dumb projector of
 * the derived entity graph: a deterministic radial SVG plus an accessible
 * relationships list (WCAG parity — the graph is not diagram-only).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KnowledgeGraphSection } from "@/app/exceptions/KnowledgeGraphSection";
import type { KnowledgeGraphPayload } from "@/types/exceptions";

const GRAPH: KnowledgeGraphPayload = {
  root_id: "order:po1",
  nodes: [
    { id: "order:po1", label: "PO-1", kind: "order", detail: "Sales order" },
    { id: "customer:300001", label: "Walmart Stores Inc", kind: "customer", detail: "BP 300001" },
    { id: "material:cola", label: "BEV-COLA-12PK", kind: "material", detail: "480 CS" },
    { id: "sap_doc:5100", label: "5100012344", kind: "sap_doc", detail: "SO confirmed" },
  ],
  edges: [
    { source: "customer:300001", target: "order:po1", relation: "places" },
    { source: "order:po1", target: "material:cola", relation: "contains" },
    { source: "order:po1", target: "sap_doc:5100", relation: "validated_by" },
  ],
};

describe("KnowledgeGraphSection", () => {
  it("renders node labels and an accessible relationships list", () => {
    render(<KnowledgeGraphSection data={GRAPH} />);
    expect(screen.getByText("4 nodes · 3 edges")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Entity graph of 4 nodes/ })).toBeInTheDocument();
    // Node labels appear in the SVG; "places"/"contains" relations in the list.
    expect(screen.getAllByText("Walmart Stores Inc").length).toBeGreaterThan(0);
    expect(screen.getByText("places")).toBeInTheDocument();
    expect(screen.getByText("contains")).toBeInTheDocument();
    expect(screen.getByText("validated_by")).toBeInTheDocument();
  });

  it("handles a single-node graph (no edges) without error", () => {
    render(
      <KnowledgeGraphSection
        data={{ root_id: "order:x", nodes: [{ id: "order:x", label: "X", kind: "order" }], edges: [] }}
      />,
    );
    expect(screen.getByText("1 nodes · 0 edges")).toBeInTheDocument();
  });
});
