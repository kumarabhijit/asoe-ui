/**
 * DoR #11 — CollapsibleSection emits a Layer-2-open signal on first expand.
 * Fires onFirstOpen (and the Layer2OpenContext callback) exactly once, on the
 * first expand only — the automation-bias "operator inspected evidence" signal.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CollapsibleSection, Layer2OpenContext } from "@/app/exceptions/shared";

describe("CollapsibleSection Layer-2-open signal", () => {
  it("fires onFirstOpen once, only on the first expand", () => {
    const onFirstOpen = vi.fn();
    render(
      <CollapsibleSection title="Evidence" onFirstOpen={onFirstOpen}>
        <div>body</div>
      </CollapsibleSection>,
    );
    const header = screen.getByRole("button", { name: /Evidence/ });
    fireEvent.click(header); // open
    fireEvent.click(header); // collapse
    fireEvent.click(header); // open again
    expect(onFirstOpen).toHaveBeenCalledTimes(1);
  });

  // REGRESSION (report 04): the header had aria-expanded but no aria-controls,
  // so AT couldn't associate the toggle with the panel it governs. The region
  // element must exist (so the reference resolves) even while collapsed.
  it("wires aria-controls from the header to a region that exists when collapsed", () => {
    render(
      <CollapsibleSection title="Evidence" id="section-evidence">
        <div>body</div>
      </CollapsibleSection>,
    );
    const header = screen.getByRole("button", { name: /Evidence/ });
    const controls = header.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    // Region resolves while collapsed (present but hidden); children are lazy.
    const region = document.getElementById(controls!);
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("hidden");
    expect(screen.queryByText("body")).not.toBeInTheDocument();
    // On open, the region un-hides and the children mount.
    fireEvent.click(header);
    expect(region).not.toHaveAttribute("hidden");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("reports through Layer2OpenContext when no explicit prop is given", () => {
    const report = vi.fn();
    render(
      <Layer2OpenContext.Provider value={report}>
        <CollapsibleSection title="SAP Data">
          <div>body</div>
        </CollapsibleSection>
      </Layer2OpenContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /SAP Data/ }));
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("does not fire when never opened", () => {
    const report = vi.fn();
    render(
      <Layer2OpenContext.Provider value={report}>
        <CollapsibleSection title="Quiet">
          <div>body</div>
        </CollapsibleSection>
      </Layer2OpenContext.Provider>,
    );
    expect(report).not.toHaveBeenCalled();
  });
});

// Council follow-up 2026-06-09 — the operator asked that a group disclosure
// visibly OUTRANK the sub-sections stacked inside it, instead of every header
// sitting at one flat size. `level` drives a real heading-size step.
describe("CollapsibleSection heading levels (shown hierarchy)", () => {
  const titleClass = (title: string) =>
    screen.getByRole("button", { name: new RegExp(title) }).querySelector("span")
      ?.className ?? "";

  it("group level renders a larger heading than nested level", () => {
    render(
      <>
        <CollapsibleSection title="GroupHdr" level="group">
          <div>g</div>
        </CollapsibleSection>
        <CollapsibleSection title="NestedHdr" level="nested">
          <div>n</div>
        </CollapsibleSection>
      </>,
    );
    // The two levels MUST resolve to different type tokens — a regression
    // (everything `text-subhead`) is exactly the flat look that was reported.
    expect(titleClass("GroupHdr")).toContain("text-title");
    expect(titleClass("NestedHdr")).toContain("text-body");
    expect(titleClass("GroupHdr")).not.toEqual(titleClass("NestedHdr"));
  });

  it("defaults to the standalone section level when unspecified", () => {
    render(
      <CollapsibleSection title="PlainHdr">
        <div>p</div>
      </CollapsibleSection>,
    );
    expect(titleClass("PlainHdr")).toContain("text-subhead");
  });
});
