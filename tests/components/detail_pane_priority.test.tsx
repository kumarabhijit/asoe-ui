/**
 * Behavioural coverage (Pattern B) for the detail-pane hierarchy refactor:
 *   - ImpactBar surfaces Priority-1 impact and structurally omits absent
 *     metrics (Guardrail #6 — no "—" partial-truth).
 *   - Tabs (the Diagnostics isolation primitive) switches the mounted
 *     panel on click and on keyboard arrow nav, with correct ARIA wiring.
 */
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ImpactBar } from "@/app/exceptions/ImpactBar";
import { Tabs } from "@/components/ui/Tabs";
import type { ImpactMetrics } from "@/types/exceptions";

const fullMetrics: ImpactMetrics = {
  revenue_at_risk: 1218.24,
  delta_amount: 766.08,
  delta_percentage: 11.3,
  fulfillment_gap_pct: 25,
  sla_priority: "HIGH",
  affected_lines: 3,
};

describe("ImpactBar", () => {
  it("renders the Priority-1 impact metrics", () => {
    render(<ImpactBar impactMetrics={fullMetrics} />);
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeInTheDocument();
    expect(screen.getByText("Fulfillment gap")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
  });

  it("structurally omits fulfillment gap when absent (no '—')", () => {
    const { container } = render(
      <ImpactBar
        impactMetrics={{ ...fullMetrics, fulfillment_gap_pct: undefined }}
      />,
    );
    expect(screen.queryByText("Fulfillment gap")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("—");
  });

  // Regression (browser-e2e cascade 2026-06-07): the backend types every
  // optional impact metric as `Optional[float] = None`, which FastAPI
  // serialises to JSON `null`, NOT an omitted key. The old `!== undefined`
  // guard let `null` through into `null.toFixed(1)`, which threw and — because
  // ImpactBar is always-visible — crashed the entire detail pane (no action
  // buttons rendered → 16 real-backend specs failed). Must omit, not throw.
  it("treats null fulfillment_gap_pct as absent without throwing (backend null)", () => {
    const render0 = () =>
      render(
        <ImpactBar
          impactMetrics={{
            ...fullMetrics,
            // Backend wire shape: JSON null, not undefined.
            fulfillment_gap_pct: null as unknown as number,
          }}
        />,
      );
    expect(render0).not.toThrow();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.queryByText("Fulfillment gap")).not.toBeInTheDocument();
  });

  it("omits any metric that arrives null instead of crashing", () => {
    const { container } = render(
      <ImpactBar
        impactMetrics={{
          revenue_at_risk: 1000,
          delta_amount: null as unknown as number,
          delta_percentage: null as unknown as number,
          fulfillment_gap_pct: null as unknown as number,
          sla_priority: "P2",
          affected_lines: 1,
        }}
      />,
    );
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.queryByText("Delta")).not.toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(container.textContent).not.toContain("NaN");
  });

  it("renders nothing when there are no impact metrics", () => {
    const { container } = render(<ImpactBar impactMetrics={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "evidence", label: "Evidence" },
    { id: "diagnostics", label: "Diagnostics" },
  ];
  const renderTabs = () =>
    render(
      <Tabs
        ariaLabel="Evidence and diagnostics"
        tabs={tabs}
        renderPanel={(id) => <div>{id} panel content</div>}
      />,
    );

  it("mounts only the active panel and switches on click", () => {
    renderTabs();
    expect(screen.getByText("evidence panel content")).toBeInTheDocument();
    expect(screen.queryByText("diagnostics panel content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Diagnostics" }));
    expect(screen.getByText("diagnostics panel content")).toBeInTheDocument();
    expect(screen.queryByText("evidence panel content")).not.toBeInTheDocument();
  });

  it("wires aria-selected / roving tabindex", () => {
    renderTabs();
    const evidence = screen.getByRole("tab", { name: "Evidence" });
    const diagnostics = screen.getByRole("tab", { name: "Diagnostics" });
    expect(evidence).toHaveAttribute("aria-selected", "true");
    expect(evidence).toHaveAttribute("tabindex", "0");
    expect(diagnostics).toHaveAttribute("aria-selected", "false");
    expect(diagnostics).toHaveAttribute("tabindex", "-1");
  });

  it("moves selection with ArrowRight (automatic activation)", () => {
    renderTabs();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Diagnostics" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("diagnostics panel content")).toBeInTheDocument();
  });
});
