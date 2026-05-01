/**
 * EventsTimeline — ADR-027 Phase C unit tests.
 *
 * Covers: empty-state banner, halt highlighting, verdict pill rendering,
 * sub-span expansion, and the no-closed-enum contract (humanizeNode
 * works on arbitrary node ids from the topology, not a frozen list).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventsTimeline } from "@/components/ui/EventsTimeline";
import type { ExecutedNode } from "@/types/api";

function makeNode(overrides: Partial<ExecutedNode> = {}): ExecutedNode {
  return {
    node: "ingest",
    entered_at: "2026-05-01T12:00:00Z",
    completed_at: "2026-05-01T12:00:00.005Z",
    duration_ms: 5,
    timestamp: "2026-05-01T12:00:00Z",
    status: "completed",
    decision: {},
    exit_verdict: null,
    policy_hits: [],
    sub_spans: [],
    ...overrides,
  };
}

describe("EventsTimeline", () => {
  it("renders the empty-state banner when executedNodes is empty", () => {
    render(<EventsTimeline executedNodes={[]} />);
    expect(
      screen.getByText(/Executed-path evidence not available/i),
    ).toBeInTheDocument();
  });

  it("renders the empty-state banner with a custom message", () => {
    render(
      <EventsTimeline
        executedNodes={[]}
        emptyMessage="Custom pre-Phase-B banner."
      />,
    );
    expect(screen.getByText("Custom pre-Phase-B banner.")).toBeInTheDocument();
  });

  it("renders one row per executed node, in order", () => {
    render(
      <EventsTimeline
        executedNodes={[
          makeNode({ node: "ingest" }),
          makeNode({ node: "classify", exit_verdict: "ok" }),
          makeNode({ node: "load_skill" }),
        ]}
      />,
    );
    expect(screen.getByText("Ingest")).toBeInTheDocument();
    expect(screen.getByText("Classify")).toBeInTheDocument();
    expect(screen.getByText("Load Skill")).toBeInTheDocument();
  });

  it("title-cases snake_case node ids without a closed enum", () => {
    render(
      <EventsTimeline
        executedNodes={[makeNode({ node: "future_unmapped_node" })]}
      />,
    );
    // No closed mapping required — Guardrail #2 extended to pipeline nodes.
    expect(screen.getByText("Future Unmapped Node")).toBeInTheDocument();
  });

  it("renders the exit_verdict pill", () => {
    render(
      <EventsTimeline
        executedNodes={[
          makeNode({ node: "shadow_audit", exit_verdict: "red" }),
        ]}
      />,
    );
    expect(screen.getByText("red")).toBeInTheDocument();
  });

  it("renders the halt banner when a node is halted/errored", () => {
    render(
      <EventsTimeline
        executedNodes={[
          makeNode({ node: "ingest" }),
          makeNode({
            node: "shadow_audit",
            status: "halted",
            exit_verdict: "red",
          }),
        ]}
        finalStatus="BLOCKED"
      />,
    );
    expect(screen.getByText(/Halted at Shadow Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/BLOCKED/)).toBeInTheDocument();
  });

  it("expands sub_spans when the row is clicked", () => {
    render(
      <EventsTimeline
        executedNodes={[
          makeNode({
            node: "resolve_dependencies",
            exit_verdict: "ok",
            sub_spans: [
              {
                gateway: "oms/get_price_hold_status",
                started_at: "2026-05-01T12:00:00Z",
                finished_at: "2026-05-01T12:00:00.020Z",
                duration_ms: 20,
                status: "ok",
              },
            ],
          }),
        ]}
      />,
    );
    // Sub-span hidden by default
    expect(
      screen.queryByText("oms/get_price_hold_status"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Resolve Dependencies"));
    expect(
      screen.getByText("oms/get_price_hold_status"),
    ).toBeInTheDocument();
    // "ok" appears twice (the row's exit_verdict pill + the
    // gateway-status pill) — assert at least one is present.
    expect(screen.getAllByText("ok").length).toBeGreaterThanOrEqual(1);
  });

  it("expands the decision payload when clicked", () => {
    render(
      <EventsTimeline
        executedNodes={[
          makeNode({
            node: "classify",
            exit_verdict: "ok",
            decision: { intent: "DUPLICATE_PO", confidence: 0.91 },
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByText("Classify"));
    expect(screen.getByText(/DUPLICATE_PO/)).toBeInTheDocument();
  });

  it("formats sub-second durations in ms", () => {
    render(
      <EventsTimeline
        executedNodes={[makeNode({ node: "ingest", duration_ms: 42 })]}
      />,
    );
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("formats durations >= 1s in seconds", () => {
    render(
      <EventsTimeline
        executedNodes={[makeNode({ node: "execute_recipe", duration_ms: 1234 })]}
      />,
    );
    expect(screen.getByText("1.23s")).toBeInTheDocument();
  });
});
