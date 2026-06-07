/**
 * PipelineDAG — visual hierarchy + click-to-inspect tests.
 *
 * The 2026-05-02 redesign supersedes the brief hover-reveal pass:
 * verdict labels are always visible (consistent graph), but render
 * with strong hierarchy — taken-path labels in a brand-coloured pill
 * with bold type, un-taken labels as low-contrast text only. Click
 * any conditional edge to open an inline detail panel; the panel
 * shows the source node's decision payload + policy hits + sub-spans
 * for taken edges, or a topology-only note for un-taken edges.
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
  overrides: Partial<ExecutedNode> = {},
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
    ...overrides,
  };
}

const greenTraversal: ExecutedNode[] = [
  makeExecutedNode("ingest"),
  makeExecutedNode("classify", "ok"),
  makeExecutedNode("shadow_audit", "green", {
    decision: { shadow_status: "GREEN", trace_id: "trace-mock-green" },
    policy_hits: [],
  }),
  makeExecutedNode("execute_recipe"),
];

describe("PipelineDAG visual hierarchy", () => {
  it("renders every verdict label (consistent graph)", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const texts = Array.from(container.querySelectorAll("svg text")).map(
      (el) => el.textContent,
    );
    expect(texts).toContain("green");
    expect(texts).toContain("red");
    expect(texts).toContain("yellow");
  });

  it("emphasises the taken-path verdict label with a pill background", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const greenText = Array.from(container.querySelectorAll("svg text")).find(
      (el) => el.textContent === "green",
    );
    expect(greenText).toBeDefined();
    // Brand fill on the taken-path text.
    expect(greenText!.getAttribute("fill")).toMatch(/brand/);
    // The taken-path label gets a sibling <rect> pill in the same <g>.
    const parentG = greenText!.parentElement;
    expect(parentG?.querySelector("rect")).not.toBeNull();
  });

  // REGRESSION (report 06): taken vs un-taken edges differed only by colour
  // (brand vs border stroke). Add a non-colour cue (WCAG 1.4.1): taken =
  // SOLID, un-taken = DASHED, so the executed path survives grayscale.
  it("draws the taken path solid and un-taken edges dashed (non-colour cue)", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const edgePaths = Array.from(
      container.querySelectorAll("svg path[marker-end]"),
    );
    const taken = edgePaths.filter((p) =>
      (p.getAttribute("marker-end") ?? "").includes("taken"),
    );
    const untaken = edgePaths.filter(
      (p) => !(p.getAttribute("marker-end") ?? "").includes("taken"),
    );
    expect(taken.length).toBeGreaterThan(0);
    expect(untaken.length).toBeGreaterThan(0);
    taken.forEach((p) =>
      expect(p.getAttribute("stroke-dasharray")).toBeNull(),
    );
    untaken.forEach((p) =>
      expect(p.getAttribute("stroke-dasharray")).not.toBeNull(),
    );
  });

  it("renders un-taken verdict labels with low-contrast text only", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const redText = Array.from(container.querySelectorAll("svg text")).find(
      (el) => el.textContent === "red",
    );
    expect(redText).toBeDefined();
    // Quaternary text colour is the default-state un-taken contrast.
    expect(redText!.getAttribute("fill")).toMatch(/quaternary|tertiary/);
    // No pill rect on the un-taken label group.
    const parentG = redText!.parentElement;
    expect(parentG?.querySelector("rect")).toBeNull();
  });
});

describe("PipelineDAG click-to-inspect", () => {
  it("opens the detail panel when a conditional edge is clicked", () => {
    const { container, queryByRole, getByText } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    expect(queryByRole("region", { name: /Edge details/i })).toBeNull();

    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    expect(greenEdgeGroup).toBeDefined();
    fireEvent.click(greenEdgeGroup!);

    const panel = queryByRole("region", { name: /Edge details/i });
    expect(panel).not.toBeNull();
    // Header in the detail panel reads "Shadow Audit → Execute Recipe".
    expect(panel!.textContent).toMatch(/Shadow Audit/);
    expect(panel!.textContent).toMatch(/Execute Recipe/);
    // Suppress unused-binding lint for getByText (used in other tests).
    expect(typeof getByText).toBe("function");
  });

  it("clicking the same edge twice closes the detail panel", () => {
    const { container, queryByRole } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    fireEvent.click(greenEdgeGroup!);
    expect(queryByRole("region", { name: /Edge details/i })).not.toBeNull();
    fireEvent.click(greenEdgeGroup!);
    expect(queryByRole("region", { name: /Edge details/i })).toBeNull();
  });

  it("renders the source node's decision payload for a taken edge", () => {
    const { container, getByText } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    fireEvent.click(greenEdgeGroup!);
    expect(getByText(/Decision \(from Shadow Audit\)/i)).toBeDefined();
    // The decision JSON dump should include the seeded shadow_status.
    expect(getByText(/GREEN/)).toBeDefined();
  });

  it("renders policy hits when shadow_audit recorded any", () => {
    // Include build_analysis after shadow_audit so the
    // shadow_audit→build_analysis (red) edge is in the taken set.
    const trace: ExecutedNode[] = [
      ...greenTraversal.slice(0, 2),
      makeExecutedNode("shadow_audit", "red", {
        status: "halted",
        decision: { shadow_status: "RED" },
        policy_hits: ["mass_pricing.compliance_block"],
      }),
      makeExecutedNode("build_analysis", null, { status: "halted" }),
    ];
    const { container, getByText } = render(
      <PipelineDAG topology={topology} executedNodes={trace} />,
    );
    const redEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict red"),
    );
    fireEvent.click(redEdgeGroup!);
    expect(getByText(/Policy hits/i)).toBeDefined();
    expect(getByText(/mass_pricing\.compliance_block/)).toBeDefined();
  });

  it("renders gateway sub-spans when the source node recorded any", () => {
    // Trace covers shadow_audit (with sub_spans) → execute_recipe so
    // the shadow_audit→execute_recipe (green) edge is taken.
    const traceWithSubSpans: ExecutedNode[] = [
      makeExecutedNode("ingest"),
      makeExecutedNode("classify", "ok"),
      makeExecutedNode("shadow_audit", "green", {
        sub_spans: [
          {
            gateway: "sap_doc/get_sales_order",
            started_at: "2026-05-01T12:00:00Z",
            finished_at: "2026-05-01T12:00:00.054Z",
            duration_ms: 54,
            status: "ok",
          },
        ],
      }),
      makeExecutedNode("execute_recipe"),
    ];
    const { container, getByText } = render(
      <PipelineDAG topology={topology} executedNodes={traceWithSubSpans} />,
    );
    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    fireEvent.click(greenEdgeGroup!);
    expect(getByText(/Gateway calls/i)).toBeDefined();
    expect(getByText(/sap_doc\/get_sales_order/)).toBeDefined();
  });

  it("shows the topology-only note when an un-taken edge is clicked", () => {
    const { container, getByText } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const redEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict red"),
    );
    fireEvent.click(redEdgeGroup!);
    expect(getByText(/not traversed in this attempt/i)).toBeDefined();
  });

  // REGRESSION (report 06): on open, focus was not moved into the panel, so
  // keyboard users were left on the edge with new content appearing elsewhere.
  it("moves focus into the detail panel when it opens (a11y)", () => {
    const { container, queryByRole } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    fireEvent.click(greenEdgeGroup!);
    const panel = queryByRole("region", { name: /Edge details/i });
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
  });

  it("opens the detail panel on Enter keyboard activation (a11y)", () => {
    const { container, queryByRole } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    fireEvent.keyDown(greenEdgeGroup!, { key: "Enter" });
    expect(queryByRole("region", { name: /Edge details/i })).not.toBeNull();
  });

  it("Close button dismisses the detail panel", () => {
    const { container, getByLabelText, queryByRole } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const greenEdgeGroup = Array.from(
      container.querySelectorAll("g[role='button']"),
    ).find((g) =>
      (g.getAttribute("aria-label") ?? "").includes("verdict green"),
    );
    fireEvent.click(greenEdgeGroup!);
    fireEvent.click(getByLabelText("Close edge details"));
    expect(queryByRole("region", { name: /Edge details/i })).toBeNull();
  });

  it("conditional edges have role='button' + aria-label for screen readers", () => {
    const { container } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    const buttons = Array.from(container.querySelectorAll("g[role='button']"));
    const verdictsCovered = buttons
      .map((g) => g.getAttribute("aria-label") ?? "")
      .filter((label) => /verdict (red|yellow|green)/.test(label));
    expect(verdictsCovered.length).toBe(3);
  });

  it("renders the click-to-inspect hint", () => {
    const { getByText } = render(
      <PipelineDAG topology={topology} executedNodes={greenTraversal} />,
    );
    expect(getByText(/Click any edge/i)).toBeDefined();
  });
});
