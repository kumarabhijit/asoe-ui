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
