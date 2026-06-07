/**
 * MetricTile tests — KPI display rendering.
 */
import { render, screen } from "@testing-library/react";
import { MetricTile } from "@/components/ui/MetricTile";

describe("MetricTile", () => {
  it("renders label, value, and icon", () => {
    render(
      <MetricTile
        icon={<span data-testid="icon">I</span>}
        label="Total"
        value={42}
      />
    );
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <MetricTile icon={<span>I</span>} label="Open" value={5} subtitle="Need attention" />
    );
    expect(screen.getByText("Need attention")).toBeInTheDocument();
  });

  it("renders string values", () => {
    render(
      <MetricTile icon={<span>I</span>} label="Avg Time" value="8m" />
    );
    expect(screen.getByText("8m")).toBeInTheDocument();
  });

  // REGRESSION (report 06): the tile's three spans were loose, unassociated
  // text for assistive tech. It should be one group with a composed name so a
  // screen reader announces it as a single coherent stop.
  it("exposes a role=group with a composed accessible name (label: value: subtitle)", () => {
    render(
      <MetricTile
        icon={<span>I</span>}
        label="Open exceptions"
        value={42}
        subtitle="last 24h"
      />
    );
    expect(
      screen.getByRole("group", { name: "Open exceptions: 42: last 24h" }),
    ).toBeInTheDocument();
  });

  it("marks the decorative icon container aria-hidden", () => {
    const { container } = render(
      <MetricTile icon={<span>I</span>} label="Total" value={1} />
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  // REGRESSION (report 06): the headline number used --font-size-heading (16px)
  // instead of the dedicated --font-size-mono-metric KPI scale.
  it("sizes the value with the mono-metric token, not the heading size", () => {
    render(<MetricTile icon={<span>I</span>} label="Total" value={42} />);
    const value = screen.getByText("42");
    expect(value.style.fontSize).toBe("var(--font-size-mono-metric)");
    expect(value.className).not.toContain("text-heading");
  });
});
