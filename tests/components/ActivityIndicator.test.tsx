/**
 * ActivityIndicator tests — domain-aware messages without hardcoded enums.
 *
 * Contract (UX audit batch 2, Guardrail #2 + #4): intent-specialised nodes
 * inject the *humanised* intent label into the message. A NEW intent added in
 * asoe2 surfaces a readable label with zero UI changes; only when no intent is
 * known does the node fall back to neutral copy.
 */
import { render, screen } from "@testing-library/react";
import { ActivityIndicator } from "@/components/ui/ActivityIndicator";
import type { PipelineNode } from "@/types/exceptions";

describe("ActivityIndicator", () => {
  it("renders a message for each pipeline node", () => {
    const nodes: PipelineNode[] = [
      "ingest", "classify", "load_skill", "validate_circuit_breaker",
      "shadow_audit", "select_recipe", "validate_types",
      "resolve_dependencies", "execute_recipe", "apply_effects",
    ];
    for (const node of nodes) {
      const { unmount } = render(<ActivityIndicator node={node} />);
      // Should render some text (not empty)
      const text = screen.getByText(/\w+/);
      expect(text).toBeInTheDocument();
      unmount();
    }
  });

  it("renders intent-specific message for shadow_audit", () => {
    render(<ActivityIndicator node="shadow_audit" intent="DUPLICATE_PO" />);
    expect(screen.getByText(/duplicate PO/i)).toBeInTheDocument();
  });

  it("renders neutral default copy when NO intent is known", () => {
    render(<ActivityIndicator node="shadow_audit" />);
    expect(screen.getByText(/compliance shadow/i)).toBeInTheDocument();
  });

  it("renders intent-specific message for execute_recipe", () => {
    render(<ActivityIndicator node="execute_recipe" intent="CREDIT_BLOCK" />);
    expect(screen.getByText(/credit block/i)).toBeInTheDocument();
  });

  // REGRESSION (fails on parent): the parent hardcoded four intent literals in
  // NODE_MESSAGES and dropped any other intent to generic `_default`. A new
  // intent must now surface its humanised label instead — that is the whole
  // point of Guardrail #2 (zero UI change for a new backend enum value).
  it("forward-compat: a brand-new intent surfaces a humanised label, not generic copy", () => {
    render(
      <ActivityIndicator node="execute_recipe" intent="FUTURE_PRICING_INTENT" />,
    );
    expect(
      screen.getByText(/executing future pricing intent recipe/i),
    ).toBeInTheDocument();
    // And it is NOT the generic fallback the parent would have shown.
    expect(screen.queryByText(/^Executing recipe\.\.\.$/)).not.toBeInTheDocument();
  });

  // REGRESSION (fails on parent): the indicator had no live region despite
  // being the named example in CLAUDE.md, so message changes weren't announced.
  it("is a polite live region (role=status, aria-live=polite)", () => {
    render(<ActivityIndicator node="classify" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("messages are not generic 'Loading...' (Section 11.2 requirement)", () => {
    const nodes: PipelineNode[] = ["ingest", "classify", "shadow_audit", "execute_recipe"];
    for (const node of nodes) {
      const { unmount } = render(<ActivityIndicator node={node} />);
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      unmount();
    }
  });
});
