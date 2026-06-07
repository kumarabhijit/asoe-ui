/**
 * GapBar — shortfall/excess direction must be reachable and not colour-only.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GapBar } from "@/components/ui/GapBar";

describe("GapBar", () => {
  // REGRESSION (fails on parent): both isExcess and isShortfall required
  // primaryQty > secondaryQty, so the MOQ/back-order under-case (ordered <
  // target) was never rendered as a shortfall — the secondary bar showed green
  // "success" and the row read a neutral "Gap".
  it("renders the under-case (ordered < target) as a shortfall", () => {
    const { container } = render(
      <GapBar
        primaryQty={30}
        primaryLabel="Ordered"
        secondaryQty={100}
        secondaryLabel="MOQ"
        uom="CS"
        mode="shortfall"
      />,
    );
    // Direction is textual (not colour-only): explicit "Short by".
    expect(screen.getByText(/Short by:\s*70\s*CS/)).toBeInTheDocument();
    // The secondary bar is highlighted warning, not success.
    expect(container.querySelector(".bg-warning")).not.toBeNull();
    expect(container.querySelector(".bg-success")).toBeNull();
  });

  it("renders the over-case (ordered > max) as an excess with a + direction word", () => {
    render(
      <GapBar
        primaryQty={150}
        primaryLabel="Ordered"
        secondaryQty={100}
        secondaryLabel="Max"
        uom="CS"
        mode="excess"
      />,
    );
    expect(screen.getByText(/Over by:\s*50\s*CS/)).toBeInTheDocument();
  });

  it("omits the gap row when there is no gap", () => {
    render(
      <GapBar
        primaryQty={100}
        primaryLabel="Ordered"
        secondaryQty={100}
        secondaryLabel="Available"
        uom="CS"
        mode="shortfall"
      />,
    );
    expect(screen.queryByText(/Short by|Over by/)).toBeNull();
  });
});
