/**
 * ActivityIndicator tests — domain-aware messages, intent-specific variants.
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

  it("renders default message when intent is unknown", () => {
    render(<ActivityIndicator node="shadow_audit" intent="UNKNOWN_INTENT" />);
    expect(screen.getByText(/compliance shadow/i)).toBeInTheDocument();
  });

  it("renders intent-specific message for execute_recipe", () => {
    render(<ActivityIndicator node="execute_recipe" intent="CREDIT_BLOCK" />);
    expect(screen.getByText(/credit hold/i)).toBeInTheDocument();
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
