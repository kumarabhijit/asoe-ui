/**
 * ProvenanceCard tests — the Diagnostics & Audit "Provenance" projector
 * (council 2026-06-10).
 *
 * Locks the dumb-projector contract: present fields render; absent
 * fields are structurally omitted (no "—", no fabricated value); an
 * empty bundle renders nothing; the taxonomy version annotates the
 * supergroup only when present.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ProvenanceCard } from "@/components/ui/ProvenanceCard";
import type { PresentationAudit } from "@/types/exceptions";

const FULL: PresentationAudit = {
  recipe_name: "DuplicatePORecipe",
  intent_code: "DUPLICATE_PO",
  event_type: "EDI_850_PRICE_MISMATCH",
  shadow_verdict: "YELLOW",
  supergroup_code: "cpg.beverage.dup-po",
  taxonomy_version: "2026-05-30-v2",
  correlation_id: "8c9f-f828-41d0-9a2b",
};

describe("ProvenanceCard", () => {
  it("renders every present provenance field", () => {
    render(<ProvenanceCard audit={FULL} />);
    expect(screen.getByRole("region", { name: /provenance/i })).toBeInTheDocument();
    expect(screen.getByText("DuplicatePORecipe")).toBeInTheDocument();
    expect(screen.getByText("DUPLICATE_PO")).toBeInTheDocument();
    expect(screen.getByText("EDI_850_PRICE_MISMATCH")).toBeInTheDocument();
    expect(screen.getByText("YELLOW")).toBeInTheDocument();
    expect(screen.getByText(/cpg\.beverage\.dup-po/)).toBeInTheDocument();
    expect(screen.getByText("8c9f-f828-41d0-9a2b")).toBeInTheDocument();
  });

  it("annotates the taxonomy with the version when present", () => {
    render(<ProvenanceCard audit={FULL} />);
    expect(screen.getByText(/v2026-05-30-v2/)).toBeInTheDocument();
  });

  it("structurally omits absent rows (no fabricated placeholder)", () => {
    render(
      <ProvenanceCard
        audit={{ recipe_name: "OnlyRecipe", intent_code: null, correlation_id: null }}
      />,
    );
    expect(screen.getByText("OnlyRecipe")).toBeInTheDocument();
    // Absent fields render no label and no "—" placeholder.
    expect(screen.queryByText(/event type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/correlation/i)).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText(/N\/A/i)).not.toBeInTheDocument();
  });

  it("renders nothing when the bundle is empty", () => {
    const { container } = render(<ProvenanceCard audit={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no audit bundle at all", () => {
    const { container } = render(<ProvenanceCard audit={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not annotate a version when there is no taxonomy classification", () => {
    // taxonomy_version without supergroup_code: the version row is gated
    // on the supergroup, so nothing taxonomy-related renders.
    render(<ProvenanceCard audit={{ recipe_name: "R", taxonomy_version: "2026-05-30-v2" }} />);
    expect(screen.queryByText(/taxonomy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/v2026-05-30-v2/)).not.toBeInTheDocument();
  });
});
