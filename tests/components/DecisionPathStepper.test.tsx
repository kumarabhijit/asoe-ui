/**
 * DecisionPathStepper tests (cockpit study, council 2026-06-10).
 *
 * The Modern "Path" projection of trace.executed_nodes. Locks: ordered
 * list semantics, 1-based step numbering, icon + TEXT status (never
 * colour alone), verdict + terminal-status surfacing, and the
 * pure-projector empty state.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { DecisionPathStepper } from "@/components/ui/DecisionPathStepper";
import type { ExecutedNode } from "@/types/api";

function node(partial: Partial<ExecutedNode> & Pick<ExecutedNode, "node" | "status">): ExecutedNode {
  return {
    entered_at: "2026-06-10T10:00:00Z",
    completed_at: "2026-06-10T10:00:01Z",
    duration_ms: 1000,
    timestamp: "2026-06-10T10:00:00Z",
    decision: {},
    exit_verdict: null,
    policy_hits: [],
    sub_spans: [],
    ...partial,
  };
}

const PATH: ExecutedNode[] = [
  node({ node: "classify_intent", status: "completed" }),
  node({ node: "shadow_audit", status: "halted", exit_verdict: "YELLOW" }),
];

describe("DecisionPathStepper", () => {
  it("renders the executed nodes as an ordered decision path", () => {
    render(<DecisionPathStepper executedNodes={PATH} finalStatus="MANUAL_REVIEW_REQUIRED" />);
    const list = screen.getByRole("list", { name: /decision path/i });
    expect(list).toBeInTheDocument();
    // Humanised node names appear in sequence.
    expect(within(list).getByText(/classify intent/i)).toBeInTheDocument();
    expect(within(list).getByText(/shadow audit/i)).toBeInTheDocument();
  });

  it("numbers the steps 1-based (the path affordance)", () => {
    render(<DecisionPathStepper executedNodes={PATH} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("conveys status as TEXT, not colour alone (WCAG 1.4.1)", () => {
    render(<DecisionPathStepper executedNodes={PATH} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("halted")).toBeInTheDocument();
  });

  it("surfaces a node's exit verdict and the terminal result", () => {
    render(<DecisionPathStepper executedNodes={PATH} finalStatus="MANUAL_REVIEW_REQUIRED" />);
    expect(screen.getByText(/YELLOW/)).toBeInTheDocument();
    expect(screen.getByText("MANUAL_REVIEW_REQUIRED")).toBeInTheDocument();
  });

  it("renders the pure-projector empty state when no nodes ran", () => {
    render(<DecisionPathStepper executedNodes={[]} />);
    expect(screen.getByText(/executed-path evidence not available/i)).toBeInTheDocument();
    // No fabricated steps, no list.
    expect(screen.queryByRole("list", { name: /decision path/i })).not.toBeInTheDocument();
  });

  it("does not render a terminal Result chip when finalStatus is absent", () => {
    render(<DecisionPathStepper executedNodes={PATH} />);
    expect(screen.queryByText(/^Result$/)).not.toBeInTheDocument();
  });
});
