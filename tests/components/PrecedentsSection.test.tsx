/**
 * PrecedentsSection — 'Similar past cases' (sign-off 2026-06-10).
 *
 * Locks the dumb-projector honesty rules: similarity renders ONLY on
 * semantic rows (correlate rows show their deterministic basis instead
 * — never a fabricated percentage); null fields are structurally
 * omitted; rows deep-link to the precedent's case; order is the
 * backend's, untouched.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrecedentsSection } from "@/app/exceptions/PrecedentsSection";
import type { PrecedentsAnalysis } from "@/types/exceptions";

const semantic = (over: Partial<PrecedentsAnalysis["items"][number]> = {}) => ({
  record_id: "exc-101",
  case_id: "case-101",
  customer_name: "Walmart",
  intent: "DUPLICATE_PO",
  resolved_at: "2026-03-14T06:22:00Z",
  outcome: "COMPLETE",
  outcome_summary: "Duplicate confirmed; PO rejected with buyer notice.",
  similarity: 0.92,
  match_basis: "semantic" as const,
  embedding_model: "text-embedding-3-small",
  ...over,
});

const payload = (items: PrecedentsAnalysis["items"]): PrecedentsAnalysis => ({
  items,
  query_basis: "intent=DUPLICATE_PO | customer=Walmart",
  generated_at: "2026-06-10T12:00:00Z",
});

describe("PrecedentsSection", () => {
  it("renders a semantic row with score, outcome label, and case link", () => {
    render(<PrecedentsSection data={payload([semantic()])} />);
    expect(screen.getByText("92% match")).toBeInTheDocument();
    // Governed humanized outcome, not the raw token.
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("COMPLETE")).not.toBeInTheDocument();
    expect(
      screen.getByText("Duplicate confirmed; PO rejected with buyer notice."),
    ).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/cases/case-101?record=exc-101");
    // The score is labelled as a match score with model provenance.
    expect(screen.getByTitle(/not a probability.*text-embedding-3-small/)).toBeInTheDocument();
  });

  it("correlate rows show the deterministic basis, never a fabricated score", () => {
    render(
      <PrecedentsSection
        data={payload([
          semantic({
            match_basis: "correlate",
            similarity: null,
            embedding_model: null,
          }),
        ])}
      />,
    );
    expect(screen.getByText("same issue")).toBeInTheDocument();
    expect(screen.queryByText(/% match/)).not.toBeInTheDocument();
  });

  it("structurally omits null fields (no dashes, no placeholders)", () => {
    const { container } = render(
      <PrecedentsSection
        data={payload([
          semantic({
            case_id: null,
            outcome_summary: null,
            outcome: null,
            resolved_at: null,
          }),
        ])}
      />,
    );
    // No case link without a case id — plain text heading instead.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Walmart")).toBeInTheDocument();
    // The ROWS carry no dash/placeholder partial-truth states (the
    // advisory footer prose legitimately contains an em-dash).
    const rows = container.querySelector("ul");
    expect(rows?.textContent).not.toContain("—");
    expect(rows?.textContent).not.toContain("N/A");
  });

  it("renders backend order untouched and nothing on an empty list", () => {
    const { container, rerender } = render(
      <PrecedentsSection
        data={payload([
          semantic({ record_id: "b", customer_name: "Beta", similarity: 0.6 }),
          semantic({ record_id: "a", customer_name: "Alpha", similarity: 0.9 }),
        ])}
      />,
    );
    const names = Array.from(container.querySelectorAll("li")).map(
      (li) => li.textContent ?? "",
    );
    // The UI must not re-rank (Beta first as given, despite lower score).
    expect(names[0]).toContain("Beta");
    expect(names[1]).toContain("Alpha");

    rerender(<PrecedentsSection data={payload([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("states the advisory boundary in the card", () => {
    render(<PrecedentsSection data={payload([semantic()])} />);
    expect(
      screen.getByText(/informational — they never decide an action/i),
    ).toBeInTheDocument();
  });
});
