/**
 * WaterfallStepper tests — node states, pipeline visualization.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(
      screen.getByText(/Auditing Duplicate PO against compliance policies/i),
    ).toBeInTheDocument();
  });

  it("shows error message for failed node", () => {
    const nodes = makeNodeStates(3);
    nodes[3] = { node: "validate_circuit_breaker", status: "failed" };
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText(/Node failed/)).toBeInTheDocument();
  });

  // REGRESSION (fails on parent): formatDuration used `if (!ms) return ""`, so a
  // genuine 0ms (sub-millisecond, rounded) completed node showed no duration.
  it("renders '0ms' for a 0-duration completed node (not blank)", () => {
    const nodes = makeNodeStates(1);
    nodes[0] = { node: "ingest", status: "completed", duration_ms: 0 };
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText("0ms")).toBeInTheDocument();
  });

  // REGRESSION (fails on parent): a skipped node used to be icon-only (dashed
  // ring), indistinguishable from "pending" for SR / low-vision users
  // (WCAG 1.4.1). It must now carry a visible "Skipped" text cue.
  it("renders a 'Skipped' text label for skipped nodes (not icon-only)", () => {
    const nodes = makeNodeStates(2);
    nodes[5] = { node: "select_recipe", status: "skipped" };
    render(<WaterfallStepper nodes={nodes} />);
    expect(screen.getByText("Skipped")).toBeInTheDocument();
  });

  it("renders all completed nodes for a resolved exception", () => {
    const nodes = makeNodeStates(10); // All completed
    render(<WaterfallStepper nodes={nodes} />);
    // All nodes should show completed state (checkmark icons)
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(10);
  });

  describe("Replay control", () => {
    it("hides the Replay button unless allowReplay is enabled", () => {
      const nodes = makeNodeStates(10);
      render(<WaterfallStepper nodes={nodes} />);
      expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
    });

    it("hides Replay while the pipeline is still in progress", () => {
      const nodes = makeNodeStates(3, true);
      render(<WaterfallStepper nodes={nodes} allowReplay />);
      expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
    });

    it("shows Replay only when every node completed and timings exist", () => {
      const nodes = makeNodeStates(10);
      render(<WaterfallStepper nodes={nodes} allowReplay />);
      expect(screen.getByRole("button", { name: /replay/i })).toBeInTheDocument();
    });

    it("hides Replay if no node carries a duration", () => {
      // Pipeline finished but no timings were captured — nothing meaningful
      // to animate, so the button stays hidden.
      const nodes: NodeState[] = ALL_NODES.map((node) => ({ node, status: "completed" }));
      render(<WaterfallStepper nodes={nodes} allowReplay />);
      expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
    });

    // REGRESSION (fails on parent): the reduced-motion check was read ONCE
    // inside a useMemo, so toggling the OS preference after mount never
    // updated the replay gate. The component now subscribes to the media
    // query's `change` event via usePrefersReducedMotion.
    it("re-evaluates the replay gate when OS reduced-motion toggles after mount", () => {
      const original = window.matchMedia;
      let listeners: Array<(e: { matches: boolean }) => void> = [];
      const mql = {
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: (_t: string, cb: (e: { matches: boolean }) => void) =>
          listeners.push(cb),
        removeEventListener: (_t: string, cb: (e: { matches: boolean }) => void) => {
          listeners = listeners.filter((l) => l !== cb);
        },
        addListener: (cb: (e: { matches: boolean }) => void) => listeners.push(cb),
        removeListener: (cb: (e: { matches: boolean }) => void) => {
          listeners = listeners.filter((l) => l !== cb);
        },
        dispatchEvent: () => true,
      };
      // @ts-expect-error — partial MediaQueryList mock is sufficient here.
      window.matchMedia = () => mql;
      try {
        const nodes = makeNodeStates(10);
        render(<WaterfallStepper nodes={nodes} allowReplay />);
        expect(
          screen.getByRole("button", { name: /replay/i }),
        ).toBeInTheDocument();
        // User enables reduced motion in the OS — the gate must react.
        act(() => {
          mql.matches = true;
          listeners.forEach((l) => l({ matches: true }));
        });
        expect(
          screen.queryByRole("button", { name: /replay/i }),
        ).not.toBeInTheDocument();
      } finally {
        window.matchMedia = original;
      }
    });

    it("swaps Replay for Stop while animating, and Stop cancels back", async () => {
      const user = userEvent.setup();
      const nodes = makeNodeStates(10);
      render(<WaterfallStepper nodes={nodes} allowReplay />);

      await user.click(screen.getByRole("button", { name: /replay/i }));
      // Animation started — Stop is now visible, Replay is hidden.
      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();

      // User can cancel an in-progress replay and return to the idle state.
      await user.click(screen.getByRole("button", { name: /stop/i }));
      expect(screen.getByRole("button", { name: /replay/i })).toBeInTheDocument();
    });
  });
});
