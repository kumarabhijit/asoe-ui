/**
 * PipelineDAG — figure-ground unit tests (ADR-027 Phase D rev. 4).
 *
 * Asserts the design rule: verdict labels on un-taken edges are
 * hidden by default and revealed on hover/focus. Taken-path verdict
 * labels are always visible. The rule comes from the
 * Tufte/Munzner/Norman synthesis applied 2026-05-02 — sprinkled
 * labels on every edge violated data-ink ratio + figure-ground
 * principles.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PipelineDAG } from "@/components/ui/PipelineDAG";
import type {
  PipelineTopology,
  ExecutedNode,
} from "@/types/api";

const topology: PipelineTopology = {
  topology_hash: "test-hash",
  nodes: [
    { id: "ingest", label: "ingest", kind: "node" },
    { id: "classify", label: "classify", kind: "node" },
    { id: "shadow_audit", label: "shadow_audit", kind: "node" },
    { id: "execute_recipe", label: "execute_recipe", kind: "node" },
    { id: "build_analysis", label: "build_analysis", kind: "terminal" },
  ],
  edges: [
    { from_node: "ingest", to_node: "classify", conditional: false, verdict_label: null },
    { from_node: "classify", to_node: "shadow_audit", conditional: false, verdict_label: null },
    { from_node: "shadow_audit", to_node: "build_analysis", conditional: true, verdict_label: "red" },
    { from_node: "shadow_audit", to_node: "build_analysis", conditional: true, verdict_label: "yellow" },
    { from_node: "shadow_audit", to_node: "execute_recipe", conditional: true, verdict_label: "green" },
  ],
};

function makeExecutedNode(
  node: string,
  exit_verdict: string | null = null,
): ExecutedNode {
  return {
    node,
    entered_at: "2026-05-01T12:00:00Z",
    completed_at: "2026-05-01T12:00:00.005Z",
    duration_ms: 5,
    timestamp: "2026-05-01T12:00:00Z",
    status: "completed",
    decision: {},
    exit_verdict,
    policy_hits: [],
    sub_spans: [],
  };
}

describe("PipelineDAG figure-ground", () => {
  // GREEN traversal: ingest → classify → shadow_audit (green) → execute_recipe.
  // The taken path includes the `green` verdict edge; un-taken `red` and
  // `yellow` edges should NOT show their labels by default.
  const greenTraversal: ExecutedNode[] = [
    makeExecutedNode("ingest"),
    makeExecutedNode("classify", "ok"),
    makeExecutedNode("shadow_audit", "green"),
    makeExecutedNode("execute_recipe"),
  ];

  it("shows the taken-path verdict label by default", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    // The "green" verdict text is rendered inside an SVG <text>.
    const greenText = Array.from(container.querySelectorAll("text")).find(
      (el) => el.textContent === "green",
    );
    expect(greenText).toBeDefined();
  });

  it("hides un-taken verdict labels by default (figure-ground)", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const redText = Array.from(container.querySelectorAll("text")).find(
      (el) => el.textContent === "red",
    );
    const yellowText = Array.from(container.querySelectorAll("text")).find(
      (el) => el.textContent === "yellow",
    );
    expect(redText).toBeUndefined();
    expect(yellowText).toBeUndefined();
  });

  it("reveals an un-taken verdict label on hover", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    // Find the un-taken red edge group by its aria-label and hover it.
    const redEdgeGroup = Array.from(
      container.querySelectorAll("g[aria-label]"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict red"),
    );
    expect(redEdgeGroup).toBeDefined();
    fireEvent.mouseEnter(redEdgeGroup!);
    const redText = Array.from(container.querySelectorAll("text")).find(
      (el) => el.textContent === "red",
    );
    expect(redText).toBeDefined();
  });

  it("hides the verdict label again on mouse leave", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const redEdgeGroup = Array.from(
      container.querySelectorAll("g[aria-label]"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict red"),
    );
    fireEvent.mouseEnter(redEdgeGroup!);
    fireEvent.mouseLeave(redEdgeGroup!);
    const redText = Array.from(container.querySelectorAll("text")).find(
      (el) => el.textContent === "red",
    );
    expect(redText).toBeUndefined();
  });

  it("reveals an un-taken verdict label on keyboard focus", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const redEdgeGroup = Array.from(
      container.querySelectorAll("g[aria-label]"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict red"),
    );
    fireEvent.focus(redEdgeGroup!);
    const redText = Array.from(container.querySelectorAll("text")).find(
      (el) => el.textContent === "red",
    );
    expect(redText).toBeDefined();
  });

  it("conditional edges have aria-labels for screen readers", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    // shadow_audit→build_analysis (red) and (yellow) and (green→execute_recipe)
    // each carry aria-labels.
    const labelled = Array.from(container.querySelectorAll("g[aria-label]"));
    const redEdge = labelled.some((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict red"),
    );
    const yellowEdge = labelled.some((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict yellow"),
    );
    const greenEdge = labelled.some((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    expect(redEdge).toBe(true);
    expect(yellowEdge).toBe(true);
    expect(greenEdge).toBe(true);
  });

  it("renders the inspect-on-hover hint", () => {
    const { getByText } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    expect(getByText(/Hover or focus any edge/i)).toBeDefined();
  });
});
