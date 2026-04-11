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
});
