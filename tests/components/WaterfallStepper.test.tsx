/**
 * WaterfallStepper tests — node states, pipeline visualization.
 */
import { render, screen } from "@testing-library/react";
import { WaterfallStepper, type NodeState } from "@/components/ui/WaterfallStepper";
import type { PipelineNode } from "@/types/exceptions";

const ALL_NODES: PipelineNode[] = [
  "ingest", "classify", "load_skill", "validate_circuit_breaker",
  "shadow_audit", "select_recipe", "validate_types",
  "resolve_dependencies", "execute_recipe", "apply_effects",
];

function makeNodeStates(completedCount: number, inProgress = false): NodeState[] {
  return ALL_NODES.map((node, i): NodeState => {
    if (i < completedCount) return { node, status: "completed", duration_ms: 200 };
    if (i === completedCount && inProgress) return { node, status: "started" };
    return { node, status: "pending" };
  });
}

describe("WaterfallStepper", () => {
  it("renders all 10 pipeline node labels", () => {
    const nodes = makeNodeStates(0);
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText("Ingest Event")).toBeInTheDocument();
    expect(screen.getByText("Classify Intent")).toBeInTheDocument();
    expect(screen.getByText("Compliance Shadow")).toBeInTheDocument();
    expect(screen.getByText("Execute Recipe")).toBeInTheDocument();
    expect(screen.getByText("Apply Effects")).toBeInTheDocument();
  });

  it("shows data summary for completed classify node", () => {
    const nodes = makeNodeStates(2);
    nodes[1] = { node: "classify", status: "completed", data: { intent: "DUPLICATE_PO", confidence: 0.95 } };
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText("Intent: DUPLICATE_PO (95%)")).toBeInTheDocument();
  });

  it("shows verdict summary for completed shadow_audit node", () => {
    const nodes = makeNodeStates(5);
    nodes[4] = { node: "shadow_audit", status: "completed", data: { shadow_verdict: "GREEN" } };
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText("Verdict: GREEN")).toBeInTheDocument();
  });

  it("shows ActivityIndicator for in-progress node", () => {
    const nodes = makeNodeStates(4, true);
    render(<WaterfallStepper nodes={nodes} intent="DUPLICATE_PO" />);
    expect(screen.getByText("Auditing duplicate PO against compliance policies...")).toBeInTheDocument();
  });

  it("shows error message for failed node", () => {
    const nodes = makeNodeStates(3);
    nodes[3] = { node: "validate_circuit_breaker", status: "failed" };
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText(/Node failed/)).toBeInTheDocument();
  });

  it("renders all completed nodes for a resolved exception", () => {
    const nodes = makeNodeStates(10); // All completed
    render(<WaterfallStepper nodes={nodes} />);
    // All nodes should show completed state (checkmark icons)
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(10);
  });
});
