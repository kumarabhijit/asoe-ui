/**
 * `usePaneFocusCycle` — F6 / Shift+F6 moves focus between workspace
 * panes. Regression for the "can't switch between panes with a
 * keyboard shortcut" report on `/cases`.
 *
 * jsdom note: `offsetParent` is null for every element (no layout
 * engine), so the hook's visibility filter would skip all panes. We
 * stub `offsetParent` per-element to model "visible" vs
 * "display:none" panes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { render, fireEvent } from "@testing-library/react";

import { usePaneFocusCycle } from "@/hooks/usePaneFocusCycle";

/** Force `offsetParent` to a truthy/null value so the hook's
 *  isVisible() check is deterministic in jsdom. */
function setVisible(el: HTMLElement, visible: boolean) {
  Object.defineProperty(el, "offsetParent", {
    configurable: true,
    get: () => (visible ? el.parentElement : null),
  });
}

function Harness({ middleVisible = true }: { middleVisible?: boolean }) {
  const queue = useRef<HTMLDivElement | null>(null);
  const middle = useRef<HTMLDivElement | null>(null);
  const detail = useRef<HTMLElement | null>(null);
  usePaneFocusCycle([queue, middle, detail]);
  return (
    <div>
      <div ref={queue} tabIndex={0} data-testid="queue">
        queue
      </div>
      <div
        ref={(n) => {
          middle.current = n;
          if (n) setVisible(n, middleVisible);
        }}
        tabIndex={0}
        data-testid="middle"
      >
        middle
      </div>
      <section ref={detail} tabIndex={-1} data-testid="detail">
        detail
      </section>
    </div>
  );
}

describe("usePaneFocusCycle", () => {
  beforeEach(() => {
    // Default: every element is "visible" unless a test overrides it.
    const proto = HTMLElement.prototype as unknown as {
      offsetParent?: unknown;
    };
    Object.defineProperty(proto, "offsetParent", {
      configurable: true,
      get() {
        return (this as HTMLElement).parentElement ?? document.body;
      },
    });
  });
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { offsetParent?: unknown })
      .offsetParent;
  });

  it("F6 cycles forward through the panes and wraps", () => {
    const { getByTestId } = render(<Harness />);
    const queue = getByTestId("queue");
    const middle = getByTestId("middle");
    const detail = getByTestId("detail");

    queue.focus();
    fireEvent.keyDown(document, { key: "F6" });
    expect(document.activeElement).toBe(middle);
    fireEvent.keyDown(document, { key: "F6" });
    expect(document.activeElement).toBe(detail);
    fireEvent.keyDown(document, { key: "F6" });
    expect(document.activeElement).toBe(queue); // wrapped
  });

  it("Shift+F6 cycles backward", () => {
    const { getByTestId } = render(<Harness />);
    const queue = getByTestId("queue");
    const detail = getByTestId("detail");

    queue.focus();
    fireEvent.keyDown(document, { key: "F6", shiftKey: true });
    expect(document.activeElement).toBe(detail); // wrapped backward
  });

  it("skips a pane that is not visible (collapsed column)", () => {
    const { getByTestId } = render(<Harness middleVisible={false} />);
    const queue = getByTestId("queue");
    const detail = getByTestId("detail");

    queue.focus();
    fireEvent.keyDown(document, { key: "F6" });
    // middle is display:none → skipped; focus jumps queue → detail.
    expect(document.activeElement).toBe(detail);
  });

  it("does not hijack F6 while typing in a text field", () => {
    const { getByTestId } = render(
      <>
        <input data-testid="search" />
        <Harness />
      </>,
    );
    const input = getByTestId("search") as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "F6" });
    expect(document.activeElement).toBe(input);
  });
});
